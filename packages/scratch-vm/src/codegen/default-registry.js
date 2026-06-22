const GeneratorRegistry = require('./generator-registry');
const Common = require('../extensions/common');
const CommonHost = require('../extensions/common-host');
const CommonBoard = require('../extensions/common-board');

// The order is a precedence chain: GeneratorRegistry.register is last-writer-wins, so a later
// provider may override an opcode registered by an earlier one. common (universal) is the base;
// common-board adds the standard board vocabulary; board-specific providers (added later in the
// migration) come last so they can specialize. common-host is mode-disjoint (host opcodes) and only
// supplies firmware degradation.
const PROVIDERS = [
    Common,
    CommonHost,
    CommonBoard
];

const createDefaultRegistry = () => {
    const registry = new GeneratorRegistry();
    for (const provider of PROVIDERS) {
        registry.registerProvider(provider);
    }
    return registry;
};

module.exports = createDefaultRegistry;
