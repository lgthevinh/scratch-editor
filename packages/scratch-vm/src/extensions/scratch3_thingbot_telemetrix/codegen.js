const {
    Language,
    arg,
    expression,
    line,
    quote,
    statement
} = require('../../codegen/code-generator-provider');

const EXTENSION_ID = 'thingbotTelemetrix';
const PREFIX = `${EXTENSION_ID}_`;

const command = (opcode, jsCode) => ([{
    opcode: `${PREFIX}${opcode}`,
    language: Language.JAVASCRIPT,
    generator: statement((ctx, block, indentLevel) => line(ctx, indentLevel, `${jsCode(ctx, block)};`))
}]);

const reporter = (opcode, jsCode) => ([{
    opcode: `${PREFIX}${opcode}`,
    language: Language.JAVASCRIPT,
    generator: expression(jsCode)
}]);

const getCodeGenerators = () => ([
    ...command(
        'setPinMode',
        (ctx, block) => (
            `thingbot.setPinMode(${arg(ctx, block, 'PIN', '13')}, ${quote(arg(ctx, block, 'MODE', 'OUTPUT'))})`
        )
    ),
    ...command(
        'digitalWrite',
        (ctx, block) => (
            `thingbot.digitalWrite(${arg(ctx, block, 'PIN', '13')}, ${quote(arg(ctx, block, 'LEVEL', 'HIGH'))})`
        )
    ),
    ...reporter(
        'digitalRead',
        (ctx, block) => `thingbot.digitalRead(${arg(ctx, block, 'PIN', '2')})`
    ),
    ...reporter(
        'analogRead',
        (ctx, block) => `thingbot.analogRead(${arg(ctx, block, 'PIN', '0')})`
    ),
    ...command(
        'pwmWrite',
        (ctx, block) => `thingbot.pwmWrite(${arg(ctx, block, 'PIN', '9')}, ${arg(ctx, block, 'VALUE', '128')})`
    ),
    ...command(
        'servoWrite',
        (ctx, block) => `thingbot.servoWrite(${arg(ctx, block, 'SERVO_ID', '1')}, ${arg(ctx, block, 'ANGLE', '90')})`
    ),
    ...command(
        'controlDC',
        (ctx, block) => `thingbot.controlDC(${arg(ctx, block, 'MOTOR_ID', '1')}, ${arg(ctx, block, 'SPEED', '50')})`
    ),
    ...command(
        'controlBuzzer',
        (ctx, block) => `thingbot.controlBuzzer(${arg(ctx, block, 'FREQ', '50')})`
    ),
    ...command(
        'controlLED',
        (ctx, block) => (
            `thingbot.controlLED(${arg(ctx, block, 'LED_ID', '1')}, ${quote(arg(ctx, block, 'LED_STATE', 'on'))})`
        )
    ),
    ...command(
        'setupUltrasonic',
        (ctx, block) => `thingbot.setupUltrasonic(${arg(ctx, block, 'TRIG', '7')}, ${arg(ctx, block, 'ECHO', '8')})`
    ),
    ...reporter(
        'readDistance',
        () => 'thingbot.readDistance()'
    ),
    ...command(
        'setupDHT',
        (ctx, block) => (
            `thingbot.setupDHT(${quote(arg(ctx, block, 'DHT_TYPE', 'DHT11'))}, ${arg(ctx, block, 'PIN', '4')})`
        )
    ),
    ...reporter(
        'readTemperature',
        (ctx, block) => `thingbot.readTemperature(${arg(ctx, block, 'PIN', '4')})`
    ),
    ...reporter(
        'readHumidity',
        (ctx, block) => `thingbot.readHumidity(${arg(ctx, block, 'PIN', '4')})`
    )
]);

module.exports = {
    getCodeGenerators
};
