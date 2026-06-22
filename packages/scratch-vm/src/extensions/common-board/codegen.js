const {
    Language,
    arg,
    expression,
    line,
    statement
} = require('../../codegen/code-generator-provider');

const ARDUINO = Language.ARDUINO_CPP;
const PREFIX = 'arduino_';

const generators = [];
const reg = (opcode, generator) => generators.push({opcode, language: ARDUINO, generator});

// ─── Board execution model ───
// The green-flag script becomes the loop() body, and the board-only begin/loop hats route their
// bodies to the Arduino setup()/loop() functions.
reg('event_whenflagclicked', statement((ctx, block) => ctx.generateStack(block.next, 1)));
reg('event_whenarduinobegin', statement((ctx, block) => {
    ctx.addSetupBlock(ctx.generateStack(block.next, 1));
    return '';
}));
reg('event_whenarduinoloop', statement((ctx, block) => ctx.generateStack(block.next, 1)));

// ─── Standard Arduino API ───
// Shared by every Arduino-compatible board. Pin mode and digital level menu values are C++
// identifiers (OUTPUT, HIGH, ...), so they are emitted unquoted via `arg`, which reads the
// connected input or falls back to the field value.
const command = (opcode, cppCode) => reg(
    `${PREFIX}${opcode}`,
    statement((ctx, block, indentLevel) => line(ctx, indentLevel, `${cppCode(ctx, block)};`))
);
const reporter = (opcode, cppCode) => reg(`${PREFIX}${opcode}`, expression(cppCode));

command(
    'pinMode',
    (ctx, block) => `pinMode(${arg(ctx, block, 'PIN', '13')}, ${arg(ctx, block, 'MODE', 'OUTPUT')})`
);
command(
    'digitalWrite',
    (ctx, block) => `digitalWrite(${arg(ctx, block, 'PIN', '13')}, ${arg(ctx, block, 'LEVEL', 'HIGH')})`
);
reporter(
    'digitalRead',
    (ctx, block) => `digitalRead(${arg(ctx, block, 'PIN', '2')})`
);
command(
    'analogWrite',
    (ctx, block) => `analogWrite(${arg(ctx, block, 'PIN', '9')}, ${arg(ctx, block, 'VALUE', '128')})`
);
reporter(
    'analogRead',
    (ctx, block) => `analogRead(${arg(ctx, block, 'PIN', '0')})`
);
command(
    'delay',
    (ctx, block) => `delay(${arg(ctx, block, 'MS', '1000')})`
);

const getCodeGenerators = () => generators;

module.exports = {
    getCodeGenerators
};
