/**
 * How a device connects to the host. The device-selection card maps each value to a "Requires"
 * icon and label.
 * @readonly
 * @enum {string}
 */
const ConnectionType = {
    SERIAL: 'serial',
    BLE: 'ble',
    USB: 'usb'
};

module.exports = ConnectionType;
