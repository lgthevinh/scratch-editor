/**
 * Abstract base for a device-link backend: the single contract for discovering, opening, building
 * for, flashing, and monitoring one physical device. Two backends implement it — the native helper
 * over a WebSocket ({@link LinkClient}) and the browser's Web Serial API (web mode) — so the firmware
 * pipeline and the GUI can drive either without knowing which transport is behind it.
 *
 * Concrete clients extend this and implement every method below; the base throws to surface a
 * half-implemented backend the moment it is used. A client owns its transport (a helper WS session, a
 * serial port handle); the flasher and the serial monitor borrow it rather than opening their own.
 *
 * Wire formats never escape a client. Each backend maps its transport's shapes onto the VM-facing
 * typedefs defined here ({@link ConnectionTarget}, {@link Artifact}), so callers stay transport-agnostic.
 *
 * Implementations emit `Runtime.DEVICE_CONNECTED` / `Runtime.DEVICE_DISCONNECTED` so the GUI and the
 * serial monitor can track the link.
 */
class Client {
    /**
     * @param {Runtime} runtime - the VM runtime, used to emit connection lifecycle events.
     */
    constructor (runtime) {
        this.runtime = runtime;
    }

    /**
     * Discover the targets this client could open, narrowed to the selected device. Implementations
     * filter by the device's `getUploadConfig().pnpid` so the list shows the chosen board's ports.
     * Returns an empty array when discovery is unavailable (e.g. Web Serial, where the browser's native
     * picker replaces an enumerated list); the caller then drives `connect()` directly.
     * @param {Device} device - the selected device, used to filter candidates.
     * @returns {Promise<Array.<ConnectionTarget>>} the available targets.
     */
    listBoards (device) {
        throw new Error(`${this.constructor.name} must implement listBoards()`);
    }

    /**
     * Open the link to a target. On success the transport is available via `transport` and
     * `isConnected` is true. Resolves when the link is ready to flash or monitor.
     * @param {?ConnectionTarget} [target] - the target to open. Optional: helper mode passes a target
     *   chosen from `listBoards()`; web mode omits it and lets the browser's native picker choose.
     * @returns {Promise<void>} resolves once connected.
     */
    connect (target) {
        throw new Error(`${this.constructor.name} must implement connect()`);
    }

    /**
     * Close the link and release the transport. Safe to call when already disconnected.
     * @returns {Promise<void>} resolves once closed.
     */
    disconnect () {
        throw new Error(`${this.constructor.name} must implement disconnect()`);
    }

    /**
     * Whether the link is currently open. The firmware pipeline requires this before uploading.
     * @returns {boolean} true when connected.
     */
    get isConnected () {
        throw new Error(`${this.constructor.name} must implement get isConnected()`);
    }

    /**
     * The open transport handle that the flasher writes firmware to and the serial monitor reads from.
     * The concrete type is backend-specific (a helper session, a serial port); consumers receive it
     * opaquely. Throws when not connected.
     * @returns {*} the transport handle.
     */
    get transport () {
        throw new Error(`${this.constructor.name} must implement get transport()`);
    }

    /**
     * Build firmware for the device from generated source, streaming progress and build log as it goes.
     * @param {Device} device - the selected device (supplies fqbn and compile config).
     * @param {string} source - the generated Arduino C++ source.
     * @param {CompileHandlers} [handlers] - optional `{onLog, onProgress}` streaming callbacks.
     * @returns {Promise<Artifact>} the compiled binary.
     */
    compile (device, source, handlers) {
        throw new Error(`${this.constructor.name} must implement compile()`);
    }

    /**
     * Flash a compiled artifact to the connected device, streaming progress as it goes.
     * @param {Device} device - the selected device (supplies upload config).
     * @param {Artifact} artifact - the binary produced by `compile()`.
     * @param {{onProgress: function}} [handlers] - optional progress callback.
     * @returns {Promise<void>} resolves once flashed.
     */
    flash (device, artifact, handlers) {
        throw new Error(`${this.constructor.name} must implement flash()`);
    }

    /**
     * Open the serial monitor on the connected transport. Inbound bytes are delivered to the runtime
     * for `SerialLog`. No monitoring mid-flash — the flasher and monitor share one transport.
     * @param {{baudRate: number}} options - the monitor baud rate.
     * @returns {Promise<void>} resolves once the monitor is open.
     */
    openMonitor (options) {
        throw new Error(`${this.constructor.name} must implement openMonitor()`);
    }

    /**
     * Write bytes to the open serial monitor.
     * @param {string} data - the bytes to send.
     * @returns {void}
     */
    writeMonitor (data) {
        throw new Error(`${this.constructor.name} must implement writeMonitor()`);
    }

    /**
     * Close the serial monitor, leaving the link connected.
     * @returns {Promise<void>} resolves once the monitor is closed.
     */
    closeMonitor () {
        throw new Error(`${this.constructor.name} must implement closeMonitor()`);
    }
}

/**
 * One discoverable device the client could open. The VM-facing target shape; a backend maps its
 * transport's own shape (e.g. the helper's `{port, label}`) onto this.
 * @typedef {object} ConnectionTarget
 * @property {string} id - stable identifier for this target (e.g. serial path or helper port id).
 * @property {string} name - human-readable label for the connect UI.
 */

/**
 * A compiled firmware binary handed from `compile()` to `flash()`.
 * @typedef {object} Artifact
 * @property {string} format - binary format, 'bin' (ESP) or 'hex' (AVR).
 * @property {*} data - the binary payload.
 * @property {number} [offset] - flash offset, when the format requires one.
 */

/**
 * Streaming callbacks for `compile()`.
 * @typedef {object} CompileHandlers
 * @property {function(string):void} [onLog] - receives each stdout/stderr chunk.
 * @property {function({phase: string, percent: number}):void} [onProgress] - receives progress updates.
 */

module.exports = Client;
