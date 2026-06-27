const tap = require('tap');
const LinkClient = require('../../src/link/client/link-client');

const test = tap.test;

/**
 * A minimal WebSocket stand-in: records sent frames and exposes hooks for the test to drive the
 * socket lifecycle (`open`, inbound `message`, `close`). Mirrors the `onopen`/`onmessage`/`onclose`
 * surface LinkClient wires.
 */
class FakeWebSocket {
    constructor (url) {
        this.url = url;
        this.sent = [];
        this.onopen = null;
        this.onmessage = null;
        this.onerror = null;
        this.onclose = null;
        FakeWebSocket.instances.push(this);
    }

    send (data) {
        this.sent.push(JSON.parse(data));
    }

    emitOpen () {
        this.onopen();
    }

    emitMessage (message) {
        this.onmessage({data: JSON.stringify(message)});
    }

    emitClose () {
        this.onclose();
    }
}
FakeWebSocket.instances = [];

/**
 * A minimal runtime stand-in exposing the connection-event surface LinkClient emits on, and recording
 * each emit so tests can assert lifecycle events. The static getters mirror the real Runtime class so
 * `this.runtime.constructor.DEVICE_CONNECTED` resolves.
 */
class FakeRuntime {
    constructor () {
        this.emitted = [];
        this.serialData = [];
    }
    static get DEVICE_CONNECTED () {
        return 'DEVICE_CONNECTED';
    }
    static get DEVICE_DISCONNECTED () {
        return 'DEVICE_DISCONNECTED';
    }
    static get SERIAL_DATA () {
        return 'SERIAL_DATA';
    }
    emit (event, ...args) {
        this.emitted.push(event);
        if (event === FakeRuntime.SERIAL_DATA) this.serialData.push(args[0]);
    }
}

/**
 * Build a LinkClient wired to a fresh FakeWebSocket registry and a recording runtime.
 * @returns {{client: LinkClient, sockets: Array.<FakeWebSocket>, runtime: FakeRuntime}} the client,
 *   its sockets, and its runtime.
 */
const makeClient = () => {
    FakeWebSocket.instances = [];
    const runtime = new FakeRuntime();
    const client = new LinkClient(runtime, {url: 'ws://test/', WebSocket: FakeWebSocket});
    return {client, sockets: FakeWebSocket.instances, runtime};
};

/** @returns {Promise<void>} resolves after the microtask queue (pending sends) drains. */
const flush = () => new Promise(resolve => setImmediate(resolve));

/**
 * Drive a socket through one request/result round-trip: open it (if needed), reply `result` to the
 * frame at `sentIndex`, and resolve once the queued send and reply have drained.
 * @param {FakeWebSocket} socket - the client's socket.
 * @param {number} sentIndex - index of the request frame to reply to.
 * @param {object} [payload] - the `result` payload.
 * @returns {Promise<void>} resolves once the request has settled.
 */
const roundTrip = async (socket, sentIndex, payload = {}) => {
    socket.emitOpen();
    await flush();
    socket.emitMessage({id: socket.sent[sentIndex].id, type: 'result', payload});
    await flush();
};

/**
 * A stub device exposing the upload config, fqbn, and compile config LinkClient reads.
 * @param {Array.<string>} pnpid - the device's accepted USB PNP ids.
 * @param {{fqbn?: string, options?: object, uploadSpeed?: number}} [config] - the fqbn, board-menu
 *   option selections, and flash upload speed.
 * @returns {{getUploadConfig: function, fqbn: string, getCompileConfig: function}} the stub device.
 */
const stubDevice = (pnpid, {fqbn = 'arduino:avr:uno', options = {}, uploadSpeed} = {}) => ({
    getUploadConfig: () => ({pnpid, uploadSpeed}),
    fqbn,
    getCompileConfig: () => ({options})
});

test('listBoards sends a listBoards envelope with the device pnpid', t => {
    const {client, sockets} = makeClient();
    client.listBoards(stubDevice(['USB\\VID_2341&PID_0043']));

    // The socket opens lazily; flush the microtask that sends after open resolves.
    sockets[0].emitOpen();
    Promise.resolve().then(() => {
        t.equal(sockets.length, 1, 'opens exactly one socket');
        t.equal(sockets[0].sent.length, 1, 'sends one frame');
        const frame = sockets[0].sent[0];
        t.equal(frame.type, 'listBoards');
        t.same(frame.payload, {pnpid: ['USB\\VID_2341&PID_0043']});
        t.type(frame.id, 'string', 'frame carries a correlation id');
        t.end();
    });
});

test('listBoards maps helper {port,label} targets to {id,name}', t => {
    const {client, sockets} = makeClient();
    const promise = client.listBoards(stubDevice([]));

    sockets[0].emitOpen();
    Promise.resolve().then(() => {
        const {id} = sockets[0].sent[0];
        sockets[0].emitMessage({
            id,
            type: 'result',
            payload: {targets: [{port: '/dev/ttyACM0', label: 'Arduino Uno'}]}
        });
    });

    promise.then(targets => {
        t.same(targets, [{id: '/dev/ttyACM0', name: 'Arduino Uno'}]);
        t.end();
    });
});

test('listBoards resolves empty when no boards match', t => {
    const {client, sockets} = makeClient();
    const promise = client.listBoards(stubDevice([]));

    sockets[0].emitOpen();
    Promise.resolve().then(() => {
        sockets[0].emitMessage({id: sockets[0].sent[0].id, type: 'result', payload: {targets: []}});
    });

    promise.then(targets => {
        t.same(targets, []);
        t.end();
    });
});

test('a helper error rejects the request and carries its code', t => {
    const {client, sockets} = makeClient();
    const promise = client.listBoards(stubDevice([]));

    sockets[0].emitOpen();
    Promise.resolve().then(() => {
        sockets[0].emitMessage({
            id: sockets[0].sent[0].id,
            type: 'error',
            payload: {code: 'unimplemented', message: 'not yet'}
        });
    });

    promise.then(
        () => t.fail('should not resolve'),
        err => {
            t.equal(err.code, 'unimplemented');
            t.match(err.message, /not yet/);
            t.end();
        }
    );
});

test('closing the socket rejects in-flight requests', t => {
    const {client, sockets} = makeClient();
    const promise = client.listBoards(stubDevice([]));

    sockets[0].emitOpen();
    Promise.resolve().then(() => sockets[0].emitClose());

    promise.then(
        () => t.fail('should not resolve'),
        err => {
            t.match(err.message, /closed/);
            t.end();
        }
    );
});

test('connect sends the port, marks connected, and emits DEVICE_CONNECTED', async t => {
    const {client, sockets, runtime} = makeClient();
    const promise = client.connect({id: '/dev/ttyACM0', name: 'Arduino Uno'});

    await roundTrip(sockets[0], 0);
    await promise;

    const frame = sockets[0].sent[0];
    t.equal(frame.type, 'connect');
    t.same(frame.payload, {port: '/dev/ttyACM0'});
    t.equal(client.isConnected, true, 'isConnected becomes true');
    t.same(runtime.emitted, ['DEVICE_CONNECTED']);
});

test('disconnect clears the link and emits DEVICE_DISCONNECTED', async t => {
    const {client, sockets, runtime} = makeClient();

    const connecting = client.connect({id: '/dev/ttyACM0', name: 'Arduino Uno'});
    await roundTrip(sockets[0], 0);
    await connecting;

    const disconnecting = client.disconnect();
    await roundTrip(sockets[0], 1);
    await disconnecting;

    t.equal(sockets[0].sent[1].type, 'disconnect');
    t.equal(client.isConnected, false, 'isConnected becomes false');
    t.same(runtime.emitted, ['DEVICE_CONNECTED', 'DEVICE_DISCONNECTED']);
});

test('disconnect when not connected is a no-op', async t => {
    const {client, sockets, runtime} = makeClient();

    await client.disconnect();

    t.equal(sockets.length, 0, 'opens no socket');
    t.same(runtime.emitted, [], 'emits nothing');
});

test('a socket close while connected emits DEVICE_DISCONNECTED', async t => {
    const {client, sockets, runtime} = makeClient();

    const connecting = client.connect({id: '/dev/ttyACM0', name: 'Arduino Uno'});
    await roundTrip(sockets[0], 0);
    await connecting;

    sockets[0].emitClose();

    t.equal(client.isConnected, false, 'isConnected falls back to false');
    t.same(runtime.emitted, ['DEVICE_CONNECTED', 'DEVICE_DISCONNECTED']);
});

test('compile sends a compile envelope with the composed fqbn and source', async t => {
    const {client, sockets} = makeClient();
    const promise = client.compile(
        stubDevice([], {fqbn: 'esp32:esp32:esp32', options: {PartitionScheme: 'huge_app'}}),
        'void setup(){}'
    );

    sockets[0].emitOpen();
    await flush();
    const frame = sockets[0].sent[0];
    t.equal(frame.type, 'compile');
    t.equal(frame.payload.fqbn, 'esp32:esp32:esp32:PartitionScheme=huge_app',
        'board-menu options fold onto the fqbn');
    t.same(frame.payload.options, {}, 'options payload is empty until libs/warnings land');
    t.equal(frame.payload.source, 'void setup(){}');
    t.same(frame.payload.libs, [], 'libs default to an empty list');

    sockets[0].emitMessage({
        id: frame.id,
        type: 'result',
        payload: {artifact: {format: 'bin', path: '/tmp/sketch.bin'}}
    });
    const artifact = await promise;
    t.same(artifact, {format: 'bin', path: '/tmp/sketch.bin'}, 'resolves the helper artifact');
    t.end();
});

test('compile forwards vendored lib references in the envelope', async t => {
    const {client, sockets} = makeClient();
    const libs = [{pack: 'extensions/peripheral/servo', lib: 'libs/Servo'}];
    const promise = client.compile(stubDevice([]), 'src', libs);

    sockets[0].emitOpen();
    await flush();
    const frame = sockets[0].sent[0];
    t.same(frame.payload.libs, libs, 'libs ride along untouched for the helper to resolve');

    sockets[0].emitMessage({id: frame.id, type: 'result', payload: {artifact: {format: 'bin', path: '/p'}}});
    await promise;
    t.end();
});

test('compile streams log and progress to callbacks, then resolves the artifact', async t => {
    const {client, sockets} = makeClient();
    const logs = [];
    const progress = [];
    const promise = client.compile(stubDevice([]), 'src', [], {
        onLog: chunk => logs.push(chunk),
        onProgress: p => progress.push(p)
    });

    sockets[0].emitOpen();
    await flush();
    const {id} = sockets[0].sent[0];
    sockets[0].emitMessage({id, type: 'log', payload: {chunk: 'Compiling...'}});
    sockets[0].emitMessage({id, type: 'progress', payload: {phase: 'compile', percent: 50}});
    sockets[0].emitMessage({id, type: 'result', payload: {artifact: {format: 'hex', path: '/tmp/a.hex'}}});

    const artifact = await promise;
    t.same(logs, ['Compiling...'], 'log frames route to onLog');
    t.same(progress, [{phase: 'compile', percent: 50}], 'progress frames route to onProgress');
    t.same(artifact, {format: 'hex', path: '/tmp/a.hex'});
    t.end();
});

test('compile tolerates streaming frames when no callbacks are given', async t => {
    const {client, sockets} = makeClient();
    const promise = client.compile(stubDevice([]), 'src');

    sockets[0].emitOpen();
    await flush();
    const {id} = sockets[0].sent[0];
    sockets[0].emitMessage({id, type: 'log', payload: {chunk: 'x'}});
    sockets[0].emitMessage({id, type: 'result', payload: {artifact: {format: 'bin', path: '/p'}}});

    await promise;
    t.pass('streamed frames with no callbacks do not throw');
    t.end();
});

test('a compile error rejects the request', t => {
    const {client, sockets} = makeClient();
    const promise = client.compile(stubDevice([]), 'src');

    sockets[0].emitOpen();
    flush().then(() => {
        sockets[0].emitMessage({
            id: sockets[0].sent[0].id,
            type: 'error',
            payload: {code: 'daemon', message: 'compile failed'}
        });
    });

    promise.then(
        () => t.fail('should not resolve'),
        err => {
            t.equal(err.code, 'daemon');
            t.match(err.message, /compile failed/);
            t.end();
        }
    );
});

/**
 * Connect a client to a target so `flash` has a selected port. Drives the `connect` round-trip
 * (opening the lazily-created socket) and resolves with that socket once the client reports connected.
 * @param {LinkClient} client - the client to connect.
 * @param {Array.<FakeWebSocket>} sockets - the client's socket registry.
 * @param {ConnectionTarget} target - the target to select.
 * @returns {Promise<FakeWebSocket>} the now-open socket.
 */
const connectClient = async (client, sockets, target) => {
    const promise = client.connect(target);
    const socket = sockets[0];
    socket.emitOpen();
    await flush();
    socket.emitMessage({id: socket.sent[0].id, type: 'result', payload: {}});
    await promise;
    return socket;
};

test('flash rejects when no port is connected', async t => {
    const {client} = makeClient();
    await t.rejects(
        client.flash(stubDevice([]), {format: 'hex', path: '/tmp/a.hex'}),
        /no connected port/,
        'flashing without connect() throws'
    );
    t.end();
});

test('flash sends an upload envelope with the fqbn, port, uploadSpeed, and artifact', async t => {
    const {client, sockets} = makeClient();
    const device = stubDevice([], {fqbn: 'arduino:avr:uno', uploadSpeed: 115200});
    await connectClient(client, sockets, {id: '/dev/ttyACM0', name: 'Uno'});

    const artifact = {format: 'hex', path: '/tmp/a.hex'};
    const promise = client.flash(device, artifact);
    await flush();
    const frame = sockets[0].sent[1];
    t.equal(frame.type, 'upload');
    t.same(frame.payload, {
        fqbn: 'arduino:avr:uno',
        port: '/dev/ttyACM0',
        uploadSpeed: 115200,
        artifact
    }, 'upload payload carries the composed fqbn, selected port, speed, and artifact');

    sockets[0].emitMessage({id: frame.id, type: 'result', payload: {}});
    await promise;
    t.pass('resolves on the terminal result');
    t.end();
});

test('flash defaults uploadSpeed to 0 when the device omits it', async t => {
    const {client, sockets} = makeClient();
    await connectClient(client, sockets, {id: '/dev/ttyACM0', name: 'Uno'});

    const promise = client.flash(stubDevice([]), {format: 'bin', path: '/p'});
    await flush();
    const frame = sockets[0].sent[1];
    t.equal(frame.payload.uploadSpeed, 0, 'absent uploadSpeed defers to the FQBN (0)');

    sockets[0].emitMessage({id: frame.id, type: 'result', payload: {}});
    await promise;
    t.end();
});

test('flash streams log chunks to onLog, then resolves', async t => {
    const {client, sockets} = makeClient();
    await connectClient(client, sockets, {id: '/dev/ttyACM0', name: 'Uno'});

    const logs = [];
    const promise = client.flash(stubDevice([]), {format: 'hex', path: '/p'}, {
        onLog: chunk => logs.push(chunk)
    });
    await flush();
    const {id} = sockets[0].sent[1];
    sockets[0].emitMessage({id, type: 'log', payload: {chunk: 'avrdude: writing flash'}});
    sockets[0].emitMessage({id, type: 'result', payload: {}});

    await promise;
    t.same(logs, ['avrdude: writing flash'], 'upload log chunks route to onLog');
    t.end();
});

test('a flash error rejects the request', async t => {
    const {client, sockets} = makeClient();
    await connectClient(client, sockets, {id: '/dev/ttyACM0', name: 'Uno'});

    const promise = client.flash(stubDevice([]), {format: 'hex', path: '/p'});
    await flush();
    sockets[0].emitMessage({
        id: sockets[0].sent[1].id,
        type: 'error',
        payload: {code: 'daemon', message: 'upload failed'}
    });

    await promise.then(
        () => t.fail('should not resolve'),
        err => {
            t.equal(err.code, 'daemon');
            t.match(err.message, /upload failed/);
        }
    );
    t.end();
});

/**
 * Connect a client and open a serial monitor on it, driving both round-trips.
 * @param {LinkClient} client - the client to drive.
 * @param {Array.<FakeWebSocket>} sockets - the client's socket registry.
 * @param {number} [baudRate] - the monitor baud rate.
 * @returns {Promise<object>} the `monitorOpen` request frame (its `id` carries the monitor session).
 */
const openMonitorClient = async (client, sockets, baudRate = 115200) => {
    await connectClient(client, sockets, {id: '/dev/ttyACM0', name: 'Uno'});
    const promise = client.openMonitor({baudRate});
    await flush();
    const openFrame = sockets[0].sent[1];
    sockets[0].emitMessage({id: openFrame.id, type: 'result', payload: {}});
    await promise;
    return openFrame;
};

test('openMonitor rejects when no port is connected', async t => {
    const {client, sockets} = makeClient();
    await t.rejects(
        client.openMonitor({baudRate: 115200}),
        /no connected port/,
        'opening a monitor without connect() rejects'
    );
    t.equal(sockets.length, 0, 'opens no socket and sends nothing');
    t.end();
});

test('openMonitor sends a monitorOpen envelope with the connected port and baud rate', async t => {
    const {client, sockets} = makeClient();
    const frame = await openMonitorClient(client, sockets, 9600);

    t.equal(frame.type, 'monitorOpen');
    t.same(frame.payload, {port: '/dev/ttyACM0', baudRate: 9600},
        'monitorOpen carries the connected port and requested baud rate');
    t.end();
});

test('monitorData frames after open emit SERIAL_DATA on the runtime', async t => {
    const {client, sockets, runtime} = makeClient();
    const {id} = await openMonitorClient(client, sockets);

    sockets[0].emitMessage({id, type: 'monitorData', payload: {data: 'hello'}});
    sockets[0].emitMessage({id, type: 'monitorData', payload: {data: 'world'}});

    t.same(runtime.serialData, ['hello', 'world'], 'each monitorData frame emits its bytes');
    t.end();
});

test('monitorData on a foreign id is ignored', async t => {
    const {client, sockets, runtime} = makeClient();
    await openMonitorClient(client, sockets);

    sockets[0].emitMessage({id: 'not-the-monitor', type: 'monitorData', payload: {data: 'x'}});

    t.same(runtime.serialData, [], 'data for an unknown id does not reach the runtime');
    t.end();
});

test('writeMonitor sends a monitorWrite envelope on the open monitor id', async t => {
    const {client, sockets} = makeClient();
    const {id} = await openMonitorClient(client, sockets);

    client.writeMonitor('ping');
    const frame = sockets[0].sent[sockets[0].sent.length - 1];
    t.equal(frame.type, 'monitorWrite');
    t.equal(frame.id, id, 'the write is stamped with the monitor session id');
    t.same(frame.payload, {data: 'ping'});
    t.end();
});

test('writeMonitor is a no-op when no monitor is open', t => {
    const {client, sockets} = makeClient();
    client.writeMonitor('ping');
    t.equal(sockets.length, 0, 'opens no socket and sends nothing');
    t.end();
});

test('closeMonitor sends monitorClose and stops routing later monitorData', async t => {
    const {client, sockets, runtime} = makeClient();
    const {id} = await openMonitorClient(client, sockets);

    const closing = client.closeMonitor();
    await flush();
    const closeFrame = sockets[0].sent[sockets[0].sent.length - 1];
    t.equal(closeFrame.type, 'monitorClose');
    t.same(closeFrame.payload, {});
    sockets[0].emitMessage({id: closeFrame.id, type: 'result', payload: {}});
    await closing;

    // The open request's id is dead once closed; a stray data frame on it must not emit.
    sockets[0].emitMessage({id, type: 'monitorData', payload: {data: 'late'}});
    t.same(runtime.serialData, [], 'no data routes after the monitor is closed');
    t.end();
});

test('closeMonitor is a no-op when no monitor is open', async t => {
    const {client, sockets} = makeClient();
    await client.closeMonitor();
    t.equal(sockets.length, 0, 'opens no socket and sends nothing');
    t.end();
});

test('a post-open monitor error tears the monitor down', async t => {
    const {client, sockets, runtime} = makeClient();
    const {id} = await openMonitorClient(client, sockets);

    sockets[0].emitMessage({id, type: 'error', payload: {code: 'grpc', message: 'port lost'}});
    // The monitor is gone; subsequent data on its id is dropped and a later write is a no-op.
    sockets[0].emitMessage({id, type: 'monitorData', payload: {data: 'after'}});
    client.writeMonitor('x');

    t.same(runtime.serialData, [], 'no data routes once the port errored');
    t.equal(sockets[0].sent.filter(f => f.type === 'monitorWrite').length, 0, 'no write is sent');
    t.end();
});

test('a socket close clears the open monitor', async t => {
    const {client, sockets, runtime} = makeClient();
    const {id} = await openMonitorClient(client, sockets);

    sockets[0].emitClose();
    sockets[0].emitMessage({id, type: 'monitorData', payload: {data: 'after'}});

    t.same(runtime.serialData, [], 'a dropped socket leaves no monitor routing');
    t.end();
});

test('cancel aborts an in-flight compile, rejecting it with code cancelled', async t => {
    const {client, sockets} = makeClient();
    const promise = client.compile(stubDevice([]), 'src');
    sockets[0].emitOpen();
    await flush();
    const {id} = sockets[0].sent[0];

    client.cancel();
    const cancelFrame = sockets[0].sent[1];
    t.equal(cancelFrame.type, 'cancel', 'sends a cancel frame');
    t.equal(cancelFrame.id, id, 'cancel is stamped with the in-flight request id');
    t.same(cancelFrame.payload, {}, 'cancel carries an empty payload');

    // The helper drops the request's stream and replies error{cancelled} on the original id.
    sockets[0].emitMessage({id, type: 'error', payload: {code: 'cancelled', message: 'cancelled'}});
    await promise.then(
        () => t.fail('should not resolve'),
        err => t.equal(err.code, 'cancelled', 'the compile promise rejects with the cancelled code')
    );
    t.end();
});

test('cancel aborts an in-flight upload too', async t => {
    const {client, sockets} = makeClient();
    await connectClient(client, sockets, {id: '/dev/ttyACM0', name: 'Uno'});
    const promise = client.flash(stubDevice([]), {format: 'hex', path: '/p'});
    await flush();
    const {id} = sockets[0].sent[1];

    client.cancel();
    const cancelFrame = sockets[0].sent[2];
    t.equal(cancelFrame.type, 'cancel');
    t.equal(cancelFrame.id, id, 'cancel targets the in-flight upload');

    sockets[0].emitMessage({id, type: 'error', payload: {code: 'cancelled', message: 'cancelled'}});
    await promise.then(
        () => t.fail('should not resolve'),
        err => t.equal(err.code, 'cancelled')
    );
    t.end();
});

test('cancel with nothing in flight is a no-op', t => {
    const {client, sockets} = makeClient();
    client.cancel();
    t.equal(sockets.length, 0, 'opens no socket and sends nothing');
    t.end();
});

test('cancel after a request settles is a no-op', async t => {
    const {client, sockets} = makeClient();
    const promise = client.compile(stubDevice([]), 'src');
    sockets[0].emitOpen();
    await flush();
    sockets[0].emitMessage({
        id: sockets[0].sent[0].id,
        type: 'result',
        payload: {artifact: {format: 'bin', path: '/p'}}
    });
    await promise;

    client.cancel();
    t.equal(sockets[0].sent.length, 1, 'no cancel frame is sent for an already-settled request');
    t.end();
});

test('concurrent requests share one lazily-opened socket', t => {
    const {client, sockets} = makeClient();
    client.listBoards(stubDevice([]));
    client.listBoards(stubDevice([]));

    sockets[0].emitOpen();
    Promise.resolve().then(() => {
        t.equal(sockets.length, 1, 'only one socket opened');
        t.equal(sockets[0].sent.length, 2, 'both requests sent over it');
        t.not(sockets[0].sent[0].id, sockets[0].sent[1].id, 'each request has a distinct id');
        t.end();
    });
});
