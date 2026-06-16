// Firmware command IDs (protocol.h + ThingBotExtended.h)
const CMD = {
    SET_PIN_MODE: 1,
    DIGITAL_WRITE: 2,
    DIGITAL_READ: 3,
    ANALOG_WRITE: 4,
    ANALOG_READ: 5,
    READ_ULTRASONIC: 7,
    DC_WRITE: 101,
    SERVO_WRITE: 102,
    BUZZER_WRITE: 103,
    LED_WRITE: 104
};

// Firmware report IDs (protocol.h + ThingBotExtended.h)
const REPORT = {
    DIGITAL: 2,
    ANALOG: 4,
    ULTRASONIC: 7,
    DHT: 11,
    THINGBOT_SW: 102
};

// Pin mode constants (Arduino.h + pin_state.h)
const PIN_MODE = {
    INPUT: 0,
    OUTPUT: 1,
    INPUT_PULLUP: 2,
    DHT: 0x11,
    ULTRASONIC: 0x12
};

const DHT_TYPE = {
    DHT11: 11,
    DHT22: 22
};

class ThingBotTelemetrix {
    constructor (transport) {
        this._transport = transport;
        this._pinValues = {};
        this._dhtValues = {};
        this._ultrasonicDistance = null;
        this._unsubscribe = null;
    }

    // ─── Transport wrappers ───

    scan () {
        return this._transport.scan();
    }

    connect (device, onDisconnect) {
        return this._transport.connect(device, () => {
            this._resetState();
            if (onDisconnect) onDisconnect();
        }).then(() => {
            this._unsubscribe = this._transport.onReport(r => this._onReport(r));
        });
    }

    disconnect () {
        if (this._unsubscribe) {
            this._unsubscribe();
            this._unsubscribe = null;
        }
        this._transport.disconnect();
    }

    isConnected () {
        return this._transport.isConnected();
    }

    sendCommand (commandId, ...args) {
        const packet = new Uint8Array([1 + args.length, commandId, ...args]);
        this._transport.send(packet);
    }

    _resetState () {
        if (this._unsubscribe) {
            this._unsubscribe();
            this._unsubscribe = null;
        }
        this._pinValues = {};
        this._dhtValues = {};
        this._ultrasonicDistance = null;
    }

    // ─── Incoming report handler ───

    _onReport ({id, data}) {
        if (id === REPORT.DIGITAL && data.length >= 2) {
            // [pin, value]
            this._pinValues[`d${data[0]}`] = data[1];
        } else if (id === REPORT.ANALOG && data.length >= 3) {
            // [pin, msb, lsb]
            this._pinValues[`a${data[0]}`] = (data[1] << 8) | data[2];
        } else if (id === REPORT.ULTRASONIC && data.length >= 4) {
            // [echo_pin, trigger_pin, dist_msb, dist_lsb]
            this._ultrasonicDistance = (data[2] << 8) | data[3];
        } else if (id === REPORT.DHT && data.length >= 5) {
            // [pin, hum_msb, hum_lsb, temp_msb, temp_lsb]
            const pin = data[0];
            this._dhtValues[pin] = {
                humidity: ((data[1] << 8) | data[2]) / 100,
                temperature: ((data[3] << 8) | data[4]) / 100
            };
        }
    }

    // ─── GPIO API ───

    setPinMode (pin, mode) {
        if (mode === PIN_MODE.OUTPUT) {
            this.sendCommand(CMD.SET_PIN_MODE, pin, mode);
        } else {
            // INPUT / INPUT_PULLUP: enable continuous reporting
            this.sendCommand(CMD.SET_PIN_MODE, pin, mode, 1);
        }
    }

    digitalWrite (pin, value) {
        this.sendCommand(CMD.DIGITAL_WRITE, pin, value);
    }

    digitalRead (pin) {
        this.sendCommand(CMD.DIGITAL_READ, pin);
        return this._pinValues[`d${pin}`] ?? 0;
    }

    analogRead (pin) {
        this.sendCommand(CMD.ANALOG_READ, pin);
        return this._pinValues[`a${pin}`] ?? 0;
    }

    pwmWrite (pin, value) {
        // ANALOG_WRITE takes [pin, msb, lsb]; value ≤ 255 so msb is always 0
        this.sendCommand(CMD.ANALOG_WRITE, pin, 0, value);
    }

    // ─── ThingBot peripheral API ───

    servoWrite (servoId, angle) {
        this.sendCommand(CMD.SERVO_WRITE, servoId, angle);
    }

    controlDC (motorId, speed) {
        this.sendCommand(CMD.DC_WRITE, motorId, speed);
    }

    controlBuzzer (frequency) {
        this.sendCommand(CMD.BUZZER_WRITE, frequency);
    }

    controlLED (ledId, state) {
        this.sendCommand(CMD.LED_WRITE, ledId, state);
    }

    // ─── Ultrasonic API ───

    setupUltrasonic (triggerPin, echoPin) {
        this.sendCommand(CMD.SET_PIN_MODE, triggerPin, PIN_MODE.ULTRASONIC, echoPin);
    }

    readDistance () {
        this.sendCommand(CMD.READ_ULTRASONIC);
        return this._ultrasonicDistance ?? 0;
    }

    // ─── DHT API ───

    setupDHT (pin, dhtType) {
        this.sendCommand(CMD.SET_PIN_MODE, pin, PIN_MODE.DHT, dhtType);
    }

    readTemperature (pin) {
        return this._dhtValues[pin]?.temperature ?? 0;
    }

    readHumidity (pin) {
        return this._dhtValues[pin]?.humidity ?? 0;
    }
}

ThingBotTelemetrix.CMD = CMD;
ThingBotTelemetrix.REPORT = REPORT;
ThingBotTelemetrix.PIN_MODE = PIN_MODE;
ThingBotTelemetrix.DHT_TYPE = DHT_TYPE;

module.exports = ThingBotTelemetrix;
