const tap = require('tap');
const VirtualMachine = require('../../src/virtual-machine');

const test = tap.test;

/** @returns {Promise<void>} resolves after the microtask queue (chained monitor calls) drains. */
const flush = () => new Promise(resolve => setImmediate(resolve));

test('connectBoard auto-opens the monitor at the default baud after connecting', async t => {
    const vm = new VirtualMachine();
    const order = [];
    vm.client = {
        connect: () => {
            order.push('connect');
            return Promise.resolve();
        },
        openMonitor: opts => {
            order.push(`open:${opts.baudRate}`);
            return Promise.resolve();
        }
    };

    await vm.connectBoard({id: '/dev/ttyACM0', name: 'Uno'});
    await flush();
    t.same(order, ['connect', 'open:115200'], 'connects first, then opens the monitor at 115200');
    t.end();
});

test('connectBoard still resolves when the monitor fails to open', async t => {
    const vm = new VirtualMachine();
    vm.client = {
        connect: () => Promise.resolve(),
        openMonitor: () => Promise.reject(new Error('port busy'))
    };

    await t.resolves(vm.connectBoard({id: '/dev/ttyACM0', name: 'Uno'}),
        'a monitor that fails to open does not fail the connection');
    t.end();
});

test('upload closes the monitor before the flash and reopens it after', async t => {
    const vm = new VirtualMachine();
    const fakeDevice = {getUploadConfig: () => ({pnpid: []})};
    vm.deviceRegistry.get = () => fakeDevice;
    const order = [];
    vm.client = {
        closeMonitor: () => {
            order.push('close');
            return Promise.resolve();
        },
        flash: () => {
            order.push('flash');
            return Promise.resolve();
        },
        openMonitor: opts => {
            order.push(`reopen:${opts.baudRate}`);
            return Promise.resolve();
        },
        isConnected: true
    };

    await vm.upload('uno', {format: 'hex', path: '/p'});
    await flush();
    t.same(order, ['close', 'flash', 'reopen:115200'],
        'frees the port for the flash, then restores the monitor at the stored baud');
    t.end();
});

test('upload does not reopen the monitor when the board is no longer connected', async t => {
    const vm = new VirtualMachine();
    vm.deviceRegistry.get = () => ({getUploadConfig: () => ({pnpid: []})});
    let reopened = false;
    vm.client = {
        closeMonitor: () => Promise.resolve(),
        flash: () => Promise.resolve(),
        openMonitor: () => {
            reopened = true;
            return Promise.resolve();
        },
        isConnected: false
    };

    await vm.upload('uno', {format: 'hex', path: '/p'});
    await flush();
    t.equal(reopened, false, 'a disconnected board leaves the monitor closed');
    t.end();
});

test('setMonitorBaud reopens the monitor at the new rate when connected', async t => {
    const vm = new VirtualMachine();
    const order = [];
    vm.client = {
        closeMonitor: () => {
            order.push('close');
            return Promise.resolve();
        },
        openMonitor: opts => {
            order.push(`open:${opts.baudRate}`);
            return Promise.resolve();
        },
        isConnected: true
    };

    vm.setMonitorBaud(9600);
    await flush();
    t.same(order, ['close', 'open:9600'], 'reopens at the chosen rate');
    t.end();
});

test('setMonitorBaud just remembers the rate when not connected', async t => {
    const vm = new VirtualMachine();
    let touched = false;
    vm.client = {
        closeMonitor: () => {
            touched = true;
            return Promise.resolve();
        },
        openMonitor: () => {
            touched = true;
            return Promise.resolve();
        },
        isConnected: false
    };

    vm.setMonitorBaud(9600);
    await flush();
    t.equal(touched, false, 'no reopen attempted while disconnected');
    t.equal(vm._monitorBaud, 9600, 'the rate is remembered for the next auto-open');
    t.end();
});
