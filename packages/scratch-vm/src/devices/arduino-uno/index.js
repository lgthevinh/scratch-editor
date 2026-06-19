const formatMessage = require('format-message');
const Device = require('../device');
const ConnectionType = require('../connection-type');

/**
 * Arduino Uno (ATmega328P) device.
 */
class ArduinoUno extends Device {
    get deviceId () {
        return 'arduinoUno';
    }

    getDeviceInfo () {
        return {
            name: formatMessage({
                id: 'device.arduinoUno.name',
                default: 'Arduino Uno',
                description: 'Name of the Arduino Uno device'
            }),
            description: formatMessage({
                id: 'device.arduinoUno.description',
                default: 'The classic ATmega328P board — a great place to start.',
                description: 'Description of the Arduino Uno device'
            }),
            manufacturer: 'arduino.cc',
            requires: ConnectionType.SERIAL,
            learnMore: 'https://docs.arduino.cc/hardware/uno-rev3',
            help: 'https://support.arduino.cc'
        };
    }

    get fqbn () {
        return 'arduino:avr:uno';
    }

    getCompileConfig () {
        return {options: {}};
    }

    getUploadConfig () {
        return {
            pnpid: [
                'USB\\VID_2341&PID_0043',
                'USB\\VID_2341&PID_0001'
            ],
            uploadSpeed: 115200
        };
    }
}

module.exports = ArduinoUno;
