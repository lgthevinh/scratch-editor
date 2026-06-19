const GeneratorRegistry = require('./generator-registry');
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
} = require('./code-generator-provider');
const Scratch3Arduino = require('../extensions/scratch3_arduino');

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

// Warns (without blocking) when a value's kind doesn't match the variable's type, pointing the
// learner at the convert block that would fix it.
const checkAssignment = (ctx, block, name, type) => {
    const valueIsString = ctx.expressionKind(ctx.getInputBlockId(block, 'VALUE')) === 'string';
    const variableIsString = type === 'string';
    if (variableIsString !== valueIsString) {
        const convert = variableIsString ? 'to text' : 'to number';
        ctx.addDiagnostic(
            'warning',
            `Variable '${name}' holds ${variableIsString ? 'text' : 'a number'} but is being ` +
                `assigned ${valueIsString ? 'text' : 'a number'}; wrap the value in the ` +
                `'${convert}' block`,
            block
        );
    }
};

// Lists keep the JavaScript-array preview (C++ array support is a follow-up).
const listName = (ctx, block) => variableName(block, 'LIST', 'list');

const emptyBody = (ctx, indentLevel) => line(ctx, indentLevel, '/* no blocks */');

const bodyOrEmpty = (ctx, block, branchName, indentLevel) => (
    ctx.generateSubstack(block, branchName, indentLevel) || emptyBody(ctx, indentLevel)
);

const register = (registry, opcode, generator) => registry.register(opcode, ARDUINO, generator);

const binaryExpression = (leftName, operator, rightName, fallback) => expression((ctx, block) => {
    const left = input(ctx, block, leftName, fallback);
    const right = input(ctx, block, rightName, fallback);
    return `(${left} ${operator} ${right})`;
});

const noOpStatement = label => statement((ctx, block, indentLevel) => (
    line(ctx, indentLevel, `/* ${label}: ${block.opcode} */`)
));

const registerSharedExpressions = registry => {
    register(registry, 'math_number', expression((ctx, block) => field(ctx, block, 'NUM', '0')));
    register(registry, 'math_integer', expression((ctx, block) => field(ctx, block, 'NUM', '0')));
    register(registry, 'math_whole_number', expression((ctx, block) => field(ctx, block, 'NUM', '0')));
    register(registry, 'math_positive_number', expression((ctx, block) => field(ctx, block, 'NUM', '0')));
    register(registry, 'text', expression((ctx, block) => quote(field(ctx, block, 'TEXT', ''))));
    register(registry, 'data_listindexall', expression((ctx, block) => quote(field(ctx, block, 'INDEX', 'all'))));
    register(registry, 'data_listindexrandom', expression((ctx, block) => (
        quote(field(ctx, block, 'INDEX', 'random'))
    )));

    register(registry, 'operator_add', binaryExpression('NUM1', '+', 'NUM2', '0'));
    register(registry, 'operator_subtract', binaryExpression('NUM1', '-', 'NUM2', '0'));
    register(registry, 'operator_multiply', binaryExpression('NUM1', '*', 'NUM2', '0'));
    register(registry, 'operator_divide', binaryExpression('NUM1', '/', 'NUM2', '0'));
    register(registry, 'operator_lt', binaryExpression('OPERAND1', '<', 'OPERAND2', '0'));
    register(registry, 'operator_gt', binaryExpression('OPERAND1', '>', 'OPERAND2', '0'));
    register(registry, 'operator_equals', binaryExpression('OPERAND1', '==', 'OPERAND2', '0'));
    register(registry, 'operator_and', binaryExpression('OPERAND1', '&&', 'OPERAND2', 'false'));
    register(registry, 'operator_or', binaryExpression('OPERAND1', '||', 'OPERAND2', 'false'));
    register(registry, 'operator_not', expression((ctx, block) => `(!${input(ctx, block, 'OPERAND', 'false')})`));
};

const registerOperators = registry => {
    register(registry, 'operator_random', expression((ctx, block) => {
        const from = input(ctx, block, 'FROM', '0');
        const to = input(ctx, block, 'TO', '1');
        return `random(${from}, ${to} + 1)`;
    }));
    register(registry, 'operator_join', expression((ctx, block) => {
        const first = input(ctx, block, 'STRING1', '""');
        const second = input(ctx, block, 'STRING2', '""');
        return `(String(${first}) + String(${second}))`;
    }));
    register(registry, 'operator_letter_of', expression((ctx, block) => {
        const index = input(ctx, block, 'LETTER', '1');
        const string = input(ctx, block, 'STRING', '""');
        return `String(${string}).charAt(${index} - 1)`;
    }));
    register(registry, 'operator_length', expression((ctx, block) => (
        `String(${input(ctx, block, 'STRING', '""')}).length()`
    )));
    register(registry, 'operator_contains', expression((ctx, block) => {
        const string = input(ctx, block, 'STRING1', '""');
        const search = input(ctx, block, 'STRING2', '""');
        return `(String(${string}).indexOf(String(${search})) >= 0)`;
    }));
    register(registry, 'operator_mod', expression((ctx, block) => {
        const number = input(ctx, block, 'NUM1', '0');
        const modulus = input(ctx, block, 'NUM2', '1');
        return `(((${number} % ${modulus}) + ${modulus}) % ${modulus})`;
    }));
    register(registry, 'operator_round', expression((ctx, block) => `round(${input(ctx, block, 'NUM', '0')})`));
    register(registry, 'operator_mathop', expression((ctx, block) => {
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
    register(registry, 'operator_tonumber', expression((ctx, block) => (
        `String(${input(ctx, block, 'VALUE', '0')}).toFloat()`
    )));
    register(registry, 'operator_totext', expression((ctx, block) => (
        `String(${input(ctx, block, 'VALUE', '""')})`
    )));
};

const registerEvents = registry => {
    register(registry, 'event_whenflagclicked', statement((ctx, block) => ctx.generateStack(block.next, 1)));
    register(registry, 'event_whenkeypressed', statement((ctx, block) => (
        [
            '    /* Keyboard events are not available on Arduino boards. */',
            ctx.generateStack(block.next, 1)
        ].filter(Boolean).join('\n')
    )));

    // Board-only hats: route their bodies to the Arduino setup()/loop() functions.
    register(registry, 'event_whenarduinobegin', statement((ctx, block) => {
        ctx.addSetupBlock(ctx.generateStack(block.next, 1));
        return '';
    }));
    register(registry, 'event_whenarduinoloop', statement((ctx, block) => ctx.generateStack(block.next, 1)));
};

const registerControl = registry => {
    register(registry, 'control_repeat', statement((ctx, block, indentLevel) => {
        const times = input(ctx, block, 'TIMES', '0');
        const iterator = `i${indentLevel || 0}`;
        const body = bodyOrEmpty(ctx, block, ctx.branchInputName(1), indentLevel + 1);
        return [
            line(ctx, indentLevel, `for (int ${iterator} = 0; ${iterator} < ${times}; ${iterator}++) {`),
            body,
            line(ctx, indentLevel, '}')
        ].join('\n');
    }));
    register(registry, 'control_forever', statement((ctx, block, indentLevel) => {
        const body = bodyOrEmpty(ctx, block, ctx.branchInputName(1), indentLevel + 1);
        return [
            line(ctx, indentLevel, 'while (true) {'),
            body,
            line(ctx, indentLevel, '}')
        ].join('\n');
    }));
    register(registry, 'control_repeat_until', statement((ctx, block, indentLevel) => {
        const condition = input(ctx, block, 'CONDITION', 'false');
        const body = bodyOrEmpty(ctx, block, ctx.branchInputName(1), indentLevel + 1);
        return [
            line(ctx, indentLevel, `while (!(${condition})) {`),
            body,
            line(ctx, indentLevel, '}')
        ].join('\n');
    }));
    register(registry, 'control_while', statement((ctx, block, indentLevel) => {
        const condition = input(ctx, block, 'CONDITION', 'false');
        const body = bodyOrEmpty(ctx, block, ctx.branchInputName(1), indentLevel + 1);
        return [
            line(ctx, indentLevel, `while (${condition}) {`),
            body,
            line(ctx, indentLevel, '}')
        ].join('\n');
    }));
    register(registry, 'control_if', statement((ctx, block, indentLevel) => {
        const condition = input(ctx, block, 'CONDITION', 'false');
        const body = bodyOrEmpty(ctx, block, ctx.branchInputName(1), indentLevel + 1);
        return [
            line(ctx, indentLevel, `if (${condition}) {`),
            body,
            line(ctx, indentLevel, '}')
        ].join('\n');
    }));
    register(registry, 'control_if_else', statement((ctx, block, indentLevel) => {
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
    register(registry, 'control_all_at_once', statement((ctx, block, indentLevel) => (
        ctx.generateSubstack(block, ctx.branchInputName(1), indentLevel) ||
        line(ctx, indentLevel, '/* no blocks */')
    )));
    register(registry, 'control_stop', statement((ctx, block, indentLevel) => {
        const option = field(ctx, block, 'STOP_OPTION', 'this script');
        return line(ctx, indentLevel, `return; /* stop ${option} */`);
    }));
    register(registry, 'control_clear_counter', statement((ctx, block, indentLevel) => (
        line(ctx, indentLevel, '__scratchCounter = 0;')
    )));
    register(registry, 'control_incr_counter', statement((ctx, block, indentLevel) => (
        line(ctx, indentLevel, '__scratchCounter++;')
    )));
    register(registry, 'control_get_counter', expression(() => '__scratchCounter'));

    register(registry, 'control_wait', statement((ctx, block, indentLevel) => {
        const duration = input(ctx, block, 'DURATION', '0');
        return line(ctx, indentLevel, `delay(1000 * ${duration});`);
    }));
    register(registry, 'control_wait_until', statement((ctx, block, indentLevel) => {
        const condition = input(ctx, block, 'CONDITION', 'false');
        return line(ctx, indentLevel, `while (!(${condition})) { delay(16); }`);
    }));
    register(registry, 'control_for_each', statement((ctx, block, indentLevel) => {
        const variable = variableName(block, 'VARIABLE', 'item');
        const value = input(ctx, block, 'VALUE', '0');
        const body = bodyOrEmpty(ctx, block, ctx.branchInputName(1), indentLevel + 1);
        return [
            line(ctx, indentLevel, `for (int ${variable} = 1; ${variable} <= ${value}; ${variable}++) {`),
            body,
            line(ctx, indentLevel, '}')
        ].join('\n');
    }));
    register(registry, 'control_print', statement((ctx, block, indentLevel) => {
        ctx.addSetup('Serial.begin(9600);');
        const value = input(ctx, block, 'STRING', '""');
        return line(ctx, indentLevel, `Serial.println(${value});`);
    }));
};

const registerData = registry => {
    register(registry, 'data_variable', expression((ctx, block) => ensureVariable(ctx, block)));
    register(registry, 'data_setvariableto', statement((ctx, block, indentLevel) => {
        const variable = ensureVariable(ctx, block);
        const type = ctx.variableType(variable);
        checkAssignment(ctx, block, variable, type);
        const value = input(ctx, block, 'VALUE', type === 'string' ? '""' : '0');
        return line(ctx, indentLevel, `${variable} = ${value};`);
    }));
    register(registry, 'data_changevariableby', statement((ctx, block, indentLevel) => {
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
    register(registry, 'data_listcontents', expression((ctx, block) => listName(ctx, block)));
    register(registry, 'data_addtolist', statement((ctx, block, indentLevel) => {
        const list = listName(ctx, block);
        return line(ctx, indentLevel, `${list}.push(${input(ctx, block, 'ITEM', '0')});`);
    }));
    register(registry, 'data_deleteoflist', statement((ctx, block, indentLevel) => {
        const list = listName(ctx, block);
        return line(ctx, indentLevel, `${list}.splice(${input(ctx, block, 'INDEX', '1')} - 1, 1);`);
    }));
    register(registry, 'data_deletealloflist', statement((ctx, block, indentLevel) => {
        const list = listName(ctx, block);
        return line(ctx, indentLevel, `${list}.length = 0;`);
    }));
    register(registry, 'data_insertatlist', statement((ctx, block, indentLevel) => {
        const list = listName(ctx, block);
        const index = input(ctx, block, 'INDEX', '1');
        const item = input(ctx, block, 'ITEM', '0');
        return line(ctx, indentLevel, `${list}.splice(${index} - 1, 0, ${item});`);
    }));
    register(registry, 'data_replaceitemoflist', statement((ctx, block, indentLevel) => {
        const list = listName(ctx, block);
        const index = input(ctx, block, 'INDEX', '1');
        const item = input(ctx, block, 'ITEM', '0');
        return line(ctx, indentLevel, `${list}[${index} - 1] = ${item};`);
    }));
    register(registry, 'data_itemoflist', expression((ctx, block) => {
        const list = listName(ctx, block);
        return `${list}[${input(ctx, block, 'INDEX', '1')} - 1]`;
    }));
    register(registry, 'data_itemnumoflist', expression((ctx, block) => {
        const list = listName(ctx, block);
        return `(${list}.indexOf(${input(ctx, block, 'ITEM', '0')}) + 1)`;
    }));
    register(registry, 'data_lengthoflist', expression((ctx, block) => {
        const list = listName(ctx, block);
        return `${list}.length`;
    }));
    register(registry, 'data_listcontainsitem', expression((ctx, block) => {
        const list = listName(ctx, block);
        return `${list}.includes(${input(ctx, block, 'ITEM', '0')})`;
    }));
    register(registry, 'data_showvariable', noOpStatement('show variable monitor'));
    register(registry, 'data_hidevariable', noOpStatement('hide variable monitor'));
    register(registry, 'data_showlist', noOpStatement('show list monitor'));
    register(registry, 'data_hidelist', noOpStatement('hide list monitor'));
};

const registerSensing = registry => {
    register(registry, 'sensing_askandwait', statement((ctx, block, indentLevel) => (
        line(ctx, indentLevel, `/* ask ${input(ctx, block, 'QUESTION', '""')} and wait */`)
    )));
    register(registry, 'sensing_answer', expression(() => '""'));
    register(registry, 'sensing_timer', expression(() => '(millis() / 1000.0)'));
    register(registry, 'sensing_resettimer', noOpStatement('reset timer'));
    register(registry, 'sensing_mousex', expression(() => '0'));
    register(registry, 'sensing_mousey', expression(() => '0'));
    register(registry, 'sensing_mousedown', expression(() => 'false'));
    register(registry, 'sensing_keypressed', expression(() => 'false'));
    register(registry, 'sensing_current', expression(() => '0'));
    register(registry, 'sensing_dayssince2000', expression(() => '0'));
    register(registry, 'sensing_online', expression(() => 'false'));
};

const registerProcedures = registry => {
    register(registry, 'procedures_definition', statement((ctx, block, indentLevel) => {
        const body = ctx.generateStack(block.next, indentLevel + 1) || emptyBody(ctx, indentLevel + 1);
        return [
            line(ctx, indentLevel, `void ${procedureName(block)} () {`),
            body,
            line(ctx, indentLevel, '}')
        ].join('\n');
    }));
    register(registry, 'procedures_call', statement((ctx, block, indentLevel) => (
        line(ctx, indentLevel, `${procedureName(block)}();`)
    )));
    register(registry, 'argument_reporter_string_number', expression((ctx, block) => (
        sanitizeIdentifier(field(ctx, block, 'VALUE', 'argument'))
    )));
    register(registry, 'argument_reporter_boolean', expression((ctx, block) => (
        sanitizeIdentifier(field(ctx, block, 'VALUE', 'argument'))
    )));
};

const createDefaultRegistry = () => {
    const registry = new GeneratorRegistry();
    registerSharedExpressions(registry);
    registerOperators(registry);
    registerEvents(registry);
    registerControl(registry);
    registerData(registry);
    registerSensing(registry);
    registerProcedures(registry);
    registry.registerProvider(Scratch3Arduino);
    return registry;
};

module.exports = createDefaultRegistry;
