const Connection = require('./connection');

/**
 * Baud rate the port is opened at on connect. This is the serial-monitor rate, distinct from the
 * per-device flash `uploadSpeed`; the flasher reopens the port at its own rate when flashing.
 * @type {number}
 */
const DEFAULT_BAUD_RATE = 115200;

/**
 * A {@link Connection} over the Web Serial API. Lives in the VM (the API is a native browser global,
 * not a bundled dependency), mirroring how `io/ble.js` holds BLE logic in the VM.
 *
 * Discovery is not enumerable in Web Serial without a user gesture, so `list()` returns nothing and
 * `connect()` opens the browser's native port picker instead.
 */
class WebSerialConnection extends Connection {
    /**
     * @param {Runtime} runtime - the VM runtime.
     */
    constructor (runtime) {
        super(runtime);

        /** @type {?SerialPort} the granted, open serial port; null when disconnected. */
        this._port = null;
        this._connected = false;
    }

    /**
     * @returns {boolean} whether Web Serial is available in this environment (Chromium-based browsers).
     */
    static isSupported () {
        return typeof navigator !== 'undefined' && 'serial' in navigator;
    }

    /**
     * Web Serial filters narrowing the native picker to a device's known USB VID/PIDs. Parses the
     * Windows PNP-ID strings in `getUploadConfig().pnpid` (e.g. 'USB\\VID_2341&PID_0043') into the
     * numeric `{usbVendorId, usbProductId}` form `requestPort` expects.
     * @param {Device} device - the selected device.
     * @returns {Array.<{usbVendorId: number, usbProductId: number}>} the filters (empty if none parse).
     */
    static filtersFromDevice (device) {
        const {pnpid = []} = device.getUploadConfig();
        const filters = [];
        for (const id of pnpid) {
            const match = /VID_([0-9A-Fa-f]{4})&PID_([0-9A-Fa-f]{4})/.exec(id);
            if (match) {
                filters.push({
                    usbVendorId: parseInt(match[1], 16),
                    usbProductId: parseInt(match[2], 16)
                });
            }
        }
        return filters;
    }

    /**
     * Web Serial cannot enumerate ports without a user gesture, so there is no pre-connect list; the
     * native picker (opened by `connect()`) takes its place. Returning empty signals the GUI to go
     * straight to `connect()`.
     * @returns {Promise<Array>} always an empty array.
     */
    list () {
        return Promise.resolve([]);
    }

    /**
     * Open the native port picker, then open the chosen port. Requires a user gesture (the picker is
     * gesture-gated by the browser).
     * @param {?{filters: Array}} [target] - optional Web Serial filters (see `filtersFromDevice`); when
     *   omitted, the picker shows all serial ports.
     * @returns {Promise<void>} resolves once the port is open.
     */
    async connect (target = null) {
        if (!WebSerialConnection.isSupported()) {
            throw new Error('Web Serial is not available in this browser');
        }
        const filters = (target && target.filters) || [];
        const port = await navigator.serial.requestPort({filters});
        await port.open({baudRate: DEFAULT_BAUD_RATE});
        this._port = port;
        this._connected = true;
        this.runtime.emit(this.runtime.constructor.DEVICE_CONNECTED);
    }

    /**
     * Close the port and release it. Safe to call when already disconnected.
     * @returns {Promise<void>} resolves once closed.
     */
    async disconnect () {
        if (!this._port) return;
        await this._port.close();
        this._port = null;
        this._connected = false;
        this.runtime.emit(this.runtime.constructor.DEVICE_DISCONNECTED);
    }

    /**
     * @returns {boolean} whether a port is currently open.
     */
    get isConnected () {
        return this._connected;
    }

    /**
     * @returns {SerialPort} the open port, which the flasher and serial monitor borrow.
     */
    get transport () {
        if (!this._port) {
            throw new Error('WebSerialConnection: no open port; call connect() first');
        }
        return this._port;
    }
}

module.exports = WebSerialConnection;
