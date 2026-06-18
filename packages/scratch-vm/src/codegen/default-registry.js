const GeneratorRegistry = require('./generator-registry');
const Language = require('./language');
const ThingBotTelemetrixExtension = require('../extensions/scratch3_thingbot_telemetrix');

const LANGUAGES = [Language.JAVASCRIPT, Language.ARDUINO_CPP];

const statement = generate => ({type: 'statement', generate});
const expression = generate => ({type: 'expression', generate});

const quote = value => JSON.stringify(String(value));
const input = (ctx, block, name, fallback) => ctx.generateInput(block, name, fallback);
const field = (ctx, block, name, fallback) => ctx.getFieldValue(block, name, fallback);

const sanitizeIdentifier = value => {
    const identifier = String(value || 'value')
        .replace(/[^A-Za-z0-9_$]/g, '_')
        .replace(/^[^A-Za-z_$]/, '_$&');
    return identifier || 'value';
};

const variableName = (ctx, block, fieldName, fallback) => {
    const variable = block.fields && block.fields[fieldName];
    return sanitizeIdentifier((variable && (variable.value || variable.name)) || fallback);
};

const procedureName = block => {
    const mutation = block.mutation || {};
    return sanitizeIdentifier(mutation.proccode || 'custom_block');
};

const line = (ctx, indentLevel, code) => `${ctx.indent(indentLevel)}${code}`;

const emptyBody = (ctx, indentLevel) => line(ctx, indentLevel, '/* no blocks */');

const bodyOrEmpty = (ctx, block, branchName, indentLevel) => (
    ctx.generateSubstack(block, branchName, indentLevel) || emptyBody(ctx, indentLevel)
);

const registerBoth = (registry, opcode, jsGenerator, arduinoGenerator) => {
    registry.register(opcode, Language.JAVASCRIPT, jsGenerator);
    registry.register(opcode, Language.ARDUINO_CPP, arduinoGenerator);
};

const binaryExpression = (leftName, operator, rightName, fallback) => expression((ctx, block) => {
    const left = input(ctx, block, leftName, fallback);
    const right = input(ctx, block, rightName, fallback);
    return `(${left} ${operator} ${right})`;
});

const noOpStatement = label => statement((ctx, block, indentLevel) => (
    line(ctx, indentLevel, `/* ${label}: ${block.opcode} */`)
));

const registerSharedExpressions = registry => {
    for (const language of LANGUAGES) {
        registry.register('math_number', language, expression((ctx, block) => field(ctx, block, 'NUM', '0')));
        registry.register('math_integer', language, expression((ctx, block) => field(ctx, block, 'NUM', '0')));
        registry.register('math_whole_number', language, expression((ctx, block) => field(ctx, block, 'NUM', '0')));
        registry.register('math_positive_number', language, expression((ctx, block) => field(ctx, block, 'NUM', '0')));
        registry.register('text', language, expression((ctx, block) => quote(field(ctx, block, 'TEXT', ''))));
        registry.register('data_listindexall', language, expression((ctx, block) => (
            quote(field(ctx, block, 'INDEX', 'all'))
        )));
        registry.register('data_listindexrandom', language, expression((ctx, block) => (
            quote(field(ctx, block, 'INDEX', 'random'))
        )));

        registry.register('operator_add', language, binaryExpression('NUM1', '+', 'NUM2', '0'));
        registry.register('operator_subtract', language, binaryExpression('NUM1', '-', 'NUM2', '0'));
        registry.register('operator_multiply', language, binaryExpression('NUM1', '*', 'NUM2', '0'));
        registry.register('operator_divide', language, binaryExpression('NUM1', '/', 'NUM2', '0'));
        registry.register('operator_lt', language, binaryExpression('OPERAND1', '<', 'OPERAND2', '0'));
        registry.register('operator_gt', language, binaryExpression('OPERAND1', '>', 'OPERAND2', '0'));
        registry.register('operator_equals', language, binaryExpression('OPERAND1', '==', 'OPERAND2', '0'));
        registry.register('operator_and', language, binaryExpression('OPERAND1', '&&', 'OPERAND2', 'false'));
        registry.register('operator_or', language, binaryExpression('OPERAND1', '||', 'OPERAND2', 'false'));
        registry.register('operator_not', language, expression((ctx, block) => (
            `(!${input(ctx, block, 'OPERAND', 'false')})`
        )));
    }
};

const registerOperators = registry => {
    registerBoth(
        registry,
        'operator_random',
        expression((ctx, block) => {
            const from = input(ctx, block, 'FROM', '0');
            const to = input(ctx, block, 'TO', '1');
            return `(${from} + (Math.random() * (${to} - ${from})))`;
        }),
        expression((ctx, block) => {
            const from = input(ctx, block, 'FROM', '0');
            const to = input(ctx, block, 'TO', '1');
            return `random(${from}, ${to} + 1)`;
        })
    );
    registerBoth(
        registry,
        'operator_join',
        expression((ctx, block) => {
            const first = input(ctx, block, 'STRING1', '""');
            const second = input(ctx, block, 'STRING2', '""');
            return `(String(${first}) + String(${second}))`;
        }),
        expression((ctx, block) => {
            const first = input(ctx, block, 'STRING1', '""');
            const second = input(ctx, block, 'STRING2', '""');
            return `(String(${first}) + String(${second}))`;
        })
    );
    registerBoth(
        registry,
        'operator_letter_of',
        expression((ctx, block) => {
            const index = input(ctx, block, 'LETTER', '1');
            const string = input(ctx, block, 'STRING', '""');
            return `String(${string}).charAt(${index} - 1)`;
        }),
        expression((ctx, block) => {
            const index = input(ctx, block, 'LETTER', '1');
            const string = input(ctx, block, 'STRING', '""');
            return `String(${string}).charAt(${index} - 1)`;
        })
    );
    registerBoth(
        registry,
        'operator_length',
        expression((ctx, block) => `String(${input(ctx, block, 'STRING', '""')}).length`),
        expression((ctx, block) => `String(${input(ctx, block, 'STRING', '""')}).length()`)
    );
    registerBoth(
        registry,
        'operator_contains',
        expression((ctx, block) => {
            const string = input(ctx, block, 'STRING1', '""');
            const search = input(ctx, block, 'STRING2', '""');
            return `String(${string}).includes(String(${search}))`;
        }),
        expression((ctx, block) => {
            const string = input(ctx, block, 'STRING1', '""');
            const search = input(ctx, block, 'STRING2', '""');
            return `(String(${string}).indexOf(String(${search})) >= 0)`;
        })
    );
    registerBoth(
        registry,
        'operator_mod',
        expression((ctx, block) => {
            const number = input(ctx, block, 'NUM1', '0');
            const modulus = input(ctx, block, 'NUM2', '1');
            return `(((${number} % ${modulus}) + ${modulus}) % ${modulus})`;
        }),
        expression((ctx, block) => {
            const number = input(ctx, block, 'NUM1', '0');
            const modulus = input(ctx, block, 'NUM2', '1');
            return `(((${number} % ${modulus}) + ${modulus}) % ${modulus})`;
        })
    );
    registerBoth(
        registry,
        'operator_round',
        expression((ctx, block) => `Math.round(${input(ctx, block, 'NUM', '0')})`),
        expression((ctx, block) => `round(${input(ctx, block, 'NUM', '0')})`)
    );
    registerBoth(
        registry,
        'operator_mathop',
        expression((ctx, block) => {
            const operator = String(field(ctx, block, 'OPERATOR', 'abs')).toLowerCase();
            const number = input(ctx, block, 'NUM', '0');
            const jsOperators = {
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
            if (operator === 'e ^') return `Math.exp(${number})`;
            if (operator === '10 ^') return `Math.pow(10, ${number})`;
            return `Math.${jsOperators[operator] || 'abs'}(${number})`;
        }),
        expression((ctx, block) => {
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
        })
    );
};

const registerEvents = registry => {
    registry.register('event_whenflagclicked', Language.JAVASCRIPT, statement((ctx, block) => {
        const body = ctx.generateStack(block.next, 1);
        return `async function whenGreenFlagClicked () {\n${body}\n}\n\nwhenGreenFlagClicked();`;
    }));
    registry.register('event_whenflagclicked', Language.ARDUINO_CPP, statement((ctx, block) => (
        ctx.generateStack(block.next, 1)
    )));

    registry.register('event_whenkeypressed', Language.JAVASCRIPT, statement((ctx, block) => {
        const key = quote(field(ctx, block, 'KEY_OPTION', 'space'));
        const body = ctx.generateStack(block.next, 2);
        return [
            'window.addEventListener("keydown", async event => {',
            `    if (event.key === ${key}) {`,
            body || '        /* no blocks */',
            '    }',
            '});'
        ].join('\n');
    }));
    registry.register('event_whenkeypressed', Language.ARDUINO_CPP, statement((ctx, block) => (
        [
            '    /* Keyboard events are not available on Arduino boards. */',
            ctx.generateStack(block.next, 1)
        ].filter(Boolean).join('\n')
    )));
};

const registerControl = registry => {
    for (const language of LANGUAGES) {
        registry.register('control_repeat', language, statement((ctx, block, indentLevel) => {
            const times = input(ctx, block, 'TIMES', '0');
            const iterator = `i${indentLevel || 0}`;
            const variableType = language === Language.ARDUINO_CPP ? 'int ' : 'let ';
            const body = bodyOrEmpty(ctx, block, ctx.branchInputName(1), indentLevel + 1);
            return [
                line(ctx, indentLevel, `for (${variableType}${iterator} = 0; ${iterator} < ${times}; ${iterator}++) {`),
                body,
                line(ctx, indentLevel, '}')
            ].join('\n');
        }));
        registry.register('control_forever', language, statement((ctx, block, indentLevel) => {
            const body = bodyOrEmpty(ctx, block, ctx.branchInputName(1), indentLevel + 1);
            return [
                line(ctx, indentLevel, 'while (true) {'),
                body,
                line(ctx, indentLevel, '}')
            ].join('\n');
        }));
        registry.register('control_repeat_until', language, statement((ctx, block, indentLevel) => {
            const condition = input(ctx, block, 'CONDITION', 'false');
            const body = bodyOrEmpty(ctx, block, ctx.branchInputName(1), indentLevel + 1);
            return [
                line(ctx, indentLevel, `while (!(${condition})) {`),
                body,
                line(ctx, indentLevel, '}')
            ].join('\n');
        }));
        registry.register('control_while', language, statement((ctx, block, indentLevel) => {
            const condition = input(ctx, block, 'CONDITION', 'false');
            const body = bodyOrEmpty(ctx, block, ctx.branchInputName(1), indentLevel + 1);
            return [
                line(ctx, indentLevel, `while (${condition}) {`),
                body,
                line(ctx, indentLevel, '}')
            ].join('\n');
        }));
        registry.register('control_if', language, statement((ctx, block, indentLevel) => {
            const condition = input(ctx, block, 'CONDITION', 'false');
            const body = bodyOrEmpty(ctx, block, ctx.branchInputName(1), indentLevel + 1);
            return [
                line(ctx, indentLevel, `if (${condition}) {`),
                body,
                line(ctx, indentLevel, '}')
            ].join('\n');
        }));
        registry.register('control_if_else', language, statement((ctx, block, indentLevel) => {
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
        registry.register('control_all_at_once', language, statement((ctx, block, indentLevel) => (
            ctx.generateSubstack(block, ctx.branchInputName(1), indentLevel) ||
            line(ctx, indentLevel, '/* no blocks */')
        )));
        registry.register('control_stop', language, statement((ctx, block, indentLevel) => {
            const option = field(ctx, block, 'STOP_OPTION', 'this script');
            return line(ctx, indentLevel, `return; /* stop ${option} */`);
        }));
        registry.register('control_clear_counter', language, statement((ctx, block, indentLevel) => (
            line(ctx, indentLevel, '__scratchCounter = 0;')
        )));
        registry.register('control_incr_counter', language, statement((ctx, block, indentLevel) => (
            line(ctx, indentLevel, '__scratchCounter++;')
        )));
        registry.register('control_get_counter', language, expression(() => '__scratchCounter'));
    }

    registry.register('control_wait', Language.JAVASCRIPT, statement((ctx, block, indentLevel) => {
        ctx.addHelper('const delay = ms => new Promise(resolve => setTimeout(resolve, ms));');
        const duration = input(ctx, block, 'DURATION', '0');
        return line(ctx, indentLevel, `await delay(1000 * ${duration});`);
    }));
    registry.register('control_wait', Language.ARDUINO_CPP, statement((ctx, block, indentLevel) => {
        const duration = input(ctx, block, 'DURATION', '0');
        return line(ctx, indentLevel, `delay(1000 * ${duration});`);
    }));
    registry.register('control_wait_until', Language.JAVASCRIPT, statement((ctx, block, indentLevel) => {
        ctx.addHelper('const delay = ms => new Promise(resolve => setTimeout(resolve, ms));');
        const condition = input(ctx, block, 'CONDITION', 'false');
        return line(ctx, indentLevel, `while (!(${condition})) await delay(16);`);
    }));
    registry.register('control_wait_until', Language.ARDUINO_CPP, statement((ctx, block, indentLevel) => {
        const condition = input(ctx, block, 'CONDITION', 'false');
        return line(ctx, indentLevel, `while (!(${condition})) { delay(16); }`);
    }));
    registry.register('control_for_each', Language.JAVASCRIPT, statement((ctx, block, indentLevel) => {
        const variable = variableName(ctx, block, 'VARIABLE', 'item');
        const value = input(ctx, block, 'VALUE', '0');
        const body = bodyOrEmpty(ctx, block, ctx.branchInputName(1), indentLevel + 1);
        return [
            line(ctx, indentLevel, `for (let ${variable} = 1; ${variable} <= ${value}; ${variable}++) {`),
            body,
            line(ctx, indentLevel, '}')
        ].join('\n');
    }));
    registry.register('control_for_each', Language.ARDUINO_CPP, statement((ctx, block, indentLevel) => {
        const variable = variableName(ctx, block, 'VARIABLE', 'item');
        const value = input(ctx, block, 'VALUE', '0');
        const body = bodyOrEmpty(ctx, block, ctx.branchInputName(1), indentLevel + 1);
        return [
            line(ctx, indentLevel, `for (int ${variable} = 1; ${variable} <= ${value}; ${variable}++) {`),
            body,
            line(ctx, indentLevel, '}')
        ].join('\n');
    }));
    registry.register('control_print', Language.JAVASCRIPT, statement((ctx, block, indentLevel) => {
        const value = input(ctx, block, 'STRING', '""');
        return line(ctx, indentLevel, `console.log(${value});`);
    }));
    registry.register('control_print', Language.ARDUINO_CPP, statement((ctx, block, indentLevel) => {
        ctx.addSetup('Serial.begin(9600);');
        const value = input(ctx, block, 'STRING', '""');
        return line(ctx, indentLevel, `Serial.println(${value});`);
    }));
};

const registerData = registry => {
    registerBoth(
        registry,
        'data_variable',
        expression((ctx, block) => variableName(ctx, block, 'VARIABLE', 'variable')),
        expression((ctx, block) => variableName(ctx, block, 'VARIABLE', 'variable'))
    );
    registerBoth(
        registry,
        'data_setvariableto',
        statement((ctx, block, indentLevel) => {
            const variable = variableName(ctx, block, 'VARIABLE', 'variable');
            return line(ctx, indentLevel, `let ${variable} = ${input(ctx, block, 'VALUE', '0')};`);
        }),
        statement((ctx, block, indentLevel) => {
            const variable = variableName(ctx, block, 'VARIABLE', 'variable');
            return line(ctx, indentLevel, `int ${variable} = ${input(ctx, block, 'VALUE', '0')};`);
        })
    );
    for (const language of LANGUAGES) {
        registry.register('data_changevariableby', language, statement((ctx, block, indentLevel) => {
            const variable = variableName(ctx, block, 'VARIABLE', 'variable');
            return line(ctx, indentLevel, `${variable} += ${input(ctx, block, 'VALUE', '0')};`);
        }));
        registry.register('data_listcontents', language, expression((ctx, block) => (
            variableName(ctx, block, 'LIST', 'list')
        )));
        registry.register('data_addtolist', language, statement((ctx, block, indentLevel) => {
            const list = variableName(ctx, block, 'LIST', 'list');
            return line(ctx, indentLevel, `${list}.push(${input(ctx, block, 'ITEM', '0')});`);
        }));
        registry.register('data_deleteoflist', language, statement((ctx, block, indentLevel) => {
            const list = variableName(ctx, block, 'LIST', 'list');
            return line(ctx, indentLevel, `${list}.splice(${input(ctx, block, 'INDEX', '1')} - 1, 1);`);
        }));
        registry.register('data_deletealloflist', language, statement((ctx, block, indentLevel) => {
            const list = variableName(ctx, block, 'LIST', 'list');
            return line(ctx, indentLevel, `${list}.length = 0;`);
        }));
        registry.register('data_insertatlist', language, statement((ctx, block, indentLevel) => {
            const list = variableName(ctx, block, 'LIST', 'list');
            const index = input(ctx, block, 'INDEX', '1');
            const item = input(ctx, block, 'ITEM', '0');
            return line(ctx, indentLevel, `${list}.splice(${index} - 1, 0, ${item});`);
        }));
        registry.register('data_replaceitemoflist', language, statement((ctx, block, indentLevel) => {
            const list = variableName(ctx, block, 'LIST', 'list');
            const index = input(ctx, block, 'INDEX', '1');
            const item = input(ctx, block, 'ITEM', '0');
            return line(ctx, indentLevel, `${list}[${index} - 1] = ${item};`);
        }));
        registry.register('data_itemoflist', language, expression((ctx, block) => {
            const list = variableName(ctx, block, 'LIST', 'list');
            return `${list}[${input(ctx, block, 'INDEX', '1')} - 1]`;
        }));
        registry.register('data_itemnumoflist', language, expression((ctx, block) => {
            const list = variableName(ctx, block, 'LIST', 'list');
            return `(${list}.indexOf(${input(ctx, block, 'ITEM', '0')}) + 1)`;
        }));
        registry.register('data_lengthoflist', language, expression((ctx, block) => {
            const list = variableName(ctx, block, 'LIST', 'list');
            return `${list}.length`;
        }));
        registry.register('data_listcontainsitem', language, expression((ctx, block) => {
            const list = variableName(ctx, block, 'LIST', 'list');
            return `${list}.includes(${input(ctx, block, 'ITEM', '0')})`;
        }));
        registry.register('data_showvariable', language, noOpStatement('show variable monitor'));
        registry.register('data_hidevariable', language, noOpStatement('hide variable monitor'));
        registry.register('data_showlist', language, noOpStatement('show list monitor'));
        registry.register('data_hidelist', language, noOpStatement('hide list monitor'));
    }
};

const registerSensing = registry => {
    registry.register('sensing_askandwait', Language.JAVASCRIPT, statement((ctx, block, indentLevel) => {
        ctx.addHelper('let __scratchAnswer = "";');
        const question = input(ctx, block, 'QUESTION', '""');
        return line(ctx, indentLevel, `__scratchAnswer = window.prompt(${question}) || "";`);
    }));
    registry.register('sensing_askandwait', Language.ARDUINO_CPP, statement((ctx, block, indentLevel) => (
        line(ctx, indentLevel, `/* ask ${input(ctx, block, 'QUESTION', '""')} and wait */`)
    )));
    registry.register('sensing_answer', Language.JAVASCRIPT, expression(ctx => {
        ctx.addHelper('let __scratchAnswer = "";');
        return '__scratchAnswer';
    }));
    registry.register('sensing_answer', Language.ARDUINO_CPP, expression(() => '""'));
    registry.register('sensing_timer', Language.JAVASCRIPT, expression(ctx => {
        ctx.addHelper('let __scratchTimerStart = performance.now();');
        return '((performance.now() - __scratchTimerStart) / 1000)';
    }));
    registry.register('sensing_timer', Language.ARDUINO_CPP, expression(() => '(millis() / 1000.0)'));
    registry.register('sensing_resettimer', Language.JAVASCRIPT, statement((ctx, block, indentLevel) => {
        ctx.addHelper('let __scratchTimerStart = performance.now();');
        return line(ctx, indentLevel, '__scratchTimerStart = performance.now();');
    }));
    registry.register('sensing_resettimer', Language.ARDUINO_CPP, noOpStatement('reset timer'));
    registry.register('sensing_mousex', Language.JAVASCRIPT, expression(() => '__scratchMouseX'));
    registry.register('sensing_mousey', Language.JAVASCRIPT, expression(() => '__scratchMouseY'));
    registry.register('sensing_mousedown', Language.JAVASCRIPT, expression(() => '__scratchMouseDown'));
    registry.register('sensing_keypressed', Language.JAVASCRIPT, expression((ctx, block) => (
        `Boolean(__scratchKeys && __scratchKeys[${quote(field(ctx, block, 'KEY_OPTION', 'space'))}])`
    )));
    registry.register('sensing_mousex', Language.ARDUINO_CPP, expression(() => '0'));
    registry.register('sensing_mousey', Language.ARDUINO_CPP, expression(() => '0'));
    registry.register('sensing_mousedown', Language.ARDUINO_CPP, expression(() => 'false'));
    registry.register('sensing_keypressed', Language.ARDUINO_CPP, expression(() => 'false'));
    registry.register('sensing_current', Language.JAVASCRIPT, expression((ctx, block) => {
        const option = String(field(ctx, block, 'CURRENTMENU', 'year')).toLowerCase();
        const values = {
            year: 'new Date().getFullYear()',
            month: '(new Date().getMonth() + 1)',
            date: 'new Date().getDate()',
            dayofweek: '(new Date().getDay() + 1)',
            hour: 'new Date().getHours()',
            minute: 'new Date().getMinutes()',
            second: 'new Date().getSeconds()'
        };
        return values[option] || '0';
    }));
    registry.register('sensing_current', Language.ARDUINO_CPP, expression(() => '0'));
    registry.register('sensing_dayssince2000', Language.JAVASCRIPT, expression(() => (
        '((Date.now() - new Date(2000, 0, 1).valueOf()) / 86400000)'
    )));
    registry.register('sensing_dayssince2000', Language.ARDUINO_CPP, expression(() => '0'));
    registry.register('sensing_online', Language.JAVASCRIPT, expression(() => 'navigator.onLine'));
    registry.register('sensing_online', Language.ARDUINO_CPP, expression(() => 'false'));
};

const registerProcedures = registry => {
    for (const language of LANGUAGES) {
        registry.register('procedures_definition', language, statement((ctx, block, indentLevel) => {
            const body = ctx.generateStack(block.next, indentLevel + 1) || emptyBody(ctx, indentLevel + 1);
            const keyword = language === Language.ARDUINO_CPP ? 'void ' : 'async function ';
            return [
                line(ctx, indentLevel, `${keyword}${procedureName(block)} () {`),
                body,
                line(ctx, indentLevel, '}')
            ].join('\n');
        }));
        registry.register('procedures_call', language, statement((ctx, block, indentLevel) => (
            line(ctx, indentLevel, `${procedureName(block)}();`)
        )));
        registry.register('argument_reporter_string_number', language, expression((ctx, block) => (
            sanitizeIdentifier(field(ctx, block, 'VALUE', 'argument'))
        )));
        registry.register('argument_reporter_boolean', language, expression((ctx, block) => (
            sanitizeIdentifier(field(ctx, block, 'VALUE', 'argument'))
        )));
    }
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
    registry.registerProvider(ThingBotTelemetrixExtension);
    return registry;
};

module.exports = createDefaultRegistry;
