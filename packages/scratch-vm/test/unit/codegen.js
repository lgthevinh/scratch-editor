const test = require('tap').test;
const Blocks = require('../../src/engine/blocks');
const GeneratorRegistry = require('../../src/codegen/generator-registry');
const Runtime = require('../../src/engine/runtime');
const VirtualMachine = require('../../src/virtual-machine');
const generateCode = require('../../src/codegen/generate-code');
const Language = require('../../src/codegen/language');
const Scratch3ControlBlocks = require('../../src/blocks/scratch3_control');
const ThingBotTelemetrixExtension = require('../../src/extensions/scratch3_thingbot_telemetrix');

const getOpcodeNames = primitiveClass => Object.keys(
    new primitiveClass(new Runtime()).getPrimitives()
);

const createBlockContainer = () => new Blocks(new Runtime());

const addNumberBlock = (blocks, id, value) => {
    blocks.createBlock({
        id,
        opcode: 'math_number',
        next: null,
        parent: null,
        inputs: {},
        fields: {
            NUM: {
                name: 'NUM',
                value: String(value)
            }
        },
        topLevel: false
    });
};

const addTextBlock = (blocks, id, value) => {
    blocks.createBlock({
        id,
        opcode: 'text',
        next: null,
        parent: null,
        inputs: {},
        fields: {
            TEXT: {
                name: 'TEXT',
                value
            }
        },
        topLevel: false
    });
};

const createRepeatPrintTarget = () => {
    const blocks = createBlockContainer();
    blocks.createBlock({
        id: 'flag',
        opcode: 'event_whenflagclicked',
        next: 'repeat',
        parent: null,
        inputs: {},
        fields: {},
        topLevel: true
    });
    blocks.createBlock({
        id: 'repeat',
        opcode: 'control_repeat',
        next: null,
        parent: 'flag',
        inputs: {
            TIMES: {
                name: 'TIMES',
                block: 'times',
                shadow: 'times'
            },
            SUBSTACK: {
                name: 'SUBSTACK',
                block: 'print'
            }
        },
        fields: {},
        topLevel: false
    });
    blocks.createBlock({
        id: 'print',
        opcode: 'control_print',
        next: null,
        parent: 'repeat',
        inputs: {
            STRING: {
                name: 'STRING',
                block: 'message',
                shadow: 'message'
            }
        },
        fields: {},
        topLevel: false
    });
    addNumberBlock(blocks, 'times', 3);
    addTextBlock(blocks, 'message', 'hello');
    return {blocks};
};

test('generateCode emits JavaScript for an existing event/control stack', t => {
    const target = createRepeatPrintTarget();
    const result = generateCode(target, Language.JAVASCRIPT);

    t.same(result.diagnostics, []);
    t.equal(result.code, [
        'async function whenGreenFlagClicked () {',
        '    for (let i1 = 0; i1 < 3; i1++) {',
        '        console.log("hello");',
        '    }',
        '}',
        '',
        'whenGreenFlagClicked();'
    ].join('\n'));
    t.end();
});

test('generateCode emits Arduino C++ for an existing event/control stack', t => {
    const target = createRepeatPrintTarget();
    const result = generateCode(target, Language.ARDUINO_CPP);

    t.same(result.diagnostics, []);
    t.equal(result.code, [
        'void setup() {',
        '    Serial.begin(9600);',
        '}',
        '',
        'void loop() {',
        '    for (int i1 = 0; i1 < 3; i1++) {',
        '        Serial.println("hello");',
        '    }',
        '}'
    ].join('\n'));
    t.end();
});

test('generateCode reports unsupported block diagnostics', t => {
    const blocks = createBlockContainer();
    blocks.createBlock({
        id: 'unsupported',
        opcode: 'unsupported_block',
        next: null,
        parent: null,
        inputs: {},
        fields: {},
        topLevel: true
    });

    const result = generateCode({blocks}, Language.JAVASCRIPT);
    t.equal(result.code, '/* Unsupported block: unsupported_block */');
    t.equal(result.diagnostics.length, 1);
    t.match(result.diagnostics[0], {
        severity: 'warning',
        blockId: 'unsupported',
        opcode: 'unsupported_block'
    });
    t.end();
});

test('VirtualMachine.generateCode uses the editing target by default', t => {
    const vm = new VirtualMachine();
    vm.editingTarget = createRepeatPrintTarget();

    const result = vm.generateCode(Language.JAVASCRIPT);
    t.match(result.code, 'whenGreenFlagClicked');
    t.same(result.diagnostics, []);
    t.end();
});

test('VirtualMachine.generateCode returns a diagnostic without an editing target', t => {
    const vm = new VirtualMachine();

    const result = vm.generateCode(Language.JAVASCRIPT);
    t.equal(result.code, '');
    t.equal(result.diagnostics.length, 1);
    t.equal(result.diagnostics[0].severity, 'error');
    t.end();
});

test('control primitives no longer include clone blocks', t => {
    const controlOpcodes = getOpcodeNames(Scratch3ControlBlocks);
    const controlHats = new Scratch3ControlBlocks(new Runtime()).getHats();

    t.notOk(controlOpcodes.includes('control_create_clone_of'));
    t.notOk(controlOpcodes.includes('control_delete_this_clone'));
    t.notOk(Object.prototype.hasOwnProperty.call(controlHats, 'control_start_as_clone'));
    t.end();
});

test('GeneratorRegistry registers extension codegen providers', t => {
    const registry = new GeneratorRegistry();

    registry.registerProvider(ThingBotTelemetrixExtension);

    t.ok(registry.get('thingbotTelemetrix_digitalWrite', Language.JAVASCRIPT));
    t.notOk(registry.get('thingbotTelemetrix_digitalWrite', Language.ARDUINO_CPP));
    t.end();
});

test('generateCode covers data, sensing, operator, procedure, and ThingBot opcodes', t => {
    const blocks = createBlockContainer();
    blocks.createBlock({
        id: 'flag',
        opcode: 'event_whenflagclicked',
        next: 'setVariable',
        parent: null,
        inputs: {},
        fields: {},
        topLevel: true
    });
    blocks.createBlock({
        id: 'setVariable',
        opcode: 'data_setvariableto',
        next: 'ask',
        parent: 'flag',
        inputs: {
            VALUE: {
                name: 'VALUE',
                block: 'sum',
                shadow: 'sum'
            }
        },
        fields: {
            VARIABLE: {
                id: 'score id',
                name: 'VARIABLE',
                value: 'score'
            }
        },
        topLevel: false
    });
    blocks.createBlock({
        id: 'sum',
        opcode: 'operator_add',
        next: null,
        parent: 'setVariable',
        inputs: {
            NUM1: {
                name: 'NUM1',
                block: 'left',
                shadow: 'left'
            },
            NUM2: {
                name: 'NUM2',
                block: 'right',
                shadow: 'right'
            }
        },
        fields: {},
        topLevel: false
    });
    addNumberBlock(blocks, 'left', 1);
    addNumberBlock(blocks, 'right', 2);
    blocks.createBlock({
        id: 'ask',
        opcode: 'sensing_askandwait',
        next: 'thingbot',
        parent: 'setVariable',
        inputs: {
            QUESTION: {
                name: 'QUESTION',
                block: 'question',
                shadow: 'question'
            }
        },
        fields: {},
        topLevel: false
    });
    addTextBlock(blocks, 'question', 'Ready?');
    blocks.createBlock({
        id: 'thingbot',
        opcode: 'thingbotTelemetrix_digitalWrite',
        next: 'call',
        parent: 'ask',
        inputs: {
            PIN: {
                name: 'PIN',
                block: 'pin',
                shadow: 'pin'
            }
        },
        fields: {
            LEVEL: {
                name: 'LEVEL',
                value: 'HIGH'
            }
        },
        topLevel: false
    });
    addNumberBlock(blocks, 'pin', 13);
    blocks.createBlock({
        id: 'call',
        opcode: 'procedures_call',
        next: null,
        parent: 'thingbot',
        inputs: {},
        fields: {},
        mutation: {
            proccode: 'do work'
        },
        topLevel: false
    });

    const js = generateCode({blocks}, Language.JAVASCRIPT);
    const arduinoCpp = generateCode({blocks}, Language.ARDUINO_CPP);

    t.same(js.diagnostics, []);
    t.same(arduinoCpp.diagnostics, [{
        severity: 'warning',
        message: 'No arduino-cpp generator registered for thingbotTelemetrix_digitalWrite',
        blockId: 'thingbot',
        opcode: 'thingbotTelemetrix_digitalWrite'
    }]);
    t.match(js.code, 'let score = (1 + 2);');
    t.match(js.code, 'thingbot.digitalWrite(13, "HIGH");');
    t.match(arduinoCpp.code, 'int score = (1 + 2);');
    t.match(arduinoCpp.code, '/* Unsupported block: thingbotTelemetrix_digitalWrite */');
    t.end();
});
