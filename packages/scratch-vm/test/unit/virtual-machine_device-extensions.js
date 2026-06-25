const tap = require('tap');
const VirtualMachine = require('../../src/virtual-machine');

const test = tap.test;

const deviceBase = 'http://localhost:3030/resources/extensions/devices/thingbot';
const extBase = `${deviceBase}/extension`;

// A device manifest whose hidden extension lives under ./extension/, plus a peripheral ref the
// device-extension phase ignores.
const deviceManifest = {
    id: 'thingbot',
    kind: 'device',
    name: 'ThingBot',
    fqbn: 'esp32:esp32:esp32c3',
    icon: './icon.svg',
    description: {id: 'device.thingbot.description', default: 'A ThingEdu ESP32-C3 board.'},
    manufacturer: 'ThingEdu',
    requires: 'serial',
    extensions: [
        {kind: 'deviceExtension', path: './extension/manifest.js'},
        {kind: 'peripheral', id: 'servo'}
    ]
};

const extensionManifest = {
    id: 'thingbot.device',
    kind: 'deviceExtension',
    hidden: true,
    blocks: './blocks.js',
    generator: './generator.js',
    toolbox: './toolbox.js',
    libs: [{path: 'libs/ThingBot'}]
};

const toolbox = {kind: 'category', name: 'ThingBot', contents: [{kind: 'block', type: 'thingbot_digitalwrite'}]};

const servoBase = 'http://localhost:3030/resources/extensions/peripheral/servo';
const servoManifest = {
    id: 'servo',
    kind: 'peripheral',
    name: 'Servo',
    blocks: './blocks.js',
    generator: './generator.js',
    toolbox: './toolbox.js',
    libs: [{path: 'libs/Servo'}]
};
const servoToolbox = {kind: 'category', name: 'Servo', contents: [{kind: 'block', type: 'servo_setangle'}]};

// A VM whose pack imports are served from in-memory modules; `counts` records imports per URL so a
// re-selection can be shown to skip re-importing the registered modules. ThingBot references the servo
// peripheral, so both the hidden extension and servo are reachable from one device selection.
const makeVM = () => {
    const vm = new VirtualMachine();
    const counts = {};
    const modules = {
        [`${extBase}/manifest.js`]: {default: extensionManifest},
        [`${extBase}/toolbox.js`]: {default: toolbox},
        [`${extBase}/blocks.js`]: {registerBlocks: Blockly => {
            Blockly.Blocks.thingbot_digitalwrite = {};
        }},
        [`${extBase}/generator.js`]: {registerGenerators: (generator, Order) => {
            generator.forBlock.thingbot_digitalwrite = () => `digitalWrite(2, HIGH);${Order.ATOMIC}`;
        }},
        [`${servoBase}/toolbox.js`]: {default: servoToolbox},
        [`${servoBase}/blocks.js`]: {registerBlocks: Blockly => {
            Blockly.Blocks.servo_setangle = {};
        }},
        [`${servoBase}/generator.js`]: {registerGenerators: (generator, Order) => {
            generator.forBlock.servo_setangle = () => `servo.write(90);${Order.ATOMIC}`;
        }}
    };
    vm._importPackModule = url => {
        counts[url] = (counts[url] || 0) + 1;
        if (!(url in modules)) return Promise.reject(new Error(`404 ${url}`));
        return Promise.resolve(modules[url]);
    };
    vm.registerDeviceManifest(deviceManifest, deviceBase);
    vm.registerPeripheralManifest(servoManifest, servoBase);
    return {vm, counts};
};

const makeScratchBlocks = () => ({
    Blocks: {},
    arduinoGenerator: {forBlock: {}},
    ArduinoOrder: {ATOMIC: 0, NONE: 99}
});

test('selectDevice registers the device extension blocks and codegen on the injected singleton', async t => {
    const {vm} = makeVM();
    const scratchBlocks = makeScratchBlocks();
    vm.setScratchBlocks(scratchBlocks);

    await vm.selectDevice('thingbot');

    t.ok(scratchBlocks.Blocks.thingbot_digitalwrite, 'block definition registered on the shared Blockly');
    t.type(
        scratchBlocks.arduinoGenerator.forBlock.thingbot_digitalwrite,
        'function',
        'codegen registered on the shared arduinoGenerator'
    );

    const active = vm.deviceExtensionRegistry.active;
    t.equal(active.id, 'thingbot.device', 'the extension is marked active');
    t.equal(vm.deviceExtensionRegistry.getActiveDeviceToolboxCategories().length, 1, 'exposes one toolbox category');
    t.same(vm.deviceExtensionRegistry.getActiveDeviceLibs(), [{path: 'libs/ThingBot'}], 'exposes the extension libs');

    t.end();
});

test('getActiveDeviceToolboxCategories/getActiveDeviceLibs reflect the active device on the VM', async t => {
    const {vm} = makeVM();
    vm.setScratchBlocks(makeScratchBlocks());

    t.same(vm.getActiveDeviceToolboxCategories(), [], 'no categories before a device is selected');

    await vm.selectDevice('thingbot');
    t.same(vm.getActiveDeviceToolboxCategories(), [toolbox], 'surfaces the active extension toolbox category');
    t.same(vm.getActiveDeviceLibs(), [{path: 'libs/ThingBot'}], 'surfaces the active extension libs');

    await vm.selectDevice(null);
    t.same(vm.getActiveDeviceToolboxCategories(), [], 'cleared after deselect');

    t.end();
});

test('selectDevice records the active extension headless, skipping block/codegen registration', async t => {
    const {vm, counts} = makeVM();
    // No setScratchBlocks: headless.

    await vm.selectDevice('thingbot');

    t.equal(vm.deviceExtensionRegistry.active.id, 'thingbot.device', 'extension still tracked active');
    t.same(vm.deviceExtensionRegistry.getActiveDeviceLibs(), [{path: 'libs/ThingBot'}], 'libs still recorded');
    t.notOk(counts[`${extBase}/blocks.js`], 'did not import blocks without a handle');
    t.notOk(counts[`${extBase}/generator.js`], 'did not import generator without a handle');

    t.end();
});

test('re-selecting a device re-activates without re-importing its modules', async t => {
    const {vm, counts} = makeVM();
    vm.setScratchBlocks(makeScratchBlocks());

    await vm.selectDevice('thingbot');
    await vm.selectDevice(null);
    await t.resolves(vm.selectDevice('thingbot'), 're-selection does not throw');

    t.equal(vm.deviceExtensionRegistry.active.id, 'thingbot.device', 're-activated');
    t.equal(counts[`${extBase}/blocks.js`], 1, 'blocks imported once');
    t.equal(counts[`${extBase}/generator.js`], 1, 'generator imported once');

    t.end();
});

test('selecting null or a built-in board clears the active extension', async t => {
    const {vm} = makeVM();
    vm.setScratchBlocks(makeScratchBlocks());

    await vm.selectDevice('thingbot');
    await vm.selectDevice(null);
    t.equal(vm.deviceExtensionRegistry.active, null, 'null selection clears active');

    await vm.selectDevice('thingbot');
    await vm.selectDevice('esp32c3');
    t.equal(vm.deviceExtensionRegistry.active, null, 'a built-in board (no pack) clears active');

    t.end();
});

test('selectDevice activates the peripherals the device references', async t => {
    const {vm} = makeVM();
    const scratchBlocks = makeScratchBlocks();
    vm.setScratchBlocks(scratchBlocks);

    t.same(vm.getActivePeripheralLibs(), [], 'no peripheral libs before a device is selected');

    await vm.selectDevice('thingbot');

    t.ok(scratchBlocks.Blocks.servo_setangle, 'peripheral block registered on the shared Blockly');
    t.type(
        scratchBlocks.arduinoGenerator.forBlock.servo_setangle,
        'function',
        'peripheral codegen registered on the shared arduinoGenerator'
    );
    t.same(vm.getActivePeripheralToolboxCategories(), [servoToolbox], 'surfaces the peripheral toolbox category');
    t.same(vm.getActivePeripheralLibs(), [{path: 'libs/Servo'}], 'surfaces the peripheral libs');

    await vm.selectDevice(null);
    t.same(vm.getActivePeripheralToolboxCategories(), [], 'peripheral categories cleared after deselect');
    t.same(vm.getActivePeripheralLibs(), [], 'peripheral libs cleared after deselect');

    t.end();
});

test('a referenced peripheral activates headless: toolbox/libs recorded, blocks skipped', async t => {
    const {vm, counts} = makeVM();
    // No setScratchBlocks: headless.

    await vm.selectDevice('thingbot');

    t.same(vm.getActivePeripheralToolboxCategories(), [servoToolbox], 'toolbox recorded without a handle');
    t.same(vm.getActivePeripheralLibs(), [{path: 'libs/Servo'}], 'libs recorded without a handle');
    t.notOk(counts[`${servoBase}/blocks.js`], 'did not import peripheral blocks without a handle');

    t.end();
});
