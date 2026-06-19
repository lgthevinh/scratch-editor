import React from 'react';
import {FormattedMessage} from 'react-intl';

import arduinoUnoIconURL from './arduino-uno.svg';
import arduinoNanoIconURL from './arduino-nano.svg';
import esp32IconURL from './esp32.svg';
import noBoardIconURL from './no-board.svg';

// Mock board catalog used by the board-selection dialog. Replace/extend with the
// real board registry (FQBN, pin maps, toolchain) when upload mode is wired up.
export default [
    {
        name: 'No board',
        boardId: null,
        iconURL: noBoardIconURL,
        description: (
            <FormattedMessage
                defaultMessage="Run in host mode without a board. Code runs in the browser."
                description="Description for the option that deselects the board and runs in host mode"
                id="gui.boardLibrary.noBoard.description"
            />
        ),
        featured: true
    },
    {
        name: 'Arduino Uno',
        boardId: 'arduino:avr:uno',
        iconURL: arduinoUnoIconURL,
        description: (
            <FormattedMessage
                defaultMessage="Classic ATmega328P board. A great starting point."
                description="Description for the Arduino Uno board"
                id="gui.boardLibrary.arduinoUno.description"
            />
        ),
        featured: true
    },
    {
        name: 'Arduino Nano',
        boardId: 'arduino:avr:nano',
        iconURL: arduinoNanoIconURL,
        description: (
            <FormattedMessage
                defaultMessage="Compact ATmega328P board for small projects."
                description="Description for the Arduino Nano board"
                id="gui.boardLibrary.arduinoNano.description"
            />
        ),
        featured: true
    },
    {
        name: 'ESP32 Dev Module',
        boardId: 'esp32:esp32:esp32',
        iconURL: esp32IconURL,
        description: (
            <FormattedMessage
                defaultMessage="Wi-Fi and Bluetooth capable dual-core board."
                description="Description for the ESP32 Dev Module board"
                id="gui.boardLibrary.esp32.description"
            />
        ),
        featured: true
    }
];
