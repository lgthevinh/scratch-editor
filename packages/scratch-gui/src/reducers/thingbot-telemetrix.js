const THINGBOT_LOADED = 'scratch-gui/thingbot-telemetrix/LOADED';
const THINGBOT_CONNECT_START = 'scratch-gui/thingbot-telemetrix/CONNECT_START';
const THINGBOT_CONNECT_SUCCESS = 'scratch-gui/thingbot-telemetrix/CONNECT_SUCCESS';
const THINGBOT_DISCONNECT = 'scratch-gui/thingbot-telemetrix/DISCONNECT';

const initialState = {
    loaded: false,
    connected: false,
    connecting: false
};

const reducer = function (state = initialState, action) {
    switch (action.type) {
    case THINGBOT_LOADED:
        return {...state, loaded: true};
    case THINGBOT_CONNECT_START:
        return {...state, connecting: true, connected: false};
    case THINGBOT_CONNECT_SUCCESS:
        return {...state, connecting: false, connected: true};
    case THINGBOT_DISCONNECT:
        return {...state, connecting: false, connected: false};
    default:
        return state;
    }
};

const thingbotLoaded = () => ({type: THINGBOT_LOADED});
const thingbotConnectStart = () => ({type: THINGBOT_CONNECT_START});
const thingbotConnectSuccess = () => ({type: THINGBOT_CONNECT_SUCCESS});
const thingbotDisconnect = () => ({type: THINGBOT_DISCONNECT});

export {
    reducer as default,
    initialState as thingbotTelemetrixInitialState,
    thingbotLoaded,
    thingbotConnectStart,
    thingbotConnectSuccess,
    thingbotDisconnect
};
