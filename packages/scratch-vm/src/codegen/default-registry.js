const GeneratorRegistry = require('./generator-registry');
const Common = require('../extensions/common');
const CommonHost = require('../extensions/common-host');
const CommonBoard = require('../extensions/common-board');
const {boards} = require('../extensions/devices');

// The order is a precedence chain: GeneratorRegistry.register is last-writer-wins, so a later
// provider may override an opcode registered by an earlier one. common (universal) is the base;
// common-board adds the standard board vocabulary; per-board providers come last so a board can
// specialize a standard opcode (e.g. ESP32 analogWrite -> ledcWrite). common-host is mode-disjoint
// (host opcodes) and only supplies firmware degradation.
//
// Board providers are discovered from the board manifests, so a new board that ships codegen
// overrides is picked up automatically — no edit here.
const boardProviders = boards.filter(board => typeof board.getCodeGenerators === 'function');

const PROVIDERS = [
    Common,
    CommonHost,
    CommonBoard,
    ...boardProviders
];

const createDefaultRegistry = () => {
    const registry = new GeneratorRegistry();
    for (const provider of PROVIDERS) {
        registry.registerProvider(provider);
    }
    return registry;
};

module.exports = createDefaultRegistry;
