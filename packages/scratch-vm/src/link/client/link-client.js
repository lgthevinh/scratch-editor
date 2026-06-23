const Client = require('./client');
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
 * (`log` / `progress`) and its single terminal reply (`result` or `error`). Of the {@link Client}
 * contract, only `listBoards` is wired today; the helper answers the rest with `error{unimplemented}`
 * until their milestone lands, so those methods inherit the base throw for now.
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
    }

    /**
     * @returns {boolean} whether a WebSocket implementation is available in this environment.
     */
    static isSupported () {
        return typeof globalThis.WebSocket !== 'undefined';
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
        const {targets} = await this._request('listBoards', {pnpid});
        return targets.map(target => ({id: target.port, name: target.label}));
    }

    /**
     * Send one request envelope and resolve with its terminal `result` payload (or reject on `error`).
     * Opens the socket on first use.
     * @param {string} type - the request type (e.g. 'listBoards').
     * @param {object} payload - the request payload.
     * @returns {Promise<object>} the `result` payload.
     * @private
     */
    _request (type, payload) {
        const id = String(this._nextId++);
        const promise = new Promise((resolve, reject) => {
            this._pending.set(id, {resolve, reject});
        });
        this._ensureOpen()
            .then(() => this._ws.send(JSON.stringify({id, type, payload})))
            .catch(err => this._settle(id, {reject: err}));
        return promise;
    }

    /**
     * Lazily open the socket, memoizing the handshake so concurrent requests share one connection.
     * @returns {Promise<void>} resolves once the socket is open.
     * @private
     */
    _ensureOpen () {
        if (this._openPromise) return this._openPromise;

        this._openPromise = new Promise((resolve, reject) => {
            const ws = new this._WebSocket(this._url);
            this._ws = ws;
            ws.onopen = () => resolve();
            ws.onmessage = event => this._handleMessage(event.data);
            ws.onerror = () => {
                // Surfaces as a rejected open to the first caller; later failures arrive via onclose.
                reject(new Error(`LinkClient: WebSocket error connecting to ${this._url}`));
            };
            ws.onclose = () => this._handleClose();
        });
        return this._openPromise;
    }

    /**
     * Route an inbound frame to its pending request. Terminal `result`/`error` settle the request;
     * streaming `log`/`progress`/`event`/`monitorData` frames are ignored until their milestone wires
     * per-request handlers.
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
        case 'result':
            this._settle(id, {resolve: payload});
            break;
        case 'error': {
            const error = new Error((payload && payload.message) || 'link request failed');
            error.code = payload && payload.code;
            this._settle(id, {reject: error});
            break;
        }
        default:
            break;
        }
    }

    /**
     * Reject every in-flight request when the socket closes, and reset so the next request reconnects.
     * @private
     */
    _handleClose () {
        const err = new Error('LinkClient: connection to the helper closed');
        for (const id of [...this._pending.keys()]) {
            this._settle(id, {reject: err});
        }
        this._ws = null;
        this._openPromise = null;
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
        if ('reject' in outcome) {
            pending.reject(outcome.reject);
        } else {
            pending.resolve(outcome.resolve);
        }
    }
}

module.exports = LinkClient;
