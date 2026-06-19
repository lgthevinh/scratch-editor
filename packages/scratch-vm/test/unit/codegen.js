const test = require('tap').test;
const Blocks = require('../../src/engine/blocks');
const GeneratorRegistry = require('../../src/codegen/generator-registry');
const Runtime = require('../../src/engine/runtime');
const VirtualMachine = require('../../src/virtual-machine');
const generateCode = require('../../src/codegen/generate-code');
const Language = require('../../src/codegen/language');
const Scratch3ControlBlocks = require('../../src/blocks/scratch3_control');
const Scratch3Arduino = require('../../src/extensions/scratch3_arduino');

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

    registry.registerProvider(Scratch3Arduino);

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

test('generateCode infers int/float/String variable types and warns on mismatched assignment', t => {
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

    const arduinoCpp = generateCode({blocks}, Language.ARDUINO_CPP);
    t.same(arduinoCpp.diagnostics, []);
    t.match(arduinoCpp.code, 'int count = 0;');
    t.match(arduinoCpp.code, 'float ratio = 0;');
    t.match(arduinoCpp.code, 'String name = "";');
    t.match(arduinoCpp.code, 'name = "Ada";');
    t.end();
});

test('generateCode lets an explicit variable dataType override the inferred type', t => {
    const blocks = createBlockContainer();
    const setBlock = (id, next, varName, valueId, topLevel) => blocks.createBlock({
        id,
        opcode: 'data_setvariableto',
        next,
        parent: null,
        inputs: {VALUE: {name: 'VALUE', block: valueId, shadow: valueId}},
        fields: {VARIABLE: {id: `${varName} id`, name: 'VARIABLE', value: varName}},
        topLevel
    });
    // `temp` is assigned an integer (would infer `int`) but is declared `float` explicitly.
    setBlock('setTemp', 'setNote', 'temp', 'tempVal', true);
    setBlock('setNote', null, 'note', 'noteVal', false);
    addNumberBlock(blocks, 'tempVal', 5);
    addTextBlock(blocks, 'noteVal', 'ok');

    const variables = {
        'temp id': {name: 'temp', dataType: 'float'},
        'note id': {name: 'note', dataType: 'string'}
    };

    const arduinoCpp = generateCode({blocks, variables}, Language.ARDUINO_CPP);
    t.same(arduinoCpp.diagnostics, []);
    t.match(arduinoCpp.code, 'float temp = 0;');
    t.match(arduinoCpp.code, 'String note = "";');
    t.notMatch(arduinoCpp.code, 'int temp = 0;');

    // Without an explicit dataType the value-based inference still applies (`temp` -> int).
    const inferred = generateCode({blocks}, Language.ARDUINO_CPP);
    t.match(inferred.code, 'int temp = 0;');
    t.end();
});

test('generateCode warns when assigning text to a number variable and a convert block clears it', t => {
    const mismatchTarget = () => {
        const blocks = createBlockContainer();
        blocks.createBlock({
            id: 'setScore',
            opcode: 'data_setvariableto',
            next: 'setLabel',
            parent: null,
            inputs: {VALUE: {name: 'VALUE', block: 'num', shadow: 'num'}},
            fields: {VARIABLE: {id: 'score id', name: 'VARIABLE', value: 'score'}},
            topLevel: true
        });
        addNumberBlock(blocks, 'num', 1);
        // `label` is String (set to text), but here it is assigned a raw number -> mismatch.
        blocks.createBlock({
            id: 'setLabel',
            opcode: 'data_setvariableto',
            next: null,
            parent: 'setScore',
            inputs: {VALUE: {name: 'VALUE', block: 'count', shadow: 'count'}},
            fields: {VARIABLE: {id: 'label id', name: 'VARIABLE', value: 'label'}},
            topLevel: false
        });
        blocks.createBlock({
            id: 'seedLabel',
            opcode: 'data_setvariableto',
            next: null,
            parent: null,
            inputs: {VALUE: {name: 'VALUE', block: 'word', shadow: 'word'}},
            fields: {VARIABLE: {id: 'label id', name: 'VARIABLE', value: 'label'}},
            topLevel: true
        });
        addTextBlock(blocks, 'word', 'hi');
        addNumberBlock(blocks, 'count', 7);
        return blocks;
    };

    const blocks = mismatchTarget();
    const result = generateCode({blocks}, Language.ARDUINO_CPP);
    t.equal(result.diagnostics.length, 1);
    t.match(result.diagnostics[0], {severity: 'warning', blockId: 'setLabel'});
    t.match(result.diagnostics[0].message, 'to text');

    // Wrapping the number in a `to text` convert block makes the kinds agree -> no diagnostic.
    const fixed = mismatchTarget();
    fixed.createBlock({
        id: 'convert',
        opcode: 'operator_totext',
        next: null,
        parent: 'setLabel',
        inputs: {VALUE: {name: 'VALUE', block: 'count', shadow: 'count'}},
        fields: {},
        topLevel: false
    });
    fixed.getBlock('setLabel').inputs.VALUE = {name: 'VALUE', block: 'convert', shadow: 'count'};
    const fixedResult = generateCode({blocks: fixed}, Language.ARDUINO_CPP);
    t.same(fixedResult.diagnostics, []);
    t.match(fixedResult.code, 'label = String(7);');
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

// `set b to (a)`, where `a` carries an explicit dataType. Used to check that explicit types seed
// inference and flow through `data_variable` references into dependent variables.
const createVariableCopyTarget = () => {
    const blocks = createBlockContainer();
    blocks.createBlock({
        id: 'setB',
        opcode: 'data_setvariableto',
        next: null,
        parent: null,
        inputs: {VALUE: {name: 'VALUE', block: 'aRef', shadow: null}},
        fields: {VARIABLE: {id: 'b id', name: 'VARIABLE', value: 'b'}},
        topLevel: true
    });
    blocks.createBlock({
        id: 'aRef',
        opcode: 'data_variable',
        next: null,
        parent: 'setB',
        inputs: {},
        fields: {VARIABLE: {id: 'a id', name: 'VARIABLE', value: 'a'}},
        topLevel: false
    });
    return {blocks};
};

test('an explicit String type propagates through a variable reference to dependent variables', t => {
    const {blocks} = createVariableCopyTarget();
    const variables = {'a id': {name: 'a', dataType: 'string'}};

    const arduinoCpp = generateCode({blocks, variables}, Language.ARDUINO_CPP);
    t.same(arduinoCpp.diagnostics, []);
    t.match(arduinoCpp.code, 'String a = "";');
    t.match(arduinoCpp.code, 'String b = "";');
    t.match(arduinoCpp.code, 'b = a;');
    t.notMatch(arduinoCpp.code, 'int b = 0;');
    t.end();
});

test('an explicit float type propagates precision through a variable reference', t => {
    const {blocks} = createVariableCopyTarget();
    const variables = {'a id': {name: 'a', dataType: 'float'}};

    const arduinoCpp = generateCode({blocks, variables}, Language.ARDUINO_CPP);
    t.same(arduinoCpp.diagnostics, []);
    t.match(arduinoCpp.code, 'float a = 0;');
    t.match(arduinoCpp.code, 'float b = 0;');
    t.notMatch(arduinoCpp.code, 'int b = 0;');
    t.end();
});

test('codegen ignores an unrecognized explicit dataType and falls back to inference', t => {
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
    addNumberBlock(blocks, 'val', 5);
    // A crafted/corrupt project could carry an arbitrary type string; it must never reach output.
    const variables = {'x id': {name: 'x', dataType: 'int x = 1; int'}};

    const arduinoCpp = generateCode({blocks, variables}, Language.ARDUINO_CPP);
    t.same(arduinoCpp.diagnostics, []);
    t.match(arduinoCpp.code, 'int x = 0;');
    t.notMatch(arduinoCpp.code, 'int x = 1;');
    t.end();
});
