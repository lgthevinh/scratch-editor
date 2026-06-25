const tap = require('tap');
const VirtualMachine = require('../../src/virtual-machine');

const test = tap.test;

// A stand-in for a helper-served device manifest (the shape thingblock-resource emits).
const sampleManifest = {
    id: 'thingbot',
    kind: 'device',
    name: 'ThingBot',
    fqbn: 'esp32:esp32:esp32c3',
    icon: './icon.svg',
    description: {id: 'device.thingbot.description', default: 'A ThingEdu ESP32-C3 board.'},
    manufacturer: 'thingedu.com',
    requires: 'serial',
    learnMore: 'https://thingedu.com',
    compile: {options: {CDCOnBoot: 'cdc'}},
    upload: {pnpid: ['USB\\VID_303A&PID_1001'], uploadSpeed: 921600}
};

test('getResourceOrigin derives the helper HTTP base in link mode, null otherwise', t => {
    const vm = new VirtualMachine();

    t.equal(
        vm.getResourceOrigin(),
        'http://localhost:3030/resources/extensions',
        'swaps ws->http and appends the resource path'
    );

    vm.setLinkMode('cloud');
    t.equal(vm.getResourceOrigin(), null, 'no helper origin in cloud mode');

    t.end();
});

test('registerDeviceManifest exposes the pack device through getDeviceList', t => {
    const vm = new VirtualMachine();
    const base = 'http://localhost:3030/resources/extensions/devices/thingbot';

    vm.registerDeviceManifest(sampleManifest, base);

    const device = vm.getDeviceList().find(d => d.deviceId === 'thingbot');
    t.ok(device, 'the pack device joins the device list');
    t.equal(device.fqbn, 'esp32:esp32:esp32c3', 'carries the manifest FQBN');
    t.equal(device.iconURL, `${base}/icon.svg`, 'resolves the relative icon against the served base');
    t.equal(device.description, 'A ThingEdu ESP32-C3 board.', 'resolves the localized description');
    t.equal(device.manufacturer, 'thingedu.com', 'passes manufacturer through');
    t.equal(device.requires, 'serial', 'passes the connection requirement through');

    t.end();
});

test('registerDeviceManifest is idempotent on a duplicate id', t => {
    const vm = new VirtualMachine();
    const base = 'http://localhost:3030/resources/extensions/devices/thingbot';

    vm.registerDeviceManifest(sampleManifest, base);
    const count = vm.getDeviceList().filter(d => d.deviceId === 'thingbot').length;

    t.doesNotThrow(() => vm.registerDeviceManifest(sampleManifest, base), 'a repeat load does not throw');
    t.equal(vm.getDeviceList().filter(d => d.deviceId === 'thingbot').length, count, 'no duplicate device');
    t.equal(count, 1, 'registered exactly once');

    t.end();
});

test('ManifestDevice maps compile and upload config from the manifest', t => {
    const vm = new VirtualMachine();
    const base = 'http://localhost:3030/resources/extensions/devices/thingbot';

    vm.registerDeviceManifest(sampleManifest, base);
    const device = vm.deviceRegistry.get('thingbot');

    t.same(device.getCompileConfig(), {options: {CDCOnBoot: 'cdc'}}, 'compile options pass through');
    t.same(
        device.getUploadConfig(),
        {pnpid: ['USB\\VID_303A&PID_1001'], uploadSpeed: 921600},
        'upload config passes through'
    );

    t.end();
});
