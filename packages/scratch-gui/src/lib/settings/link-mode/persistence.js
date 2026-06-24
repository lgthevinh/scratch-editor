import cookie from 'cookie';

import {DEFAULT_LINK_MODE, isValidLinkMode} from '.';

const COOKIE_KEY = 'scratchlinkmode';

const detectLinkMode = () => {
    const obj = cookie.parse(document.cookie) || {};
    const linkModeCookie = obj[COOKIE_KEY];

    if (isValidLinkMode(linkModeCookie)) return linkModeCookie;

    return DEFAULT_LINK_MODE;
};

const persistLinkMode = mode => {
    if (!isValidLinkMode(mode)) {
        throw new Error(`Invalid link mode: ${mode}`);
    }

    const expires = new Date(new Date().setYear(new Date().getFullYear() + 1)).toUTCString();
    document.cookie = `${COOKIE_KEY}=${mode};expires=${expires};path=/`;
};

export {
    detectLinkMode,
    persistLinkMode
};
