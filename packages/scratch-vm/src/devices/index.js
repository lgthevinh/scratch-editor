const Device = require('./device');
const DeviceRegistry = require('./device-registry');
const DeviceExtensionRegistry = require('./device-extension-registry');
const PeripheralRegistry = require('./peripheral-registry');
const ManifestDevice = require('./manifest-device');

/**
 * The device framework: the `Device` base contract, the `DeviceRegistry`, `ManifestDevice` (the
 * data-driven device for helper-served resource packs), the `DeviceExtensionRegistry` (the active
 * device's hidden extension), and the `PeripheralRegistry` (the active device's reusable component
 * packs). Concrete boards live under `extensions/devices/` and are aggregated there; constructing each
 * with the runtime and registering it is left to the wiring step that owns the runtime.
 */
module.exports = {
    Device,
    DeviceRegistry,
    DeviceExtensionRegistry,
    PeripheralRegistry,
    ManifestDevice
};
