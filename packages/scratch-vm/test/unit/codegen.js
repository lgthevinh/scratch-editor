const test = require('tap').test;
const Blocks = require('../../src/engine/blocks');
const GeneratorRegistry = require('../../src/codegen/generator-registry');
const Runtime = require('../../src/engine/runtime');
const VirtualMachine = require('../../src/virtual-machine');
const generateCode = require('../../src/codegen/generate-code');
const Language = require('../../src/codegen/language');
const Scratch3ControlBlocks = require('../../src/blocks/scratch3_control');
const CommonBoard = require('../../src/extensions/common-board');

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

test('generateCode reports an unsupported language diagnostic', t => {
    const target = createRepeatPrintTarget();
    const result = generateCode(target, 'js');

    t.equal(result.code, '');
    t.equal(result.diagnostics.length, 1);
    t.equal(result.diagnostics[0].severity, 'error');
    t.match(result.diagnostics[0].message, 'Unsupported code generation language');
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

    const result = generateCode({blocks}, Language.ARDUINO_CPP);
    t.match(result.code, '/* Unsupported block: unsupported_block */');
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

    const result = vm.generateCode(Language.ARDUINO_CPP);
    t.match(result.code, 'Serial.println("hello");');
    t.same(result.diagnostics, []);
    t.end();
});

test('VirtualMachine.generateCode returns a diagnostic without an editing target', t => {
    const vm = new VirtualMachine();

    const result = vm.generateCode(Language.ARDUINO_CPP);
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

    registry.registerProvider(CommonBoard);

    t.ok(registry.get('arduino_digitalWrite', Language.ARDUINO_CPP));
    t.end();
});

test('generateCode covers data, sensing, operator, and procedure opcodes', t => {
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
        next: 'call',
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
        id: 'call',
        opcode: 'procedures_call',
        next: null,
        parent: 'ask',
        inputs: {},
        fields: {},
        mutation: {
            proccode: 'do work'
        },
        topLevel: false
    });

    const arduinoCpp = generateCode({blocks}, Language.ARDUINO_CPP);

    t.same(arduinoCpp.diagnostics, []);
    t.match(arduinoCpp.code, 'int score = 0;');
    t.match(arduinoCpp.code, 'score = (1 + 2);');
    t.match(arduinoCpp.code, '/* ask "Ready?" and wait */');
    t.match(arduinoCpp.code, 'do_work();');
    t.end();
});

test('generateCode declares each variable using its explicit dataType, defaulting to int', t => {
    const blocks = createBlockContainer();
    const setBlock = (id, next, varName, valueId) => blocks.createBlock({
        id,
        opcode: 'data_setvariableto',
        next,
        parent: null,
        inputs: {VALUE: {name: 'VALUE', block: valueId, shadow: valueId}},
        fields: {VARIABLE: {id: `${varName} id`, name: 'VARIABLE', value: varName}},
        topLevel: id === 'setCount'
    });
    setBlock('setCount', 'setRatio', 'count', 'countVal');
    setBlock('setRatio', 'setName', 'ratio', 'ratioVal');
    setBlock('setName', null, 'name', 'nameVal');
    addNumberBlock(blocks, 'countVal', 5);
    addNumberBlock(blocks, 'ratioVal', '3.5');
    addTextBlock(blocks, 'nameVal', 'Ada');

    // `count` carries no explicit type and defaults to int; the others use their dialog type.
    const variables = {
        'ratio id': {name: 'ratio', dataType: 'float'},
        'name id': {name: 'name', dataType: 'string'}
    };

    const arduinoCpp = generateCode({blocks, variables}, Language.ARDUINO_CPP);
    t.same(arduinoCpp.diagnostics, []);
    t.match(arduinoCpp.code, 'int count = 0;');
    t.match(arduinoCpp.code, 'float ratio = 0;');
    t.match(arduinoCpp.code, 'String name = "";');
    t.match(arduinoCpp.code, 'name = "Ada";');
    t.end();
});

test('generateCode assigns a bare number when setting a numeric variable from a text literal', t => {
    // The set block's literal shadow is a text field; a numeric variable must still get a number.
    const blocks = createBlockContainer();
    blocks.createBlock({
        id: 'setX',
        opcode: 'data_setvariableto',
        next: null,
        parent: null,
        inputs: {VALUE: {name: 'VALUE', block: 'val', shadow: 'val'}},
        fields: {VARIABLE: {id: 'x id', name: 'VARIABLE', value: 'x'}},
        topLevel: true
    });
    addTextBlock(blocks, 'val', '42');

    const arduinoCpp = generateCode({blocks}, Language.ARDUINO_CPP);
    t.same(arduinoCpp.diagnostics, []);
    t.match(arduinoCpp.code, 'x = 42;');
    t.notMatch(arduinoCpp.code, 'x = "42";');
    t.end();
});

test('generateCode keeps quotes when setting a string variable from a text literal', t => {
    const blocks = createBlockContainer();
    blocks.createBlock({
        id: 'setName',
        opcode: 'data_setvariableto',
        next: null,
        parent: null,
        inputs: {VALUE: {name: 'VALUE', block: 'val', shadow: 'val'}},
        fields: {VARIABLE: {id: 'name id', name: 'VARIABLE', value: 'name'}},
        topLevel: true
    });
    addTextBlock(blocks, 'val', 'hi');
    const variables = {'name id': {name: 'name', dataType: 'string'}};

    const arduinoCpp = generateCode({blocks, variables}, Language.ARDUINO_CPP);
    t.same(arduinoCpp.diagnostics, []);
    t.match(arduinoCpp.code, 'name = "hi";');
    t.end();
});

test('generateCode reads the explicit type of a global (stage) variable', t => {
    // Global variables live on the stage, not the editing target; codegen must still see the type.
    const blocks = createBlockContainer();
    blocks.createBlock({
        id: 'setName',
        opcode: 'data_setvariableto',
        next: null,
        parent: null,
        inputs: {VALUE: {name: 'VALUE', block: 'val', shadow: 'val'}},
        fields: {VARIABLE: {id: 'name id', name: 'VARIABLE', value: 'name'}},
        topLevel: true
    });
    addTextBlock(blocks, 'val', 'hi');
    const stage = {variables: {'name id': {name: 'name', dataType: 'string'}}};
    const target = {blocks, variables: {}, runtime: {getTargetForStage: () => stage}};

    const arduinoCpp = generateCode(target, Language.ARDUINO_CPP);
    t.same(arduinoCpp.diagnostics, []);
    t.match(arduinoCpp.code, 'String name = "";');
    t.match(arduinoCpp.code, 'name = "hi";');
    t.end();
});

test('generateCode declares a variable once when set multiple times', t => {
    const blocks = createBlockContainer();
    blocks.createBlock({
        id: 'flag',
        opcode: 'event_whenflagclicked',
        next: 'set1',
        parent: null,
        inputs: {},
        fields: {},
        topLevel: true
    });
    blocks.createBlock({
        id: 'set1',
        opcode: 'data_setvariableto',
        next: 'set2',
        parent: 'flag',
        inputs: {VALUE: {name: 'VALUE', block: 'v1', shadow: 'v1'}},
        fields: {VARIABLE: {id: 'score id', name: 'VARIABLE', value: 'score'}},
        topLevel: false
    });
    blocks.createBlock({
        id: 'set2',
        opcode: 'data_setvariableto',
        next: null,
        parent: 'set1',
        inputs: {VALUE: {name: 'VALUE', block: 'v2', shadow: 'v2'}},
        fields: {VARIABLE: {id: 'score id', name: 'VARIABLE', value: 'score'}},
        topLevel: false
    });
    addNumberBlock(blocks, 'v1', 1);
    addNumberBlock(blocks, 'v2', 2);

    const arduinoCpp = generateCode({blocks}, Language.ARDUINO_CPP);

    t.same(arduinoCpp.diagnostics, []);
    const declarations = arduinoCpp.code.match(/int score = 0;/g) || [];
    t.equal(declarations.length, 1, 'variable is declared exactly once');
    t.match(arduinoCpp.code, 'score = 1;');
    t.match(arduinoCpp.code, 'score = 2;');
    t.notMatch(arduinoCpp.code, 'int score = 1;', 'set does not re-declare the variable');
    t.end();
});

test('generateCode emits list operations', t => {
    const blocks = createBlockContainer();
    blocks.createBlock({
        id: 'flag',
        opcode: 'event_whenflagclicked',
        next: 'add',
        parent: null,
        inputs: {},
        fields: {},
        topLevel: true
    });
    blocks.createBlock({
        id: 'add',
        opcode: 'data_addtolist',
        next: null,
        parent: 'flag',
        inputs: {ITEM: {name: 'ITEM', block: 'item', shadow: 'item'}},
        fields: {LIST: {id: 'queue id', name: 'LIST', value: 'queue'}},
        topLevel: false
    });
    addNumberBlock(blocks, 'item', 7);

    const arduinoCpp = generateCode({blocks}, Language.ARDUINO_CPP);

    t.same(arduinoCpp.diagnostics, []);
    t.match(arduinoCpp.code, 'queue.push(7);');
    t.end();
});

const createSetVariableTarget = varName => {
    const blocks = createBlockContainer();
    blocks.createBlock({
        id: 'setX',
        opcode: 'data_setvariableto',
        next: null,
        parent: null,
        inputs: {VALUE: {name: 'VALUE', block: 'val', shadow: 'val'}},
        fields: {VARIABLE: {id: `${varName} id`, name: 'VARIABLE', value: varName}},
        topLevel: true
    });
    addNumberBlock(blocks, 'val', 5);
    return blocks;
};

test('an explicit dataType drives the declaration regardless of the assigned value', t => {
    // `x` is assigned an integer but declared float; set/change blocks enforce values match.
    const blocks = createSetVariableTarget('x');
    const variables = {'x id': {name: 'x', dataType: 'float'}};

    const arduinoCpp = generateCode({blocks, variables}, Language.ARDUINO_CPP);
    t.same(arduinoCpp.diagnostics, []);
    t.match(arduinoCpp.code, 'float x = 0;');
    t.notMatch(arduinoCpp.code, 'int x = 0;');
    t.end();
});

test('codegen ignores an unrecognized explicit dataType and defaults to int', t => {
    const blocks = createSetVariableTarget('x');
    // A crafted/corrupt project could carry an arbitrary type string; it must never reach output.
    const variables = {'x id': {name: 'x', dataType: 'int x = 1; int'}};

    const arduinoCpp = generateCode({blocks, variables}, Language.ARDUINO_CPP);
    t.same(arduinoCpp.diagnostics, []);
    t.match(arduinoCpp.code, 'int x = 0;');
    t.notMatch(arduinoCpp.code, 'int x = 1;');
    t.end();
});
