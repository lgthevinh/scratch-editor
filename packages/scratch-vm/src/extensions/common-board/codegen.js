const {
    Language,
    statement
} = require('../../codegen/code-generator-provider');

const ARDUINO = Language.ARDUINO_CPP;

const generators = [];
const reg = (opcode, generator) => generators.push({opcode, language: ARDUINO, generator});

// The board execution model: the green-flag script becomes the loop() body, and the board-only
// begin/loop hats route their bodies to the Arduino setup()/loop() functions.

reg('event_whenflagclicked', statement((ctx, block) => ctx.generateStack(block.next, 1)));

reg('event_whenarduinobegin', statement((ctx, block) => {
    ctx.addSetupBlock(ctx.generateStack(block.next, 1));
    return '';
}));
reg('event_whenarduinoloop', statement((ctx, block) => ctx.generateStack(block.next, 1)));

const getCodeGenerators = () => generators;

module.exports = {
    getCodeGenerators
};
