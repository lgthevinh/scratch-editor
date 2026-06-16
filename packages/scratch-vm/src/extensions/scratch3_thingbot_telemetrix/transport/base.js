/**
 * Abstract base class for ThingBot transports.
 * Subclasses must implement all methods below.
 * Reports delivered to handlers are plain objects: {id: number, data: number[]}
 */
class BaseTransport {
    scan () {
        throw new Error('scan() not implemented');
    }

    connect (device, onDisconnect) { // eslint-disable-line no-unused-vars
        throw new Error('connect() not implemented');
    }

    send (packet) { // eslint-disable-line no-unused-vars
        throw new Error('send() not implemented');
    }

    onReport (handler) { // eslint-disable-line no-unused-vars
        throw new Error('onReport() not implemented');
    }

    disconnect () {
        throw new Error('disconnect() not implemented');
    }

    isConnected () {
        throw new Error('isConnected() not implemented');
    }
}

module.exports = BaseTransport;
