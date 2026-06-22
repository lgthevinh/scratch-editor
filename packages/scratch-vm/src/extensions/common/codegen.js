const {
    Language,
    expression,
    field,
    input,
    line,
    quote,
    sanitizeIdentifier,
    statement,
    variableName
} = require('../../codegen/code-generator-provider');

const ARDUINO = Language.ARDUINO_CPP;

const procedureName = block => {
    const mutation = block.mutation || {};
    return sanitizeIdentifier(mutation.proccode || 'custom_block');
};

// Each scalar variable is declared once, as a hoisted helper, using its inferred type
// ('int' | 'float' | 'string'). Repeated set/change blocks then become plain assignments.
const ensureVariable = (ctx, block) => {
    const name = variableName(block, 'VARIABLE', 'variable');
    const type = ctx.variableType(name);
    const init = type === 'string' ? '""' : '0';
    const cppType = type === 'string' ? 'String' : type;
    ctx.addHelper(`${cppType} ${name} = ${init};`);
    return name;
};

// Generate a `set` value that matches the variable's declared type. The set block's literal
// shadow is a text field, which the `text` generator quotes; for a numeric variable that would
// assign a string, so unwrap the literal to a bare number instead. Set/change blocks enforce that
// the entered value is valid for the type, so the unwrapped literal is already numeric.
const typedSetValue = (ctx, block, type) => {
    if (type !== 'string') {
        const valueBlock = ctx.getBlock(ctx.getInputBlockId(block, 'VALUE'));
        if (valueBlock && valueBlock.opcode === 'text') {
            const raw = String(field(ctx, valueBlock, 'TEXT', '0')).trim();
            return raw !== '' && Number.isFinite(Number(raw)) ? raw : '0';
        }
    }
    return input(ctx, block, 'VALUE', type === 'string' ? '""' : '0');
};

// Lists keep the JavaScript-array preview (C++ array support is a follow-up).
const listName = (ctx, block) => variableName(block, 'LIST', 'list');

const emptyBody = (ctx, indentLevel) => line(ctx, indentLevel, '/* no blocks */');

const bodyOrEmpty = (ctx, block, branchName, indentLevel) => (
    ctx.generateSubstack(block, branchName, indentLevel) || emptyBody(ctx, indentLevel)
);

const binaryExpression = (leftName, operator, rightName, fallback) => expression((ctx, block) => {
    const left = input(ctx, block, leftName, fallback);
    const right = input(ctx, block, rightName, fallback);
    return `(${left} ${operator} ${right})`;
});

const noOpStatement = label => statement((ctx, block, indentLevel) => (
    line(ctx, indentLevel, `/* ${label}: ${block.opcode} */`)
));

const generators = [];
const reg = (opcode, generator) => generators.push({opcode, language: ARDUINO, generator});

// ─── Shared expressions ───
reg('math_number', expression((ctx, block) => field(ctx, block, 'NUM', '0')));
reg('math_integer', expression((ctx, block) => field(ctx, block, 'NUM', '0')));
reg('math_whole_number', expression((ctx, block) => field(ctx, block, 'NUM', '0')));
reg('math_positive_number', expression((ctx, block) => field(ctx, block, 'NUM', '0')));
reg('text', expression((ctx, block) => quote(field(ctx, block, 'TEXT', ''))));
reg('data_listindexall', expression((ctx, block) => quote(field(ctx, block, 'INDEX', 'all'))));
reg('data_listindexrandom', expression((ctx, block) => quote(field(ctx, block, 'INDEX', 'random'))));

reg('operator_add', binaryExpression('NUM1', '+', 'NUM2', '0'));
reg('operator_subtract', binaryExpression('NUM1', '-', 'NUM2', '0'));
reg('operator_multiply', binaryExpression('NUM1', '*', 'NUM2', '0'));
reg('operator_divide', binaryExpression('NUM1', '/', 'NUM2', '0'));
reg('operator_lt', binaryExpression('OPERAND1', '<', 'OPERAND2', '0'));
reg('operator_gt', binaryExpression('OPERAND1', '>', 'OPERAND2', '0'));
reg('operator_equals', binaryExpression('OPERAND1', '==', 'OPERAND2', '0'));
reg('operator_and', binaryExpression('OPERAND1', '&&', 'OPERAND2', 'false'));
reg('operator_or', binaryExpression('OPERAND1', '||', 'OPERAND2', 'false'));
reg('operator_not', expression((ctx, block) => `(!${input(ctx, block, 'OPERAND', 'false')})`));

// ─── Operators ───
reg('operator_random', expression((ctx, block) => {
    const from = input(ctx, block, 'FROM', '0');
    const to = input(ctx, block, 'TO', '1');
    return `random(${from}, ${to} + 1)`;
}));
reg('operator_join', expression((ctx, block) => {
    const first = input(ctx, block, 'STRING1', '""');
    const second = input(ctx, block, 'STRING2', '""');
    return `(String(${first}) + String(${second}))`;
}));
reg('operator_letter_of', expression((ctx, block) => {
    const index = input(ctx, block, 'LETTER', '1');
    const string = input(ctx, block, 'STRING', '""');
    return `String(${string}).charAt(${index} - 1)`;
}));
reg('operator_length', expression((ctx, block) => (
    `String(${input(ctx, block, 'STRING', '""')}).length()`
)));
reg('operator_contains', expression((ctx, block) => {
    const string = input(ctx, block, 'STRING1', '""');
    const search = input(ctx, block, 'STRING2', '""');
    return `(String(${string}).indexOf(String(${search})) >= 0)`;
}));
reg('operator_mod', expression((ctx, block) => {
    const number = input(ctx, block, 'NUM1', '0');
    const modulus = input(ctx, block, 'NUM2', '1');
    return `(((${number} % ${modulus}) + ${modulus}) % ${modulus})`;
}));
reg('operator_round', expression((ctx, block) => `round(${input(ctx, block, 'NUM', '0')})`));
reg('operator_mathop', expression((ctx, block) => {
    const operator = String(field(ctx, block, 'OPERATOR', 'abs')).toLowerCase();
    const number = input(ctx, block, 'NUM', '0');
    const cppOperators = {
        abs: 'abs',
        floor: 'floor',
        ceiling: 'ceil',
        sqrt: 'sqrt',
        sin: 'sin',
        cos: 'cos',
        tan: 'tan',
        asin: 'asin',
        acos: 'acos',
        atan: 'atan',
        ln: 'log',
        log: 'log10'
    };
    if (operator === 'e ^') return `exp(${number})`;
    if (operator === '10 ^') return `pow(10, ${number})`;
    return `${cppOperators[operator] || 'abs'}(${number})`;
}));
reg('operator_tonumber', expression((ctx, block) => (
    `String(${input(ctx, block, 'VALUE', '0')}).toFloat()`
)));
reg('operator_totext', expression((ctx, block) => (
    `String(${input(ctx, block, 'VALUE', '""')})`
)));

// ─── Control ───
reg('control_repeat', statement((ctx, block, indentLevel) => {
    const times = input(ctx, block, 'TIMES', '0');
    const iterator = `i${indentLevel || 0}`;
    const body = bodyOrEmpty(ctx, block, ctx.branchInputName(1), indentLevel + 1);
    return [
        line(ctx, indentLevel, `for (int ${iterator} = 0; ${iterator} < ${times}; ${iterator}++) {`),
        body,
        line(ctx, indentLevel, '}')
    ].join('\n');
}));
reg('control_forever', statement((ctx, block, indentLevel) => {
    const body = bodyOrEmpty(ctx, block, ctx.branchInputName(1), indentLevel + 1);
    return [
        line(ctx, indentLevel, 'while (true) {'),
        body,
        line(ctx, indentLevel, '}')
    ].join('\n');
}));
reg('control_repeat_until', statement((ctx, block, indentLevel) => {
    const condition = input(ctx, block, 'CONDITION', 'false');
    const body = bodyOrEmpty(ctx, block, ctx.branchInputName(1), indentLevel + 1);
    return [
        line(ctx, indentLevel, `while (!(${condition})) {`),
        body,
        line(ctx, indentLevel, '}')
    ].join('\n');
}));
reg('control_while', statement((ctx, block, indentLevel) => {
    const condition = input(ctx, block, 'CONDITION', 'false');
    const body = bodyOrEmpty(ctx, block, ctx.branchInputName(1), indentLevel + 1);
    return [
        line(ctx, indentLevel, `while (${condition}) {`),
        body,
        line(ctx, indentLevel, '}')
    ].join('\n');
}));
reg('control_if', statement((ctx, block, indentLevel) => {
    const condition = input(ctx, block, 'CONDITION', 'false');
    const body = bodyOrEmpty(ctx, block, ctx.branchInputName(1), indentLevel + 1);
    return [
        line(ctx, indentLevel, `if (${condition}) {`),
        body,
        line(ctx, indentLevel, '}')
    ].join('\n');
}));
reg('control_if_else', statement((ctx, block, indentLevel) => {
    const condition = input(ctx, block, 'CONDITION', 'false');
    const thenBody = bodyOrEmpty(ctx, block, ctx.branchInputName(1), indentLevel + 1);
    const elseBody = bodyOrEmpty(ctx, block, ctx.branchInputName(2), indentLevel + 1);
    return [
        line(ctx, indentLevel, `if (${condition}) {`),
        thenBody,
        line(ctx, indentLevel, '} else {'),
        elseBody,
        line(ctx, indentLevel, '}')
    ].join('\n');
}));
reg('control_all_at_once', statement((ctx, block, indentLevel) => (
    ctx.generateSubstack(block, ctx.branchInputName(1), indentLevel) ||
    line(ctx, indentLevel, '/* no blocks */')
)));
reg('control_stop', statement((ctx, block, indentLevel) => {
    const option = field(ctx, block, 'STOP_OPTION', 'this script');
    return line(ctx, indentLevel, `return; /* stop ${option} */`);
}));
reg('control_clear_counter', statement((ctx, block, indentLevel) => (
    line(ctx, indentLevel, '__scratchCounter = 0;')
)));
reg('control_incr_counter', statement((ctx, block, indentLevel) => (
    line(ctx, indentLevel, '__scratchCounter++;')
)));
reg('control_get_counter', expression(() => '__scratchCounter'));

reg('control_wait', statement((ctx, block, indentLevel) => {
    const duration = input(ctx, block, 'DURATION', '0');
    return line(ctx, indentLevel, `delay(1000 * ${duration});`);
}));
reg('control_wait_until', statement((ctx, block, indentLevel) => {
    const condition = input(ctx, block, 'CONDITION', 'false');
    return line(ctx, indentLevel, `while (!(${condition})) { delay(16); }`);
}));
reg('control_for_each', statement((ctx, block, indentLevel) => {
    const variable = variableName(block, 'VARIABLE', 'item');
    const value = input(ctx, block, 'VALUE', '0');
    const body = bodyOrEmpty(ctx, block, ctx.branchInputName(1), indentLevel + 1);
    return [
        line(ctx, indentLevel, `for (int ${variable} = 1; ${variable} <= ${value}; ${variable}++) {`),
        body,
        line(ctx, indentLevel, '}')
    ].join('\n');
}));
reg('control_print', statement((ctx, block, indentLevel) => {
    ctx.addSetup('Serial.begin(9600);');
    const value = input(ctx, block, 'STRING', '""');
    return line(ctx, indentLevel, `Serial.println(${value});`);
}));

// ─── Data ───
reg('data_variable', expression((ctx, block) => ensureVariable(ctx, block)));
reg('data_setvariableto', statement((ctx, block, indentLevel) => {
    const variable = ensureVariable(ctx, block);
    const value = typedSetValue(ctx, block, ctx.variableType(variable));
    return line(ctx, indentLevel, `${variable} = ${value};`);
}));
reg('data_changevariableby', statement((ctx, block, indentLevel) => {
    const variable = ensureVariable(ctx, block);
    if (ctx.variableType(variable) === 'string') {
        ctx.addDiagnostic(
            'warning',
            `Cannot change text variable '${variable}' by a number`,
            block
        );
    }
    return line(ctx, indentLevel, `${variable} += ${input(ctx, block, 'VALUE', '0')};`);
}));
reg('data_listcontents', expression((ctx, block) => listName(ctx, block)));
reg('data_addtolist', statement((ctx, block, indentLevel) => {
    const list = listName(ctx, block);
    return line(ctx, indentLevel, `${list}.push(${input(ctx, block, 'ITEM', '0')});`);
}));
reg('data_deleteoflist', statement((ctx, block, indentLevel) => {
    const list = listName(ctx, block);
    return line(ctx, indentLevel, `${list}.splice(${input(ctx, block, 'INDEX', '1')} - 1, 1);`);
}));
reg('data_deletealloflist', statement((ctx, block, indentLevel) => {
    const list = listName(ctx, block);
    return line(ctx, indentLevel, `${list}.length = 0;`);
}));
reg('data_insertatlist', statement((ctx, block, indentLevel) => {
    const list = listName(ctx, block);
    const index = input(ctx, block, 'INDEX', '1');
    const item = input(ctx, block, 'ITEM', '0');
    return line(ctx, indentLevel, `${list}.splice(${index} - 1, 0, ${item});`);
}));
reg('data_replaceitemoflist', statement((ctx, block, indentLevel) => {
    const list = listName(ctx, block);
    const index = input(ctx, block, 'INDEX', '1');
    const item = input(ctx, block, 'ITEM', '0');
    return line(ctx, indentLevel, `${list}[${index} - 1] = ${item};`);
}));
reg('data_itemoflist', expression((ctx, block) => {
    const list = listName(ctx, block);
    return `${list}[${input(ctx, block, 'INDEX', '1')} - 1]`;
}));
reg('data_itemnumoflist', expression((ctx, block) => {
    const list = listName(ctx, block);
    return `(${list}.indexOf(${input(ctx, block, 'ITEM', '0')}) + 1)`;
}));
reg('data_lengthoflist', expression((ctx, block) => {
    const list = listName(ctx, block);
    return `${list}.length`;
}));
reg('data_listcontainsitem', expression((ctx, block) => {
    const list = listName(ctx, block);
    return `${list}.includes(${input(ctx, block, 'ITEM', '0')})`;
}));
reg('data_showvariable', noOpStatement('show variable monitor'));
reg('data_hidevariable', noOpStatement('hide variable monitor'));
reg('data_showlist', noOpStatement('show list monitor'));
reg('data_hidelist', noOpStatement('hide list monitor'));

// ─── Procedures ───
reg('procedures_definition', statement((ctx, block, indentLevel) => {
    const body = ctx.generateStack(block.next, indentLevel + 1) || emptyBody(ctx, indentLevel + 1);
    return [
        line(ctx, indentLevel, `void ${procedureName(block)} () {`),
        body,
        line(ctx, indentLevel, '}')
    ].join('\n');
}));
reg('procedures_call', statement((ctx, block, indentLevel) => (
    line(ctx, indentLevel, `${procedureName(block)}();`)
)));
reg('argument_reporter_string_number', expression((ctx, block) => (
    sanitizeIdentifier(field(ctx, block, 'VALUE', 'argument'))
)));
reg('argument_reporter_boolean', expression((ctx, block) => (
    sanitizeIdentifier(field(ctx, block, 'VALUE', 'argument'))
)));

const getCodeGenerators = () => generators;

module.exports = {
    getCodeGenerators
};
