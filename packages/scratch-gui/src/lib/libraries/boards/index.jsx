import React from 'react';
import {FormattedMessage} from 'react-intl';

import arduinoUnoIconURL from './arduino-uno.svg';
import arduinoNanoIconURL from './arduino-nano.svg';
import esp32IconURL from './esp32.svg';
import noBoardIconURL from './no-board.svg';

// Board photos for the device-selection card, keyed by VM deviceId. The device list itself
// (which devices exist, names, descriptions, links) comes from vm.getDeviceList(); this only
// supplies the icon, which the VM can't carry.
const deviceIcons = {
    arduinoUno: arduinoUnoIconURL,
    arduinoNano: arduinoNanoIconURL,
    esp32: esp32IconURL
};

// GUI-only "host mode" tile: deselects the device and runs in the browser. Not a VM device, so it
// carries its own presentation here.
const noBoardTile = {
    deviceId: null,
    iconURL: noBoardIconURL,
    name: (
        <FormattedMessage
            defaultMessage="No board"
            description="Device card title for running without a board (host mode)"
            id="gui.boardLibrary.noBoard.name"
        />
    ),
    description: (
        <FormattedMessage
            defaultMessage="Run in the browser without a board."
            description="Device card description for host mode"
            id="gui.boardLibrary.noBoard.description"
        />
    )
};

export {
    deviceIcons,
    noBoardTile
};
