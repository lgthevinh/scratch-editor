const {
    Language,
    expression,
    input,
    line,
    statement
} = require('../../codegen/code-generator-provider');

const ARDUINO = Language.ARDUINO_CPP;

const noOpStatement = label => statement((ctx, block, indentLevel) => (
    line(ctx, indentLevel, `/* ${label}: ${block.opcode} */`)
));

const generators = [];
const reg = (opcode, generator) => generators.push({opcode, language: ARDUINO, generator});

// Host-only blocks have no firmware meaning; in board mode they degrade to a stub value, a no-op,
// or a diagnostic so a stray host block in a firmware project does not break code generation.

// ─── Keyboard events (host-only) ───
reg('event_whenkeypressed', statement((ctx, block) => (
    [
        '    /* Keyboard events are not available on Arduino boards. */',
        ctx.generateStack(block.next, 1)
    ].filter(Boolean).join('\n')
)));

// ─── Sensing (host-only) ───
reg('sensing_askandwait', statement((ctx, block, indentLevel) => (
    line(ctx, indentLevel, `/* ask ${input(ctx, block, 'QUESTION', '""')} and wait */`)
)));
reg('sensing_answer', expression(() => '""'));
reg('sensing_timer', expression(() => '(millis() / 1000.0)'));
reg('sensing_resettimer', noOpStatement('reset timer'));
reg('sensing_mousex', expression(() => '0'));
reg('sensing_mousey', expression(() => '0'));
reg('sensing_mousedown', expression(() => 'false'));
reg('sensing_keypressed', expression(() => 'false'));
reg('sensing_current', expression(() => '0'));
reg('sensing_dayssince2000', expression(() => '0'));
reg('sensing_online', expression(() => 'false'));

const getCodeGenerators = () => generators;

module.exports = {
    getCodeGenerators
};
