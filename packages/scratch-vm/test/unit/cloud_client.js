const test = require('tap').test;
const CloudClient = require('../../src/link/client/cloud-client');
const Runtime = require('../../src/engine/runtime');

// A minimal fake of a Web Serial SerialPort that records open/close.
const makeFakePort = () => ({
    opened: false,
    openOptions: null,
    open (options) {
        this.opened = true;
        this.openOptions = options;
        return Promise.resolve();
    },
    close () {
        this.opened = false;
        return Promise.resolve();
    }
});

// Install a fake navigator.serial that hands back `port` and records the requestPort filters.
const installSerial = port => {
    const calls = {filters: null};
    global.navigator = {
        serial: {
            requestPort (options) {
                calls.filters = options.filters;
                return Promise.resolve(port);
            }
        }
    };
    return calls;
};

const uninstallSerial = () => {
    delete global.navigator;
};

test('spec', t => {
    const c = new CloudClient(new Runtime());

    t.type(CloudClient, 'function');
    t.type(c.listBoards, 'function');
    t.type(c.connect, 'function');
    t.type(c.disconnect, 'function');
    t.equal(c.isConnected, false);
    t.end();
});

test('isSupported reflects navigator.serial presence', t => {
    uninstallSerial();
    t.equal(CloudClient.isSupported(), false);

    installSerial(makeFakePort());
    t.equal(CloudClient.isSupported(), true);
    uninstallSerial();
    t.end();
});

test('filtersFromDevice parses pnpid VID/PID', t => {
    const device = {
        getUploadConfig: () => ({
            pnpid: ['USB\\VID_2341&PID_0043', 'USB\\VID_2341&PID_0001', 'not-a-pnpid']
        })
    };
    t.same(CloudClient.filtersFromDevice(device), [
        {usbVendorId: 0x2341, usbProductId: 0x0043},
        {usbVendorId: 0x2341, usbProductId: 0x0001}
    ]);
    t.same(CloudClient.filtersFromDevice({getUploadConfig: () => ({})}), []);
    t.end();
});

const stubDevice = (name = 'Arduino Uno') => ({
    getUploadConfig: () => ({}),
    getDeviceInfo: () => ({name})
});

test('listBoards returns one picker entry labelled with the device when Web Serial is supported', t => {
    installSerial(makeFakePort());
    const c = new CloudClient(new Runtime());
    c.listBoards(stubDevice('Arduino Uno')).then(targets => {
        t.same(targets, [{id: 'web-serial', name: 'Arduino Uno'}]);
        uninstallSerial();
        t.end();
    });
});

test('listBoards is empty when Web Serial is unavailable', t => {
    uninstallSerial();
    const c = new CloudClient(new Runtime());
    c.listBoards(stubDevice()).then(targets => {
        t.same(targets, []);
        t.end();
    });
});

test('connect opens the port, exposes transport, and emits DEVICE_CONNECTED', t => {
    const rt = new Runtime();
    const c = new CloudClient(rt);
    const port = makeFakePort();
    const calls = installSerial(port);

    let connectedEvents = 0;
    rt.on(Runtime.DEVICE_CONNECTED, () => connectedEvents++);

    t.throws(() => c.transport, 'transport throws before connect');

    c.connect({filters: [{usbVendorId: 0x2341, usbProductId: 0x0043}]}).then(() => {
        t.equal(c.isConnected, true);
        t.equal(port.opened, true);
        t.equal(port.openOptions.baudRate, 115200);
        t.equal(c.transport, port);
        t.same(calls.filters, [{usbVendorId: 0x2341, usbProductId: 0x0043}]);
        t.equal(connectedEvents, 1);
        uninstallSerial();
        t.end();
    });
});

test('connect with no target shows all ports (empty filters)', t => {
    const c = new CloudClient(new Runtime());
    const calls = installSerial(makeFakePort());

    c.connect().then(() => {
        t.same(calls.filters, []);
        uninstallSerial();
        t.end();
    });
});

test('disconnect closes the port and emits DEVICE_DISCONNECTED', t => {
    const rt = new Runtime();
    const c = new CloudClient(rt);
    const port = makeFakePort();
    installSerial(port);

    let disconnectedEvents = 0;
    rt.on(Runtime.DEVICE_DISCONNECTED, () => disconnectedEvents++);

    c.connect()
        .then(() => c.disconnect())
        .then(() => {
            t.equal(c.isConnected, false);
            t.equal(port.opened, false);
            t.throws(() => c.transport);
            t.equal(disconnectedEvents, 1);
            uninstallSerial();
            t.end();
        });
});

test('disconnect is a no-op when not connected', t => {
    const rt = new Runtime();
    const c = new CloudClient(rt);

    let disconnectedEvents = 0;
    rt.on(Runtime.DEVICE_DISCONNECTED, () => disconnectedEvents++);

    c.disconnect().then(() => {
        t.equal(disconnectedEvents, 0);
        t.end();
    });
});

test('connect throws when Web Serial is unavailable', t => {
    uninstallSerial();
    const c = new CloudClient(new Runtime());
    c.connect().then(
        () => {
            t.fail('expected connect to reject');
            t.end();
        },
        err => {
            t.match(err.message, /not available/);
            t.end();
        }
    );
});

test('deferred Client methods still throw until their milestone', t => {
    const c = new CloudClient(new Runtime());
    t.throws(() => c.compile({}, ''), /must implement compile/);
    t.throws(() => c.flash({}, {}), /must implement flash/);
    t.throws(() => c.openMonitor({}), /must implement openMonitor/);
    t.throws(() => c.writeMonitor(''), /must implement writeMonitor/);
    t.throws(() => c.closeMonitor(), /must implement closeMonitor/);
    t.end();
});
