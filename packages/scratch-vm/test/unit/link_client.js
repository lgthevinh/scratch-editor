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
 * Build a LinkClient wired to a fresh FakeWebSocket registry.
 * @returns {{client: LinkClient, sockets: Array.<FakeWebSocket>}} the client and its sockets.
 */
const makeClient = () => {
    FakeWebSocket.instances = [];
    const client = new LinkClient(null, {url: 'ws://test/', WebSocket: FakeWebSocket});
    return {client, sockets: FakeWebSocket.instances};
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
