const ArgumentType = require('../../extension-support/argument-type');
const BlockType = require('../../extension-support/block-type');
const formatMessage = require('format-message');
const codegen = require('./codegen');

const EXTENSION_ID = 'arduino';

const PinMode = {
    INPUT: 'INPUT',
    OUTPUT: 'OUTPUT',
    INPUT_PULLUP: 'INPUT_PULLUP'
};

const DigitalLevel = {
    HIGH: 'HIGH',
    LOW: 'LOW'
};

/**
 * The standard Arduino API shared by every Arduino-compatible board: GPIO, PWM, and delay. These
 * blocks exist only when a board is selected (board mode); the GUI gates the category by board
 * selection and codegen targets arduino-cpp. The block handler methods are no-ops because the
 * intended path is firmware generation/upload, not host execution. Board-specific extensions layer
 * on top of and may override these.
 */
class CommonBoard {
    constructor (runtime) {
        this.runtime = runtime;
    }

    getInfo () {
        return {
            id: EXTENSION_ID,
            name: formatMessage({
                id: 'arduino.name',
                default: 'Arduino',
                description: 'Name of the Arduino board extension'
            }),
            blocks: [
                {
                    opcode: 'pinMode',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'arduino.pinMode',
                        default: 'set pin [PIN] mode [MODE]',
                        description: 'Configure a digital pin as input or output'
                    }),
                    arguments: {
                        PIN: {type: ArgumentType.NUMBER, defaultValue: 13},
                        MODE: {type: ArgumentType.STRING, menu: 'PIN_MODE', defaultValue: PinMode.OUTPUT}
                    }
                },
                {
                    opcode: 'digitalWrite',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'arduino.digitalWrite',
                        default: 'digital write pin [PIN] [LEVEL]',
                        description: 'Write a digital level to a pin'
                    }),
                    arguments: {
                        PIN: {type: ArgumentType.NUMBER, defaultValue: 13},
                        LEVEL: {type: ArgumentType.STRING, menu: 'DIGITAL_LEVEL', defaultValue: DigitalLevel.HIGH}
                    }
                },
                {
                    opcode: 'digitalRead',
                    blockType: BlockType.REPORTER,
                    text: formatMessage({
                        id: 'arduino.digitalRead',
                        default: 'read digital pin [PIN]',
                        description: 'Read the digital level of a pin'
                    }),
                    arguments: {
                        PIN: {type: ArgumentType.NUMBER, defaultValue: 2}
                    }
                },
                {
                    opcode: 'analogWrite',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'arduino.analogWrite',
                        default: 'analog write pin [PIN] value [VALUE]',
                        description: 'Write a PWM value to a pin'
                    }),
                    arguments: {
                        PIN: {type: ArgumentType.NUMBER, defaultValue: 9},
                        VALUE: {type: ArgumentType.NUMBER, defaultValue: 128}
                    }
                },
                {
                    opcode: 'analogRead',
                    blockType: BlockType.REPORTER,
                    text: formatMessage({
                        id: 'arduino.analogRead',
                        default: 'read analog pin [PIN]',
                        description: 'Read the analog value of a pin'
                    }),
                    arguments: {
                        PIN: {type: ArgumentType.NUMBER, defaultValue: 0}
                    }
                },
                {
                    opcode: 'delay',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'arduino.delay',
                        default: 'delay [MS] ms',
                        description: 'Pause for a number of milliseconds'
                    }),
                    arguments: {
                        MS: {type: ArgumentType.NUMBER, defaultValue: 1000}
                    }
                }
            ],
            menus: {
                PIN_MODE: {
                    acceptReporters: false,
                    items: [
                        {text: 'INPUT', value: PinMode.INPUT},
                        {text: 'OUTPUT', value: PinMode.OUTPUT},
                        {text: 'INPUT_PULLUP', value: PinMode.INPUT_PULLUP}
                    ]
                },
                DIGITAL_LEVEL: {
                    acceptReporters: false,
                    items: [
                        {text: 'HIGH', value: DigitalLevel.HIGH},
                        {text: 'LOW', value: DigitalLevel.LOW}
                    ]
                }
            }
        };
    }

    getCodeGenerators () {
        return codegen.getCodeGenerators();
    }

    // ─── Block handlers (no-op: blocks target firmware, not host execution) ───

    pinMode () {}

    digitalWrite () {}

    digitalRead () {
        return 0;
    }

    analogWrite () {}

    analogRead () {
        return 0;
    }

    delay () {}
}

CommonBoard.getCodeGenerators = codegen.getCodeGenerators;

module.exports = CommonBoard;
