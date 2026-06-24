const Client = require('./client');
const log = require('../../util/log');

/**
 * Baud rate the port is opened at on connect. This is the serial-monitor rate, distinct from the
 * per-device flash `uploadSpeed`; the flasher reopens the port at its own rate when flashing.
 * @type {number}
 */
const DEFAULT_BAUD_RATE = 115200;

/**
 * Id of the single synthetic target {@link CloudClient#listBoards} returns. Web Serial cannot enumerate
 * ports, so the board list shows one entry that stands in for "the browser port picker"; selecting it
 * drives `connect()`, which opens the picker within the click's user gesture.
 * @type {string}
 */
const WEB_SERIAL_TARGET_ID = 'web-serial';

/**
 * A {@link Client} for the server-build (full-web) mode. It connects to and holds the board in the
 * browser via the Web Serial API — the API is a native browser global, not a bundled dependency, so
 * the logic lives in the VM (mirroring how `io/ble.js` holds BLE logic). This is the web-mode peer to
 * {@link LinkClient} (local helper).
 *
 * Wired incrementally, mirroring LinkClient: `listBoards`, `connect`, and `disconnect` are live today.
 * `compile` (server REST build), `flash` (esptool), and the serial monitor land in later milestones
 * and inherit the base throw until then.
 *
 * Discovery is not enumerable in Web Serial without a user gesture, so `listBoards()` returns nothing
 * and `connect()` opens the browser's native port picker instead.
 */
class CloudClient extends Client {
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
     * Web Serial cannot enumerate ports without a user gesture, so instead of a real list this returns
     * one synthetic target standing in for the browser's port picker, labelled with the selected
     * device. The GUI shows it as a single board tile; selecting it calls `connect()`, which opens the
     * native picker within that click's user gesture. Returns nothing when Web Serial is unavailable.
     * @param {Device} device - the selected device, used to label the entry.
     * @returns {Promise<Array.<ConnectionTarget>>} the single picker entry, or `[]` when unsupported.
     */
    listBoards (device) {
        if (!CloudClient.isSupported()) {
            log.error('CloudClient.listBoards: Web Serial unavailable — navigator.serial is missing. ' +
                'It requires a Chromium-based browser in a secure context (https:// or localhost).');
            return Promise.resolve([]);
        }
        log.info('CloudClient.listBoards: returning the browser-picker entry; ' +
            'selecting it opens the Web Serial port picker via connect()');
        return Promise.resolve([{id: WEB_SERIAL_TARGET_ID, name: device.getDeviceInfo().name}]);
    }

    /**
     * Open the native port picker, then open the chosen port. Requires a user gesture (the picker is
     * gesture-gated by the browser). Emits `DEVICE_CONNECTED` on success.
     * @param {?{filters: Array}} [target] - optional Web Serial filters (see `filtersFromDevice`); when
     *   omitted, the picker shows all serial ports.
     * @returns {Promise<void>} resolves once the port is open.
     */
    async connect (target = null) {
        if (!CloudClient.isSupported()) {
            log.error('CloudClient.connect: Web Serial unavailable — navigator.serial is missing. ' +
                'It requires a Chromium-based browser in a secure context (https:// or localhost).');
            throw new Error('Web Serial is not available in this browser');
        }
        const filters = (target && target.filters) || [];
        log.info(`CloudClient.connect: opening the browser port picker (filters=${JSON.stringify(filters)})`);
        let port;
        try {
            port = await navigator.serial.requestPort({filters});
        } catch (err) {
            // A thrown NotFoundError here usually means the user dismissed the picker without choosing.
            log.warn(`CloudClient.connect: no port selected (${err.name}: ${err.message})`);
            throw err;
        }
        log.info(`CloudClient.connect: port selected, opening at ${DEFAULT_BAUD_RATE} baud`);
        try {
            await port.open({baudRate: DEFAULT_BAUD_RATE});
        } catch (err) {
            // On Linux this is often a permissions problem: add the user to the dialout/uucp group.
            log.error(`CloudClient.connect: failed to open the port (${err.name}: ${err.message})`);
            throw err;
        }
        this._port = port;
        this._connected = true;
        log.info('CloudClient.connect: connected');
        this.runtime.emit(this.runtime.constructor.DEVICE_CONNECTED);
    }

    /**
     * Close the port and release it. Safe to call when already disconnected. Emits `DEVICE_DISCONNECTED`.
     * @returns {Promise<void>} resolves once closed.
     */
    async disconnect () {
        if (!this._port) {
            log.info('CloudClient.disconnect: no open port; nothing to do');
            return;
        }
        log.info('CloudClient.disconnect: closing the port');
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
            throw new Error('CloudClient: no open port; call connect() first');
        }
        return this._port;
    }
}

module.exports = CloudClient;
