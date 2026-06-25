const arduinoUno = require('./arduino-uno');
const arduinoNano = require('./arduino-nano');
const esp32 = require('./esp32');
const esp32c3 = require('./esp32-c3');

/**
 * Every board manifest. Each entry is `{ id, iconURL, Device, Extension? }`; boards that inherit
 * everything from the common-board layer carry only presentation and `Device` data. `deviceClasses`
 * is the flat list the runtime constructs and registers in the DeviceRegistry.
 */
const boards = [
    arduinoUno,
    arduinoNano,
    esp32,
    esp32c3
];

module.exports = {
    boards,
    deviceClasses: boards.map(board => board.Device)
};
