// Device-link backend the VM routes board discovery, connection, and upload through.
// 'link' is the native helper (thingblock-link); 'cloud' is the web/Web Serial backend.
const LINK_MODE = 'link';
const CLOUD_MODE = 'cloud';

const DEFAULT_LINK_MODE = LINK_MODE;

const isValidLinkMode = mode => [LINK_MODE, CLOUD_MODE].includes(mode);

export {
    LINK_MODE,
    CLOUD_MODE,
    DEFAULT_LINK_MODE,
    isValidLinkMode
};
