const SET_DEVICE = 'scratch-gui/board/SET_DEVICE';
const SET_CONNECTED_BOARD = 'scratch-gui/board/SET_CONNECTED_BOARD';

const initialState = {
    selectedDeviceId: null,
    // The connected board target `{id, name}`, or null when no board is connected.
    connectedBoard: null
};

const reducer = function (state = initialState, action) {
    switch (action.type) {
    case SET_DEVICE:
        return {...state, selectedDeviceId: action.deviceId};
    case SET_CONNECTED_BOARD:
        return {...state, connectedBoard: action.board};
    default:
        return state;
    }
};

const setDevice = deviceId => ({
    type: SET_DEVICE,
    deviceId
});

const setConnectedBoard = board => ({
    type: SET_CONNECTED_BOARD,
    board
});

export {
    reducer as default,
    initialState as boardInitialState,
    setDevice,
    setConnectedBoard
};
