const Client = require('./client');
const {withDefaults} = require('./callbacks');
const log = require('../../util/log');

/**
 * Default address of the native helper's WebSocket server (thingblock-link). The helper listens on
 * loopback, a secure context, so no TLS is needed.
 * @type {string}
 */
const DEFAULT_URL = 'ws://localhost:3030/';

/**
 * A {@link Client} backed by the native helper (thingblock-link) over a WebSocket. The helper is a
 * translating proxy in front of the arduino-cli daemon; this class speaks its minimal JSON envelope
 * — `{id, type, payload}` — and never sees an arduino-cli message type.
 *
 * One socket carries every operation. A request's `id` correlates it with its streamed responses
 * (`log` / `progress` / `monitorData`) and its single terminal reply (`result` or `error`). Of the
 * {@link Client} contract, `listBoards`, `connect`, `disconnect`, `compile`, `flash`, and the serial
 * monitor (`openMonitor` / `writeMonitor` / `closeMonitor`) are wired here.
 *
 * `connect` is helper-side session state — the helper records the selected port on its own socket,
 * with no daemon round-trip — so a dropped socket means the helper has forgotten the port. The close
 * handler treats that as a disconnect to keep `isConnected` honest.
 *
 * The WebSocket and its URL are injectable so the VM's tests can drive a fake socket with no server.
 */
class LinkClient extends Client {
    /**
     * @param {Runtime} runtime - the VM runtime.
     * @param {object} [options] - injection points.
     * @param {string} [options.url] - the helper WebSocket URL (defaults to `ws://localhost:3030/`).
     * @param {Function} [options.WebSocket] - the WebSocket constructor (defaults to the global one).
     */
    constructor (runtime, {url = DEFAULT_URL, WebSocket = globalThis.WebSocket} = {}) {
        super(runtime);

        /** @type {string} */
        this._url = url;
        /** @type {Function} */
        this._WebSocket = WebSocket;
        /** @type {?WebSocket} the live socket; null until first request opens it. */
        this._ws = null;
        /** @type {?Promise<void>} memoized open handshake; null when the socket is closed. */
        this._openPromise = null;
        /** @type {number} monotonic request-id source. */
        this._nextId = 1;
        /** @type {Map<string, {resolve: Function, reject: Function}>} in-flight requests by id. */
        this._pending = new Map();
        /** @type {Set<string>} ids of in-flight cancellable requests (compile/upload). */
        this._cancellable = new Set();
        /** @type {?ConnectionTarget} the open target; null when disconnected. */
        this._connectedTarget = null;
        /**
         * The open monitor session, or null when none. `monitorOpen` is the one request whose id keeps
         * receiving frames (`monitorData`, a late `error`) after its terminal `result`, so the routing
         * lives here rather than on the request's `_pending` entry, which `_settle` deletes on `result`.
         * @type {?{id: string, opened: boolean}}
         */
        this._monitor = null;
    }

    /**
     * @returns {boolean} whether a WebSocket implementation is available in this environment.
     */
    static isSupported () {
        return typeof globalThis.WebSocket !== 'undefined';
    }

    /**
     * The helper's WebSocket URL. The VM derives the helper's HTTP resource origin from it (swap the
     * scheme, append the resource path), since the same helper process serves both.
     * @returns {string} the helper WebSocket URL.
     */
    get url () {
        return this._url;
    }

    /**
     * gRPC `BoardList` via the helper, narrowed to the device's known USB ids. The helper reconstructs
     * each port's PNP id and keeps those matching `getUploadConfig().pnpid`, returning `{port, label}`
     * targets; this maps them onto the VM-facing `{id, name}` shape.
     * @param {Device} device - the selected device.
     * @returns {Promise<Array.<ConnectionTarget>>} the matching connected boards.
     */
    async listBoards (device) {
        const {pnpid = []} = device.getUploadConfig();
        log.info(`LinkClient.listBoards: requesting boards matching pnpid=${JSON.stringify(pnpid)}`);
        const {targets} = await this._request('listBoards', {pnpid});
        log.info(`LinkClient.listBoards: helper returned ${targets.length} board(s)`);
        return targets.map(target => ({id: target.port, name: target.label}));
    }

    /**
     * Record the selected port with the helper. The helper stores it on this socket's session (no
     * daemon round-trip — the port is validated later at upload/monitor time) and replies `result {}`.
     * @param {ConnectionTarget} target - the target chosen from `listBoards()`; `id` is the port.
     * @returns {Promise<void>} resolves once the helper has the selection.
     */
    async connect (target) {
        log.info(`LinkClient.connect: selecting port ${target.id} with the helper`);
        await this._request('connect', {port: target.id});
        this._connectedTarget = target;
        log.info('LinkClient.connect: connected');
        this.runtime.emit(this.runtime.constructor.DEVICE_CONNECTED);
    }

    /**
     * Clear the helper's selected port. Safe to call when already disconnected.
     * @returns {Promise<void>} resolves once cleared.
     */
    async disconnect () {
        if (!this._connectedTarget) {
            log.info('LinkClient.disconnect: no selected port; nothing to do');
            return;
        }
        log.info('LinkClient.disconnect: clearing the helper-selected port');
        await this._request('disconnect', {});
        // The helper closes any open monitor as part of disconnect; drop our routing to match.
        this._monitor = null;
        this._connectedTarget = null;
        this.runtime.emit(this.runtime.constructor.DEVICE_DISCONNECTED);
    }

    /**
     * @returns {boolean} whether a target is currently selected with the helper.
     */
    get isConnected () {
        return this._connectedTarget !== null;
    }

    /**
     * Build firmware via the helper, streaming `log`/`progress` to `callbacks` until the helper replies
     * with the located artifact. The helper keeps the binary on disk, so the artifact carries a `path`
     * (not bytes) that `flash()` hands back to the helper's `upload`. Vendored libs travel as `{pack, lib}`
     * references the helper resolves from its resource root — no lib bytes cross the socket.
     * @param {Device} device - the selected device (supplies fqbn and compile config).
     * @param {string} source - the generated Arduino C++ source.
     * @param {Array.<{pack: string, lib: string}>} [libs] - vendored-library references.
     * @param {import('./callbacks').CompileCallbacks} [callbacks] - optional `{onLog, onProgress}`.
     * @returns {Promise<Artifact>} the compiled artifact `{format, path}`.
     */
    async compile (device, source, libs = [], callbacks) {
        const fqbn = this._composeFqbn(device);
        log.info(`LinkClient.compile: requesting build for ${fqbn} with ${libs.length} vendored lib(s)`);
        const {artifact} = await this._request(
            'compile',
            {fqbn, options: {}, source, libs},
            withDefaults(callbacks),
            true
        );
        log.info(`LinkClient.compile: artifact ready (format=${artifact.format})`);
        return artifact;
    }

    /**
     * Flash a compiled artifact to the connected port via the helper's `upload`, streaming the upload
     * tool's output to `callbacks` until the helper replies. The artifact stays on the helper's disk —
     * its `path` (not bytes) is handed back to the helper, which points arduino-cli's `import_file` at
     * it. arduino-cli's upload tool prints its progress as text into the log stream, so an upload emits
     * `log` chunks (routed to `onLog`) and no structured `progress`.
     * @param {Device} device - the selected device (supplies fqbn, compile options, and upload config).
     * @param {Artifact} artifact - the binary produced by `compile()` (`{format, path}`).
     * @param {import('./callbacks').CompileCallbacks} [callbacks] - optional `{onLog, onProgress}`.
     * @returns {Promise<void>} resolves once the flash completes.
     */
    async flash (device, artifact, callbacks) {
        if (!this.isConnected) {
            throw new Error('LinkClient.flash: no connected port; call connect() first');
        }
        const fqbn = this._composeFqbn(device);
        const {uploadSpeed = 0} = device.getUploadConfig();
        const port = this._connectedTarget.id;
        log.info(`LinkClient.flash: uploading ${artifact.format} artifact to ${port} for ${fqbn}`);
        await this._request(
            'upload',
            {fqbn, port, uploadSpeed, artifact},
            withDefaults(callbacks),
            true
        );
        log.info('LinkClient.flash: upload complete');
    }

    /**
     * Open the serial monitor on the connected port via the helper's `monitorOpen`, resolving once the
     * port is open. The monitor borrows the connected transport (like `flash`), so the port comes from
     * the current selection rather than `options`. After the open resolves, inbound serial bytes arrive
     * as `monitorData` frames on this request's id and are emitted on the runtime as `SERIAL_DATA`; the
     * routing lives in {@link _monitor} because those frames keep arriving past the terminal `result`.
     * @param {{baudRate: number}} options - the monitor baud rate.
     * @returns {Promise<void>} resolves once the monitor is open.
     */
    async openMonitor (options) {
        if (!this.isConnected) {
            throw new Error('LinkClient.openMonitor: no connected port; call connect() first');
        }
        const port = this._connectedTarget.id;
        const {baudRate} = options;
        // Pre-allocate the id so `_monitor` can route this request's post-`result` frames.
        const id = String(this._nextId++);
        this._monitor = {id, opened: false};
        log.info(`LinkClient.openMonitor: opening serial monitor on ${port} at ${baudRate} baud`);
        await this._request('monitorOpen', {port, baudRate}, undefined, false, id);
    }

    /**
     * Write bytes to the open serial monitor via the helper's `monitorWrite`. Fire-and-forget: the
     * helper routes by session and sends no reply, so this returns nothing. A no-op when no monitor is
     * open.
     * @param {string} data - the bytes to send.
     * @returns {void}
     */
    writeMonitor (data) {
        if (!this._monitor) {
            log.warn('LinkClient.writeMonitor: no open monitor; dropping write');
            return;
        }
        this._ws.send(JSON.stringify({id: this._monitor.id, type: 'monitorWrite', payload: {data}}));
    }

    /**
     * Close the serial monitor via the helper's `monitorClose`, leaving the link connected. Resolves
     * on the helper's terminal `result`. A no-op when no monitor is open.
     * @returns {Promise<void>} resolves once the monitor is closed.
     */
    async closeMonitor () {
        if (!this._monitor) return;
        log.info('LinkClient.closeMonitor: closing the serial monitor');
        await this._request('monitorClose', {});
        this._monitor = null;
    }

    /**
     * Build the arduino-cli FQBN, folding the device's board-menu option selections
     * (`getCompileConfig().options`, e.g. `PartitionScheme`) onto the base fqbn as `:k1=v1,k2=v2`.
     * arduino-cli takes these as part of the FQBN, not as separate compile options.
     * @param {Device} device - the selected device.
     * @returns {string} the composed FQBN.
     * @private
     */
    _composeFqbn (device) {
        const {options = {}} = device.getCompileConfig();
        const menu = Object.entries(options)
            .map(([key, value]) => `${key}=${value}`)
            .join(',');
        return menu ? `${device.fqbn}:${menu}` : device.fqbn;
    }

    /**
     * Send one request envelope and resolve with its terminal `result` payload (or reject on `error`).
     * Opens the socket on first use. When `callbacks` is given, streamed `log`/`progress` frames for
     * this request are routed to it until the terminal reply settles the promise.
     * @param {string} type - the request type (e.g. 'listBoards').
     * @param {object} payload - the request payload.
     * @param {{onLog: function, onProgress: function}} [callbacks] - streaming callbacks for this
     *   request (already defaulted via {@link withDefaults}); omitted for non-streaming requests.
     * @param {boolean} [cancellable] - whether {@link cancel} may abort this request mid-flight
     *   (the long-running compile/upload); recorded so `cancel` can target its id.
     * @param {string} [id] - a pre-allocated correlation id; defaults to a fresh one. `openMonitor`
     *   passes its own so it can register the monitor routing before the request settles.
     * @returns {Promise<object>} the `result` payload.
     * @private
     */
    _request (type, payload, callbacks, cancellable = false, id = String(this._nextId++)) {
        const promise = new Promise((resolve, reject) => {
            this._pending.set(id, {resolve, reject, callbacks});
        });
        if (cancellable) this._cancellable.add(id);
        this._ensureOpen()
            .then(() => this._ws.send(JSON.stringify({id, type, payload})))
            .catch(err => this._settle(id, {reject: err}));
        return promise;
    }

    /**
     * Abort the in-flight cancellable request(s) — the running compile or upload. Sends a `cancel`
     * envelope stamped with the target request's id (per the protocol, `cancel` carries the id of the
     * request to drop, not a fresh one); the helper drops that request's stream and replies on it with
     * `error{cancelled}`, which rejects the original `compile`/`flash` promise. A no-op when nothing
     * cancellable is in flight.
     * @returns {void}
     */
    cancel () {
        if (this._cancellable.size === 0) return;
        for (const id of this._cancellable) {
            log.info(`LinkClient.cancel: requesting cancel of in-flight request ${id}`);
            this._ws.send(JSON.stringify({id, type: 'cancel', payload: {}}));
        }
    }

    /**
     * Lazily open the socket, memoizing the handshake so concurrent requests share one connection.
     * @returns {Promise<void>} resolves once the socket is open.
     * @private
     */
    _ensureOpen () {
        if (this._openPromise) return this._openPromise;

        log.info(`LinkClient: opening WebSocket to the helper at ${this._url}`);
        this._openPromise = new Promise((resolve, reject) => {
            const ws = new this._WebSocket(this._url);
            this._ws = ws;
            ws.onopen = () => {
                log.info('LinkClient: WebSocket open');
                resolve();
            };
            ws.onmessage = event => this._handleMessage(event.data);
            ws.onerror = () => {
                // Surfaces as a rejected open to the first caller; later failures arrive via onclose.
                log.error(`LinkClient: WebSocket error connecting to ${this._url} — ` +
                    'is the thingblock-link helper running?');
                reject(new Error(`LinkClient: WebSocket error connecting to ${this._url}`));
            };
            ws.onclose = () => this._handleClose();
        });
        return this._openPromise;
    }

    /**
     * Route an inbound frame to its pending request. Terminal `result`/`error` settle the request;
     * streaming `log`/`progress` frames go to the request's callbacks without settling. `monitorData`
     * frames (which arrive on the open monitor's id past its terminal `result`) emit `SERIAL_DATA` on
     * the runtime; a late `error` on that id tears the monitor down. `event` frames are ignored.
     * @param {string} raw - the JSON text frame.
     * @private
     */
    _handleMessage (raw) {
        let message;
        try {
            message = JSON.parse(raw);
        } catch (err) {
            log.error(`LinkClient: dropping unparseable frame: ${err.message}`, raw);
            return;
        }
        const {id, type, payload} = message;
        switch (type) {
        case 'log': {
            const pending = this._pending.get(id);
            if (pending && pending.callbacks) pending.callbacks.onLog(payload.chunk);
            break;
        }
        case 'progress': {
            const pending = this._pending.get(id);
            if (pending && pending.callbacks) pending.callbacks.onProgress(payload);
            break;
        }
        case 'result':
            // The monitor's open `result` confirms the port; later frames on this id are serial data.
            if (this._monitor && this._monitor.id === id) this._monitor.opened = true;
            this._settle(id, {resolve: payload});
            break;
        case 'monitorData':
            if (this._monitor && this._monitor.id === id) {
                this.runtime.emit(this.runtime.constructor.SERIAL_DATA, payload.data);
            }
            break;
        case 'error': {
            const error = new Error((payload && payload.message) || 'link request failed');
            error.code = payload && payload.code;
            log.warn(`LinkClient: helper returned error for request ${id} ` +
                `(code=${error.code}): ${error.message}`);
            this._settle(id, {reject: error});
            // A post-open error means the serial port died; tear the monitor down. (Before open, the
            // rejected `openMonitor` promise already surfaces it — we just drop the stale routing.)
            if (this._monitor && this._monitor.id === id) {
                if (this._monitor.opened) {
                    log.warn(`LinkClient: serial monitor error, closing monitor: ${error.message}`);
                }
                this._monitor = null;
            }
            break;
        }
        default:
            break;
        }
    }

    /**
     * Reject every in-flight request when the socket closes, and reset so the next request reconnects.
     * The helper's selected port is session state on this socket, so a close also drops the link —
     * surface that as a disconnect.
     * @private
     */
    _handleClose () {
        log.info(`LinkClient: WebSocket closed; rejecting ${this._pending.size} in-flight request(s)`);
        const err = new Error('LinkClient: connection to the helper closed');
        for (const id of [...this._pending.keys()]) {
            this._settle(id, {reject: err});
        }
        this._ws = null;
        this._openPromise = null;
        this._monitor = null;
        if (this._connectedTarget) {
            this._connectedTarget = null;
            this.runtime.emit(this.runtime.constructor.DEVICE_DISCONNECTED);
        }
    }

    /**
     * Resolve or reject a pending request by id, then drop it. No-op if already settled.
     * @param {string} id - the request id.
     * @param {{resolve?: *, reject?: Error}} outcome - exactly one of `resolve`/`reject`.
     * @private
     */
    _settle (id, outcome) {
        const pending = this._pending.get(id);
        if (!pending) return;
        this._pending.delete(id);
        this._cancellable.delete(id);
        if ('reject' in outcome) {
            pending.reject(outcome.reject);
        } else {
            pending.resolve(outcome.resolve);
        }
    }
}

module.exports = LinkClient;
