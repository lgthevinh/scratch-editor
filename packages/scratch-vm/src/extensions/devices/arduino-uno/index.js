const ArduinoUno = require('./device');
const iconURL = require('./assets/icon.svg');

/**
 * Arduino Uno board manifest. Data only — it inherits the standard Arduino API blocks from the
 * common-board layer, so it needs no Extension of its own.
 */
module.exports = {
    id: 'arduinoUno',
    iconURL,
    Device: ArduinoUno
};
