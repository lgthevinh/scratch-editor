const tap = require('tap');
const VirtualMachine = require('../../src/virtual-machine');

const test = tap.test;

test('listBoards rejects when no device is registered for the id', t => {
    const vm = new VirtualMachine();
    vm.listBoards('does-not-exist').then(
        () => t.fail('should reject for an unknown deviceId'),
        err => {
            t.match(err.message, /no device registered/);
            t.end();
        }
    );
});

test('listBoards resolves the device and delegates to the link client', t => {
    const vm = new VirtualMachine();
    const fakeDevice = {getUploadConfig: () => ({pnpid: ['USB\\VID_2341&PID_0043']})};
    const targets = [{id: '/dev/ttyACM0', name: 'Arduino Uno'}];

    vm.deviceRegistry.get = deviceId => (deviceId === 'arduinoUno' ? fakeDevice : null);
    let receivedDevice = null;
    vm.linkClient = {
        listBoards: device => {
            receivedDevice = device;
            return Promise.resolve(targets);
        }
    };

    vm.listBoards('arduinoUno').then(result => {
        t.equal(receivedDevice, fakeDevice, 'passes the resolved device to the link client');
        t.same(result, targets, 'returns the link client targets unchanged');
        t.end();
    });
});

test('connectBoard delegates the target to the link client', t => {
    const vm = new VirtualMachine();
    const target = {id: '/dev/ttyACM0', name: 'Arduino Uno'};
    let received = null;
    vm.linkClient = {connect: t2 => {
        received = t2;
        return Promise.resolve();
    }};

    vm.connectBoard(target).then(() => {
        t.equal(received, target, 'passes the target through to the link client');
        t.end();
    });
});

test('disconnectBoard delegates to the link client', t => {
    const vm = new VirtualMachine();
    let called = false;
    vm.linkClient = {disconnect: () => {
        called = true;
        return Promise.resolve();
    }};

    vm.disconnectBoard().then(() => {
        t.equal(called, true, 'calls disconnect on the link client');
        t.end();
    });
});
