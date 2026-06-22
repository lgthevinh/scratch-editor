const codegen = require('./codegen');

/**
 * Blocks shared by every Arduino-compatible board: the board execution model (green-flag/loop and
 * the begin/loop hats) and, as the migration proceeds, the standard Arduino API. Board-specific
 * extensions layer on top of and may override these.
 */
module.exports = {
    getCodeGenerators: codegen.getCodeGenerators
};
