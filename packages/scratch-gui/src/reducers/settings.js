import {detectColorMode} from '../lib/settings/color-mode/persistence';
import {detectLinkMode} from '../lib/settings/link-mode/persistence';
import {detectTheme} from '../lib/settings/theme/persistence';

const SET_COLOR_MODE = 'scratch-gui/settings/SET_COLOR_MODE';
const SET_LINK_MODE = 'scratch-gui/settings/SET_LINK_MODE';
const SET_THEME = 'scratch-gui/settings/SET_THEME';

const initialState = {
    colorMode: detectColorMode(),
    linkMode: detectLinkMode(),
    theme: detectTheme()
};

const reducer = (state = initialState, action) => {
    switch (action.type) {
    case SET_COLOR_MODE:
        return {...state, colorMode: action.colorMode};
    case SET_LINK_MODE:
        return {...state, linkMode: action.linkMode};
    case SET_THEME:
        return {...state, theme: action.theme};
    default:
        return state;
    }
};

const setColorMode = colorMode => ({
    type: SET_COLOR_MODE,
    colorMode
});

const setLinkMode = linkMode => ({
    type: SET_LINK_MODE,
    linkMode
});

const setTheme = theme => ({
    type: SET_THEME,
    theme
});

export {
    reducer as default,
    initialState as settingsInitialState,
    setColorMode,
    setLinkMode,
    setTheme
};
