const codegen = require('./codegen');

/**
 * Universal core blocks (control, operators, data, variables, procedures). They run on the VM
 * interpreter in host mode and translate to C++ in board mode; this manifest contributes the
 * board-mode code generators.
 */
module.exports = {
    getCodeGenerators: codegen.getCodeGenerators
};
