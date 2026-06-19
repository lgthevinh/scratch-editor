/**
 * Abstract base for a device: the contract for compiling firmware for and flashing one device target.
 *
 * Concrete devices extend this and implement every getter/method below; the base throws to surface a
 * half-implemented device the moment it is used.
 *
 * Block palette and code generation are NOT part of this contract — they live in the device's
 * extension/codegen and are linked by `deviceId`.
 */
class Device {
    /**
     * @param {Runtime} runtime - the VM runtime.
     */
    constructor (runtime) {
        this.runtime = runtime;
    }

    /**
     * Unique identity of this device. Primary key for the device registry and the link to the
     * block extension / codegen that provides its palette. Two devices may share an `fqbn`, but
     * never a `deviceId`.
     * @returns {string} the device id, e.g. 'arduinoUno'.
     */
    get deviceId () {
        throw new Error(`${this.constructor.name} must implement get deviceId()`);
    }

    /**
     * Presentation metadata for the device-selection card. `name` and `description` are localized
     * (via format-message); `requires` is a {@link ConnectionType}; `learnMore` and `help` are URLs.
     * @returns {{name: string, description: string, manufacturer: string, requires: string,
     *   learnMore: string, help: string}} the device info.
     */
    getDeviceInfo () {
        throw new Error(`${this.constructor.name} must implement getDeviceInfo()`);
    }

    /**
     * arduino-cli compile/upload target (FQBN), e.g. 'arduino:avr:uno'. The board identity is the
     * same on every OS. Per-OS upload tuning (upload speed, CDC flags) belongs in
     * `getUploadConfig()`, not here; the uploader appends those options to the FQBN at flash time.
     * @returns {string} the FQBN.
     */
    get fqbn () {
        throw new Error(`${this.constructor.name} must implement get fqbn()`);
    }

    /**
     * Compile-time configuration: the board option selections (arduino-cli FQBN menu options,
     * e.g. CPU variant or partition scheme) that choose the firmware variant. Merged with `fqbn`
     * when building (and reused when flashing). Returns an empty `options` map when the device's
     * defaults are correct.
     * @returns {{options: object}} the compile config.
     */
    getCompileConfig () {
        throw new Error(`${this.constructor.name} must implement getCompileConfig()`);
    }

    /**
     * Configuration for finding and flashing the device (everything but the FQBN): the USB device
     * filters used to find it, and the speed the programmer flashes at. `uploadSpeed` is
     * per-device (e.g. Uno 115200, classic Nano 57600), distinct from the monitor baud rate.
     * @returns {{pnpid: Array.<string>, uploadSpeed: number}} the upload config.
     */
    getUploadConfig () {
        throw new Error(`${this.constructor.name} must implement getUploadConfig()`);
    }
}

module.exports = Device;
