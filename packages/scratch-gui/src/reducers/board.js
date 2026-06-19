const SET_DEVICE = 'scratch-gui/board/SET_DEVICE';

const initialState = {
    selectedDeviceId: null
};

const reducer = function (state = initialState, action) {
    switch (action.type) {
    case SET_DEVICE:
        return {...state, selectedDeviceId: action.deviceId};
    default:
        return state;
    }
};

const setDevice = deviceId => ({
    type: SET_DEVICE,
    deviceId
});

export {
    reducer as default,
    initialState as boardInitialState,
    setDevice
};
