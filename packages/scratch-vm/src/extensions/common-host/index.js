const codegen = require('./codegen');

/**
 * Board-mode treatment of host-only blocks (mouse, keyboard, sensing). The host runtime behavior
 * lives in the core VM; this manifest contributes only the firmware degradation generators so a
 * host block left in a board project degrades gracefully instead of breaking code generation.
 */
module.exports = {
    getCodeGenerators: codegen.getCodeGenerators
};
