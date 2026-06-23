/**
 * Abstract base for a live link to one physical device: the contract for discovering, opening, and
 * holding the transport used to flash firmware and to stream the serial monitor.
 *
 * Concrete connections extend this and implement every getter/method below; the base throws to
 * surface a half-implemented connection the moment it is used. A connection owns the transport (a
 * serial port handle, a helper WebSocket session); the flasher and the serial monitor borrow it
 * rather than opening their own.
 *
 * Connection is paired with a flasher by transport (e.g. a WebSerial connection with the esptool
 * flasher), but it knows nothing about compiling or flashing — those live in the firmware pipeline.
 *
 * Implementations emit `Runtime.DEVICE_CONNECTED` / `Runtime.DEVICE_DISCONNECTED` so the GUI and
 * serial monitor can track the link.
 */
class Connection {
    /**
     * @param {Runtime} runtime - the VM runtime, used to emit connection lifecycle events.
     */
    constructor (runtime) {
        this.runtime = runtime;
    }

    /**
     * Discover the targets this connection could open, narrowed to the selected device. Implementations
     * filter by the device's `getUploadConfig().pnpid` so the list shows the chosen board's ports.
     * Returns an empty array when discovery is unavailable (e.g. WebSerial, where the browser's native
     * picker replaces an enumerated list); the caller then drives `connect()` directly.
     * @param {Device} device - the selected device, used to filter candidates.
     * @returns {Promise<Array.<ConnectionTarget>>} the available targets.
     */
    list (device) {
        throw new Error(`${this.constructor.name} must implement list()`);
    }

    /**
     * Open the link to a target. On success the transport is available via `transport` and
     * `isConnected` is true. Resolves when the link is ready to flash or monitor.
     * @param {?ConnectionTarget} [target] - the target to open. Optional: helper mode passes a target
     *   chosen from `list()`; web mode omits it and lets the browser's native picker choose.
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
     * The concrete type is connection-specific (a serial port, a helper session); consumers receive it
     * opaquely. Throws when not connected.
     * @returns {*} the transport handle.
     */
    get transport () {
        throw new Error(`${this.constructor.name} must implement get transport()`);
    }
}

/**
 * One discoverable device the connection could open.
 * @typedef {object} ConnectionTarget
 * @property {string} id - stable identifier for this target (e.g. serial path or helper port id).
 * @property {string} name - human-readable label for the connect UI.
 */

module.exports = Connection;
