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
    }
    static get DEVICE_CONNECTED () {
        return 'DEVICE_CONNECTED';
    }
    static get DEVICE_DISCONNECTED () {
        return 'DEVICE_DISCONNECTED';
    }
    emit (event) {
        this.emitted.push(event);
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
 * A stub device exposing only the upload config LinkClient reads.
 * @param {Array.<string>} pnpid - the device's accepted USB PNP ids.
 * @returns {{getUploadConfig: function}} the stub device.
 */
const stubDevice = pnpid => ({getUploadConfig: () => ({pnpid})});

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
