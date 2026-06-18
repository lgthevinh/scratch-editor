const ArgumentType = require('../../extension-support/argument-type');
const BlockType = require('../../extension-support/block-type');
const formatMessage = require('format-message');
const ThingBotTelemetrix = require('./thingbot-telemetrix');
const BLETransport = require('./transport/ble');
const codegen = require('./codegen');

// eslint-disable-next-line @stylistic/max-len
const blockIconURI = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIGZpbGw9ImhzbCgxNjMsIDg1JSwgNDAlKSIvPgogIDxnIHN0cm9rZT0id2hpdGUiIGZpbGw9Im5vbmUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+CiAgICA8cmVjdCB4PSIxMCIgeT0iMTAiIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgcng9IjIiIHN0cm9rZS13aWR0aD0iMS41IiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMTIpIi8+CiAgICA8cGF0aCBkPSJNIDE1LDEwIGEgNSw1IDAgMCwwIDEwLDAiIHN0cm9rZS13aWR0aD0iMS4yIi8+CiAgICA8bGluZSB4MT0iNiIgeTE9IjE1IiB4Mj0iMTAiIHkyPSIxNSIgc3Ryb2tlLXdpZHRoPSIxLjUiLz4KICAgIDxsaW5lIHgxPSI2IiB5MT0iMjAiIHgyPSIxMCIgeTI9IjIwIiBzdHJva2Utd2lkdGg9IjEuNSIvPgogICAgPGxpbmUgeDE9IjYiIHkxPSIyNSIgeDI9IjEwIiB5Mj0iMjUiIHN0cm9rZS13aWR0aD0iMS41Ii8+CiAgICA8bGluZSB4MT0iMzAiIHkxPSIxNSIgeDI9IjM0IiB5Mj0iMTUiIHN0cm9rZS13aWR0aD0iMS41Ii8+CiAgICA8bGluZSB4MT0iMzAiIHkxPSIyMCIgeDI9IjM0IiB5Mj0iMjAiIHN0cm9rZS13aWR0aD0iMS41Ii8+CiAgICA8bGluZSB4MT0iMzAiIHkxPSIyNSIgeDI9IjM0IiB5Mj0iMjUiIHN0cm9rZS13aWR0aD0iMS41Ii8+CiAgICA8bGluZSB4MT0iMTYiIHkxPSI2IiB4Mj0iMTYiIHkyPSIxMCIgc3Ryb2tlLXdpZHRoPSIxLjUiLz4KICAgIDxsaW5lIHgxPSIyNCIgeTE9IjYiIHgyPSIyNCIgeTI9IjEwIiBzdHJva2Utd2lkdGg9IjEuNSIvPgogICAgPGxpbmUgeDE9IjE2IiB5MT0iMzAiIHgyPSIxNiIgeTI9IjM0IiBzdHJva2Utd2lkdGg9IjEuNSIvPgogICAgPGxpbmUgeDE9IjI0IiB5MT0iMzAiIHgyPSIyNCIgeTI9IjM0IiBzdHJva2Utd2lkdGg9IjEuNSIvPgogIDwvZz4KPC9zdmc+';

const EXTENSION_ID = 'thingbotTelemetrix';

const {PIN_MODE, DHT_TYPE} = ThingBotTelemetrix;

const DigitalLevel = {
    HIGH: 'HIGH',
    LOW: 'LOW'
};

class ThingBotTelemetrixExtension {
    constructor (runtime) {
        this.runtime = runtime;
        this._telemetrix = new ThingBotTelemetrix(new BLETransport());
        this._pendingDevice = null;

        this.runtime.registerPeripheralExtension(EXTENSION_ID, this);
    }

    // ─── Peripheral interface ───

    scan () {
        this._pendingDevice = null;

        if (!navigator.bluetooth) {
            // eslint-disable-next-line no-console
            console.error('[ThingBot] Web Bluetooth not available — needs HTTPS or localhost, Chrome/Edge only');
            this.runtime.emit(this.runtime.constructor.PERIPHERAL_REQUEST_ERROR, {
                message: 'Web Bluetooth not available. Use HTTPS or localhost in Chrome/Edge.'
            });
            return;
        }

        this._telemetrix.scan()
            .then(device => {
                this._pendingDevice = device;
                this.runtime.emit(
                    this.runtime.constructor.PERIPHERAL_LIST_UPDATE,
                    {
                        [device.id]: {
                            name: device.name || 'ThingBot',
                            peripheralId: device.id,
                            rssi: 0
                        }
                    }
                );
            })
            .catch(err => {
                if (err.name !== 'NotFoundError') {
                    // eslint-disable-next-line no-console
                    console.error('[ThingBot] BLE scan error:', err);
                    this.runtime.emit(this.runtime.constructor.PERIPHERAL_REQUEST_ERROR, {
                        message: err.message
                    });
                }
            });
    }

    connect () {
        const device = this._pendingDevice;
        if (!device) {
            this.runtime.emit(this.runtime.constructor.PERIPHERAL_REQUEST_ERROR, {
                message: 'No device selected'
            });
            return;
        }
        this._telemetrix.connect(device, () => this._onDisconnect())
            .then(() => {
                this._pendingDevice = null;
                this.runtime.emit(this.runtime.constructor.PERIPHERAL_CONNECTED);
            })
            .catch(err => {
                this.runtime.emit(this.runtime.constructor.PERIPHERAL_REQUEST_ERROR, {
                    message: err.message
                });
            });
    }

    disconnect () {
        this._telemetrix.disconnect();
    }

    isConnected () {
        return this._telemetrix.isConnected();
    }

    _onDisconnect () {
        this.runtime.emit(this.runtime.constructor.PERIPHERAL_DISCONNECTED);
    }

    // ─── Extension metadata ───

    getInfo () {
        return {
            id: EXTENSION_ID,
            name: formatMessage({
                id: 'thingbotTelemetrix.name',
                default: 'ThingBot Telemetrix',
                description: 'Name of the ThingBot Telemetrix extension'
            }),
            blockIconURI,
            blocks: [
                // ── GPIO ──
                {
                    opcode: 'setPinMode',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'thingbotTelemetrix.setPinMode',
                        default: 'set pin [PIN] mode [MODE]',
                        description: 'Set the mode of a digital pin'
                    }),
                    arguments: {
                        PIN: {type: ArgumentType.NUMBER, defaultValue: 13},
                        MODE: {
                            type: ArgumentType.STRING,
                            menu: 'PIN_MODE',
                            defaultValue: 'OUTPUT'
                        }
                    }
                },
                {
                    opcode: 'digitalWrite',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'thingbotTelemetrix.digitalWrite',
                        default: 'digital write pin [PIN] [LEVEL]',
                        description: 'Write a digital HIGH or LOW value to a pin'
                    }),
                    arguments: {
                        PIN: {type: ArgumentType.NUMBER, defaultValue: 13},
                        LEVEL: {
                            type: ArgumentType.STRING,
                            menu: 'DIGITAL_LEVEL',
                            defaultValue: DigitalLevel.HIGH
                        }
                    }
                },
                {
                    opcode: 'digitalRead',
                    blockType: BlockType.REPORTER,
                    text: formatMessage({
                        id: 'thingbotTelemetrix.digitalRead',
                        default: 'digital read pin [PIN]',
                        description: 'Read the digital value (0 or 1) from a pin'
                    }),
                    arguments: {
                        PIN: {type: ArgumentType.NUMBER, defaultValue: 2}
                    }
                },
                {
                    opcode: 'analogRead',
                    blockType: BlockType.REPORTER,
                    text: formatMessage({
                        id: 'thingbotTelemetrix.analogRead',
                        default: 'analog read pin [PIN]',
                        description: 'Read the analog value (0–1023) from a pin'
                    }),
                    arguments: {
                        PIN: {type: ArgumentType.NUMBER, defaultValue: 0}
                    }
                },
                {
                    opcode: 'pwmWrite',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'thingbotTelemetrix.pwmWrite',
                        default: 'PWM write pin [PIN] value [VALUE]',
                        description: 'Write a PWM value (0–255) to a pin'
                    }),
                    arguments: {
                        PIN: {type: ArgumentType.NUMBER, defaultValue: 9},
                        VALUE: {type: ArgumentType.NUMBER, defaultValue: 128}
                    }
                },
                // ── Servo ──
                {
                    opcode: 'servoWrite',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'thingbotTelemetrix.servoWrite',
                        default: 'servo [SERVO_ID] angle [ANGLE]',
                        description: 'Set a servo to an angle (0–180)'
                    }),
                    arguments: {
                        SERVO_ID: {
                            type: ArgumentType.STRING,
                            menu: 'SERVO_ID',
                            defaultValue: '1'
                        },
                        ANGLE: {type: ArgumentType.NUMBER, defaultValue: 90}
                    }
                },
                // ── DC Motor ──
                {
                    opcode: 'controlDC',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'thingbotTelemetrix.controlDC',
                        default: 'motor [MOTOR_ID] speed [SPEED]',
                        description: 'Set a DC motor speed (0–100)'
                    }),
                    arguments: {
                        MOTOR_ID: {
                            type: ArgumentType.STRING,
                            menu: 'MOTOR_ID',
                            defaultValue: '1'
                        },
                        SPEED: {type: ArgumentType.NUMBER, defaultValue: 50}
                    }
                },
                // ── Buzzer ──
                {
                    opcode: 'controlBuzzer',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'thingbotTelemetrix.controlBuzzer',
                        default: 'buzzer frequency [FREQ]',
                        description: 'Set buzzer frequency (0 = off, 1–100)'
                    }),
                    arguments: {
                        FREQ: {type: ArgumentType.NUMBER, defaultValue: 50}
                    }
                },
                // ── LED ──
                {
                    opcode: 'controlLED',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'thingbotTelemetrix.controlLED',
                        default: 'LED [LED_ID] [LED_STATE]',
                        description: 'Turn a ThingBot LED on or off'
                    }),
                    arguments: {
                        LED_ID: {
                            type: ArgumentType.STRING,
                            menu: 'LED_ID',
                            defaultValue: '1'
                        },
                        LED_STATE: {
                            type: ArgumentType.STRING,
                            menu: 'LED_STATE',
                            defaultValue: 'on'
                        }
                    }
                },
                // ── Ultrasonic ──
                {
                    opcode: 'setupUltrasonic',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'thingbotTelemetrix.setupUltrasonic',
                        default: 'setup ultrasonic trigger [TRIG] echo [ECHO]',
                        description: 'Configure an HC-SR04 ultrasonic sensor'
                    }),
                    arguments: {
                        TRIG: {type: ArgumentType.NUMBER, defaultValue: 7},
                        ECHO: {type: ArgumentType.NUMBER, defaultValue: 8}
                    }
                },
                {
                    opcode: 'readDistance',
                    blockType: BlockType.REPORTER,
                    text: formatMessage({
                        id: 'thingbotTelemetrix.readDistance',
                        default: 'ultrasonic distance (cm)',
                        description: 'Read the latest ultrasonic distance in centimetres'
                    }),
                    arguments: {}
                },
                // ── DHT ──
                {
                    opcode: 'setupDHT',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'thingbotTelemetrix.setupDHT',
                        default: 'setup [DHT_TYPE] sensor on pin [PIN]',
                        description: 'Configure a DHT temperature/humidity sensor'
                    }),
                    arguments: {
                        DHT_TYPE: {
                            type: ArgumentType.STRING,
                            menu: 'DHT_TYPE',
                            defaultValue: 'DHT11'
                        },
                        PIN: {type: ArgumentType.NUMBER, defaultValue: 4}
                    }
                },
                {
                    opcode: 'readTemperature',
                    blockType: BlockType.REPORTER,
                    text: formatMessage({
                        id: 'thingbotTelemetrix.readTemperature',
                        default: 'temperature (°C) on pin [PIN]',
                        description: 'Read the latest temperature from a DHT sensor'
                    }),
                    arguments: {
                        PIN: {type: ArgumentType.NUMBER, defaultValue: 4}
                    }
                },
                {
                    opcode: 'readHumidity',
                    blockType: BlockType.REPORTER,
                    text: formatMessage({
                        id: 'thingbotTelemetrix.readHumidity',
                        default: 'humidity (%) on pin [PIN]',
                        description: 'Read the latest humidity from a DHT sensor'
                    }),
                    arguments: {
                        PIN: {type: ArgumentType.NUMBER, defaultValue: 4}
                    }
                }
            ],
            menus: {
                PIN_MODE: {
                    acceptReporters: false,
                    items: [
                        {text: 'INPUT', value: 'INPUT'},
                        {text: 'OUTPUT', value: 'OUTPUT'},
                        {text: 'INPUT_PULLUP', value: 'INPUT_PULLUP'}
                    ]
                },
                DIGITAL_LEVEL: {
                    acceptReporters: false,
                    items: [
                        {text: 'HIGH', value: DigitalLevel.HIGH},
                        {text: 'LOW', value: DigitalLevel.LOW}
                    ]
                },
                SERVO_ID: {
                    acceptReporters: false,
                    items: [
                        {text: 'S1', value: '1'},
                        {text: 'S2', value: '2'},
                        {text: 'S3', value: '3'},
                        {text: 'S4', value: '4'},
                        {text: 'S5', value: '5'}
                    ]
                },
                MOTOR_ID: {
                    acceptReporters: false,
                    items: [
                        {text: 'M1', value: '1'},
                        {text: 'M2', value: '2'},
                        {text: 'M3', value: '3'},
                        {text: 'M4', value: '4'}
                    ]
                },
                LED_ID: {
                    acceptReporters: false,
                    items: [
                        {text: 'LED 1', value: '1'},
                        {text: 'LED 2', value: '2'}
                    ]
                },
                LED_STATE: {
                    acceptReporters: false,
                    items: [
                        {text: 'on', value: 'on'},
                        {text: 'off', value: 'off'}
                    ]
                },
                DHT_TYPE: {
                    acceptReporters: false,
                    items: [
                        {text: 'DHT11', value: 'DHT11'},
                        {text: 'DHT22', value: 'DHT22'}
                    ]
                }
            }
        };
    }

    getCodeGenerators () {
        return codegen.getCodeGenerators();
    }

    // ─── Block handlers ───

    setPinMode ({PIN, MODE}) {
        const pin = parseInt(PIN, 10);
        const mode = PIN_MODE[MODE] ?? PIN_MODE.OUTPUT;
        this._telemetrix.setPinMode(pin, mode);
        return Promise.resolve();
    }

    digitalWrite ({PIN, LEVEL}) {
        const pin = parseInt(PIN, 10);
        const value = LEVEL === DigitalLevel.HIGH ? 1 : 0;
        this._telemetrix.digitalWrite(pin, value);
        return Promise.resolve();
    }

    digitalRead ({PIN}) {
        return this._telemetrix.digitalRead(parseInt(PIN, 10));
    }

    analogRead ({PIN}) {
        return this._telemetrix.analogRead(parseInt(PIN, 10));
    }

    pwmWrite ({PIN, VALUE}) {
        const pin = parseInt(PIN, 10);
        const val = Math.max(0, Math.min(255, Math.round(Number(VALUE))));
        this._telemetrix.pwmWrite(pin, val);
        return Promise.resolve();
    }

    servoWrite ({SERVO_ID, ANGLE}) {
        const servoId = parseInt(SERVO_ID, 10);
        const angle = Math.max(0, Math.min(180, Math.round(Number(ANGLE))));
        this._telemetrix.servoWrite(servoId, angle);
        return Promise.resolve();
    }

    controlDC ({MOTOR_ID, SPEED}) {
        const motorId = parseInt(MOTOR_ID, 10);
        const speed = Math.max(0, Math.min(100, Math.round(Number(SPEED))));
        this._telemetrix.controlDC(motorId, speed);
        return Promise.resolve();
    }

    controlBuzzer ({FREQ}) {
        const freq = Math.max(0, Math.min(100, Math.round(Number(FREQ))));
        this._telemetrix.controlBuzzer(freq);
        return Promise.resolve();
    }

    controlLED ({LED_ID, LED_STATE}) {
        const ledId = parseInt(LED_ID, 10);
        const state = LED_STATE === 'on' ? 100 : 0;
        this._telemetrix.controlLED(ledId, state);
        return Promise.resolve();
    }

    setupUltrasonic ({TRIG, ECHO}) {
        this._telemetrix.setupUltrasonic(parseInt(TRIG, 10), parseInt(ECHO, 10));
        return Promise.resolve();
    }

    readDistance () {
        return this._telemetrix.readDistance();
    }

    setupDHT ({DHT_TYPE: type, PIN}) {
        const pin = parseInt(PIN, 10);
        const dhtType = DHT_TYPE[type] ?? DHT_TYPE.DHT11;
        this._telemetrix.setupDHT(pin, dhtType);
        return Promise.resolve();
    }

    readTemperature ({PIN}) {
        return this._telemetrix.readTemperature(parseInt(PIN, 10));
    }

    readHumidity ({PIN}) {
        return this._telemetrix.readHumidity(parseInt(PIN, 10));
    }
}

ThingBotTelemetrixExtension.getCodeGenerators = codegen.getCodeGenerators;

module.exports = ThingBotTelemetrixExtension;
