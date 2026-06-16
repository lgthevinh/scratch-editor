const BaseTransport = require('./base');

const SERVICE_UUID = 'aa700001-8f6a-4e2c-b369-4060e0bb33aa';
const RX_CHAR_UUID = 'aa700002-8f6a-4e2c-b369-4060e0bb33aa'; // browser → device
const TX_CHAR_UUID = 'aa700003-8f6a-4e2c-b369-4060e0bb33aa'; // device → browser (notify)

const CMD_ARE_YOU_THERE = 6;
const REPORT_I_AM_HERE = 6;
const HANDSHAKE_TIMEOUT = 5000;

class BLETransport extends BaseTransport {
    constructor () {
        super();
        this._rxChar = null;
        this._txChar = null;
        this._connected = false;
        this._device = null;
        this._reportHandlers = [];
        this._disconnectCallback = null;
        this._onNotify = this._onNotify.bind(this);
        this._onDeviceDisconnect = this._onDeviceDisconnect.bind(this);
    }

    scan () {
        return navigator.bluetooth.requestDevice({
            filters: [{services: [SERVICE_UUID]}]
        });
    }

    async connect (device, onDisconnect) {
        this._disconnectCallback = onDisconnect;
        device.addEventListener('gattserverdisconnected', this._onDeviceDisconnect);

        const server = await device.gatt.connect();
        const service = await server.getPrimaryService(SERVICE_UUID);

        this._rxChar = await service.getCharacteristic(RX_CHAR_UUID);
        this._txChar = await service.getCharacteristic(TX_CHAR_UUID);

        await this._txChar.startNotifications();
        this._txChar.addEventListener('characteristicvaluechanged', this._onNotify);

        await this._handshake();
        this._connected = true;
        this._device = device;
    }

    send (packet) {
        if (!this._rxChar) return;
        this._rxChar.writeValueWithoutResponse(packet).catch(() => {});
    }

    onReport (handler) {
        this._reportHandlers.push(handler);
        return () => {
            this._reportHandlers = this._reportHandlers.filter(h => h !== handler);
        };
    }

    disconnect () {
        if (this._device && this._device.gatt.connected) {
            this._device.gatt.disconnect();
        }
        this._cleanup();
    }

    isConnected () {
        return this._connected;
    }

    _handshake () {
        return new Promise((resolve, reject) => {
            const ctx = {};

            ctx.handler = report => {
                if (report.id === REPORT_I_AM_HERE) {
                    clearTimeout(ctx.timeout);
                    this._reportHandlers = this._reportHandlers.filter(h => h !== ctx.handler);
                    resolve();
                }
            };

            ctx.timeout = setTimeout(() => {
                this._reportHandlers = this._reportHandlers.filter(h => h !== ctx.handler);
                reject(new Error('ThingBot handshake timeout'));
            }, HANDSHAKE_TIMEOUT);

            this._reportHandlers.push(ctx.handler);
            this.send(new Uint8Array([1, CMD_ARE_YOU_THERE]));
        });
    }

    _onNotify (event) {
        const dv = event.target.value;
        if (dv.byteLength < 2) return;
        const length = dv.getUint8(0);
        const id = dv.getUint8(1);
        const data = [];
        for (let i = 2; i < 1 + length; i++) {
            data.push(dv.getUint8(i));
        }
        this._reportHandlers.forEach(h => h({id, data}));
    }

    _onDeviceDisconnect () {
        this._cleanup();
        if (this._disconnectCallback) this._disconnectCallback();
    }

    _cleanup () {
        this._connected = false;
        this._rxChar = null;
        this._txChar = null;
        this._device = null;
    }
}

module.exports = BLETransport;
