const Esp32 = require('./device');
const iconURL = require('./assets/icon.svg');

/**
 * ESP32 Dev Module board manifest. Data only for now — it inherits the standard Arduino API from
 * the common-board layer. ESP32-specific blocks would be added here; ESP32 codegen overrides live
 * in scratch-blocks (a resource pack registering against the Blockly ArduinoGenerator).
 */
module.exports = {
    id: 'esp32',
    iconURL,
    Device: Esp32
};
