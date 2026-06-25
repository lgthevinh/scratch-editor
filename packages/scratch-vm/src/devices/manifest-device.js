const formatMessage = require('format-message');
const Device = require('./device');

/**
 * A data-driven {@link Device} backed by a helper-served resource-pack device manifest. It bridges the
 * manifest's plain data to the getter/method contract the {@link DeviceRegistry} and `getDeviceList()`
 * expect, so a pack device is selectable exactly like a built-in board.
 *
 * The card's `description` rides in the manifest as a `format-message` descriptor and is resolved here,
 * against the editor's `format-message` singleton (the one `setLocale` configures). A served pack runs
 * in its own module instance and cannot share that translation store, so resolution happens on this
 * consumer side; `name` is the device's brand and stays verbatim.
 */
class ManifestDevice extends Device {
    /**
     * @param {Runtime} runtime - the VM runtime.
     * @param {object} manifest - the pack's device manifest (its `manifest.js` default export).
     */
    constructor (runtime, manifest) {
        super(runtime);

        /** @type {object} the source device manifest. */
        this._manifest = manifest;
    }

    get deviceId () {
        return this._manifest.id;
    }

    get fqbn () {
        return this._manifest.fqbn;
    }

    getDeviceInfo () {
        const manifest = this._manifest;
        return {
            name: manifest.name,
            description: formatMessage(manifest.description),
            manufacturer: manifest.manufacturer,
            requires: manifest.requires,
            learnMore: manifest.learnMore,
            help: manifest.help
        };
    }

    getCompileConfig () {
        return {options: this._manifest.compile?.options ?? {}};
    }

    getUploadConfig () {
        const upload = this._manifest.upload ?? {};
        return {pnpid: upload.pnpid ?? [], uploadSpeed: upload.uploadSpeed};
    }
}

module.exports = ManifestDevice;
