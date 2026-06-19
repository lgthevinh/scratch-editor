const {variableName} = require('./code-generator-provider');

// Variable/value kinds used for type inference. 'string' maps to the C++ `String` type;
// 'int' and 'float' map to the matching numeric C++ types. JavaScript output uses the same
// model to surface variable types for learners even though the language is dynamically typed.
const STRING_OPCODES = new Set([
    'text',
    'operator_join',
    'operator_letter_of',
    'sensing_answer',
    'sensing_username',
    'operator_totext'
]);

const numberKind = value => (/[.eE]/.test(String(value)) ? 'float' : 'int');

// Combines the kinds of two arithmetic operands: a string operand poisons the result (a type
// error surfaced elsewhere), otherwise float wins over int.
const combine = (a, b) => {
    if (a === 'string' || b === 'string') return 'string';
    return (a === 'float' || b === 'float') ? 'float' : 'int';
};

const inputBlockId = (block, name) => {
    const slot = block.inputs && block.inputs[name];
    if (!slot) return null;
    return slot.block || slot.shadow || null;
};

// Classifies the kind ('int' | 'float' | 'string') produced by a value-reporter block. Variable
// references resolve through the inferred `types` map; the expression tree is finite, so the
// recursion terminates.
const classifyKind = (blocks, types, blockId) => {
    const block = blockId && blocks.getBlock(blockId);
    if (!block) return 'int';
    const op = block.opcode;

    if (STRING_OPCODES.has(op)) return 'string';
    if (op === 'math_number' || op === 'math_positive_number') {
        return numberKind(block.fields && block.fields.NUM && block.fields.NUM.value);
    }
    if (op === 'math_integer' || op === 'math_whole_number') return 'int';
    if (op === 'data_variable') return types[variableName(block, 'VARIABLE', 'variable')] || 'int';
    if (op === 'operator_tonumber') return 'float';
    if (op === 'operator_divide' || op === 'operator_mathop') return 'float';
    if (op === 'operator_add' || op === 'operator_subtract' || op === 'operator_multiply' || op === 'operator_mod') {
        return combine(
            classifyKind(blocks, types, inputBlockId(block, 'NUM1')),
            classifyKind(blocks, types, inputBlockId(block, 'NUM2'))
        );
    }
    if (op === 'operator_random') {
        return combine(
            classifyKind(blocks, types, inputBlockId(block, 'FROM')),
            classifyKind(blocks, types, inputBlockId(block, 'TO'))
        );
    }
    // Lengths, rounds, comparisons, booleans, and unknown reporters are whole numbers.
    return 'int';
};

// Walks every block and infers each scalar variable's type from the values assigned to it.
// A variable is `String` if any `set` assigns a string value, else `float` if any assigned
// value is fractional, else `int`. The fixpoint loop lets variable-to-variable assignments
// (`set a to b`) propagate. Returns a map of sanitized variable name -> kind.
const inferVariableTypes = blocks => {
    const types = Object.create(null);
    const maxIterations = Object.keys(blocks._blocks).length + 1;
    let changed = true;
    let guard = 0;
    while (changed && guard < maxIterations) {
        guard++;
        changed = false;
        for (const id in blocks._blocks) {
            if (!Object.prototype.hasOwnProperty.call(blocks._blocks, id)) continue;
            const block = blocks._blocks[id];
            if (block.opcode !== 'data_setvariableto') continue;
            const name = variableName(block, 'VARIABLE', 'variable');
            const kind = classifyKind(blocks, types, inputBlockId(block, 'VALUE'));
            const next = combine(types[name] || 'int', kind);
            if (types[name] !== next) {
                types[name] = next;
                changed = true;
            }
        }
    }
    return types;
};

module.exports = {classifyKind, inferVariableTypes};
