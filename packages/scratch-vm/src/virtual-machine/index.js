const EventEmitter = require('events');

const centralDispatch = require('../dispatch/central-dispatch');
const ExtensionManager = require('../extension-support/extension-manager');
const log = require('../util/log');
const Runtime = require('../engine/runtime');

const wireRuntimeEvents = require('./runtime-events');
const LinkController = require('./link-controller');
const DeviceManager = require('./device-manager');
const applyMixin = require('./apply-mixin');
const ProjectIoMixin = require('./mixins/project-io');
const AssetsMixin = require('./mixins/assets');
const EngineMixin = require('./mixins/engine');
const WorkspaceMixin = require('./mixins/workspace');
const TargetsMixin = require('./mixins/targets');

const CORE_EXTENSIONS = [
    // 'motion',
    // 'looks',
    // 'sound',
    // 'events',
    // 'control',
    // 'sensing',
    // 'operators',
    // 'variables',
    // 'myBlocks'
];

/**
 * Handles connections between blocks, stage, and extensions.
 * @class
 */
class VirtualMachine extends EventEmitter {
    constructor () {
        super();

        /**
         * VM runtime, to store blocks, I/O devices, sprites/targets, etc.
         * @type {!Runtime}
         */
        this.runtime = new Runtime();
        centralDispatch.setService('runtime', this.runtime).catch(e => {
            log.error(`Failed to register runtime service: ${JSON.stringify(e)}`);
        });

        /**
         * The "currently editing"/selected target ID for the VM.
         * Block events from any Blockly workspace are routed to this target.
         * @type {Target}
         */
        this.editingTarget = null;

        // Forward the runtime's events out through the VM.
        wireRuntimeEvents(this);

        this.extensionManager = new ExtensionManager(this.runtime);

        // Load core extensions
        for (const id of CORE_EXTENSIONS) {
            this.extensionManager.loadExtensionIdSync(id);
        }

        /**
         * The device-link subsystem: helper/cloud link clients, the active client, and
         * compile/upload/monitor operations. See {@link LinkController}.
         * @type {LinkController}
         */
        this._link = new LinkController(this);

        /**
         * The board-mode device subsystem: device registry, helper-served resource packs, and the
         * selected board's active peripherals. See {@link DeviceManager}.
         * @type {DeviceManager}
         */
        this._devices = new DeviceManager(this);

        this.blockListener = this.blockListener.bind(this);
        this.flyoutBlockListener = this.flyoutBlockListener.bind(this);
        this.monitorBlockListener = this.monitorBlockListener.bind(this);
        this.variableListener = this.variableListener.bind(this);
    }

    /**
     * Start running the VM - do this before anything else.
     */
    start () {
        this.runtime.start();
    }

    /**
     * Quit the VM, clearing any handles which might keep the process alive.
     * Do not use the runtime after calling this method. This method is meant for test shutdown.
     */
    quit () {
        this.runtime.quit();
    }

    /**
     * "Green flag" handler - start all threads starting with a green flag.
     */
    greenFlag () {
        this.runtime.greenFlag();
    }

    /**
     * Set whether the VM is in "turbo mode."
     * When true, loops don't yield to redraw.
     * @param {boolean} turboModeOn Whether turbo mode should be set.
     */
    setTurboMode (turboModeOn) {
        this.runtime.turboMode = !!turboModeOn;
        if (this.runtime.turboMode) {
            this.emit(Runtime.TURBO_MODE_ON);
        } else {
            this.emit(Runtime.TURBO_MODE_OFF);
        }
    }

    /**
     * Set whether the VM is in 2.0 "compatibility mode."
     * When true, ticks go at 2.0 speed (30 TPS).
     * @param {boolean} compatibilityModeOn Whether compatibility mode is set.
     */
    setCompatibilityMode (compatibilityModeOn) {
        this.runtime.setCompatibilityMode(!!compatibilityModeOn);
    }

    /**
     * Stop all threads and running activities.
     */
    stopAll () {
        this.runtime.stopAll();
    }

    /**
     * Clear out current running project data.
     */
    clear () {
        this.runtime.dispose();
        this.editingTarget = null;
        this.emitTargetsUpdate(false /* Don't emit project change */);
    }

    /**
     * Get data for playground. Data comes back in an emitted event.
     */
    getPlaygroundData () {
        const instance = this;
        // Only send back thread data for the current editingTarget.
        const threadData = this.runtime.threads.filter(thread => thread.target === instance.editingTarget);
        // Remove the target key, since it's a circular reference.
        const filteredThreadData = JSON.stringify(threadData, (key, value) => {
            if (key === 'target' || key === 'blockContainer') return;
            return value;
        }, 2);
        this.emit('playgroundData', {
            blocks: this.editingTarget.blocks,
            threads: filteredThreadData
        });
    }

    /**
     * Post I/O data to the virtual devices.
     * @param {?string} device Name of virtual I/O device.
     * @param {object} data Any data object to post to the I/O device.
     */
    postIOData (device, data) {
        if (this.runtime.ioDevices[device]) {
            this.runtime.ioDevices[device].postData(data);
        }
    }

    setVideoProvider (videoProvider) {
        this.runtime.ioDevices.video.setProvider(videoProvider);
    }

    setCloudProvider (cloudProvider) {
        this.runtime.ioDevices.cloud.setProvider(cloudProvider);
    }

    /**
     * Tell the specified extension to scan for a peripheral.
     * @param {string} extensionId - the id of the extension.
     */
    scanForPeripheral (extensionId) {
        this.runtime.scanForPeripheral(extensionId);
    }

    /**
     * Connect to the extension's specified peripheral.
     * @param {string} extensionId - the id of the extension.
     * @param {number} peripheralId - the id of the peripheral.
     */
    connectPeripheral (extensionId, peripheralId) {
        this.runtime.connectPeripheral(extensionId, peripheralId);
    }

    /**
     * Disconnect from the extension's connected peripheral.
     * @param {string} extensionId - the id of the extension.
     */
    disconnectPeripheral (extensionId) {
        this.runtime.disconnectPeripheral(extensionId);
    }

    /**
     * Returns whether the extension has a currently connected peripheral.
     * @param {string} extensionId - the id of the extension.
     * @returns {boolean} - whether the extension has a connected peripheral.
     */
    getPeripheralIsConnected (extensionId) {
        return this.runtime.getPeripheralIsConnected(extensionId);
    }

    /**
     * The active device-link client (helper or cloud). Backed by {@link LinkController}.
     * @type {Client}
     */
    get client () {
        return this._link.client;
    }
    set client (value) {
        this._link.client = value;
    }

    /**
     * The native-helper link client. Backed by {@link LinkController}.
     * @type {LinkClient}
     */
    get linkClient () {
        return this._link.linkClient;
    }
    set linkClient (value) {
        this._link.linkClient = value;
    }

    /**
     * The cloud / Web Serial link client. Backed by {@link LinkController}.
     * @type {CloudClient}
     */
    get cloudClient () {
        return this._link.cloudClient;
    }
    set cloudClient (value) {
        this._link.cloudClient = value;
    }

    /**
     * The upload-mode device registry. Backed by {@link DeviceManager}.
     * @type {DeviceRegistry}
     */
    get deviceRegistry () {
        return this._devices.deviceRegistry;
    }
    set deviceRegistry (value) {
        this._devices.deviceRegistry = value;
    }

    /**
     * The active peripherals registry. Backed by {@link DeviceManager}.
     * @type {PeripheralRegistry}
     */
    get peripheralRegistry () {
        return this._devices.peripheralRegistry;
    }
    set peripheralRegistry (value) {
        this._devices.peripheralRegistry = value;
    }

    // Board/link internal state, surfaced on the VM so existing consumers and tests reach it as
    // before. The state itself lives on the {@link DeviceManager}/{@link LinkController} subsystems.

    get _selectedDeviceId () {
        return this._devices._selectedDeviceId;
    }

    get _pendingBoard () {
        return this._devices._pendingBoard;
    }

    get _monitorBaud () {
        return this._link._monitorBaud;
    }

    // The pack-module import seam tests override to supply in-memory modules; the setter writes
    // through so DeviceManager's own `_importPackModule` calls pick up the override.
    get _importPackModule () {
        return this._devices._importPackModule;
    }
    set _importPackModule (importer) {
        this._devices._importPackModule = importer;
    }

    // Board-mode device & resource-pack surface. See {@link DeviceManager}.

    getDeviceList () {
        return this._devices.getDeviceList();
    }

    getResourceOrigin () {
        return this._devices.getResourceOrigin();
    }

    registerDeviceManifest (manifest, base) {
        return this._devices.registerDeviceManifest(manifest, base);
    }

    registerPeripheralManifest (manifest, base) {
        return this._devices.registerPeripheralManifest(manifest, base);
    }

    loadResourcePacks () {
        return this._devices.loadResourcePacks();
    }

    setScratchBlocks (scratchBlocks) {
        return this._devices.setScratchBlocks(scratchBlocks);
    }

    setModuleImporter (importer) {
        return this._devices.setModuleImporter(importer);
    }

    selectDevice (deviceId) {
        return this._devices.selectDevice(deviceId);
    }

    addPeripheral (id) {
        return this._devices.addPeripheral(id);
    }

    removePeripheral (id) {
        return this._devices.removePeripheral(id);
    }

    getProjectPeripheralIds () {
        return this._devices.getProjectPeripheralIds();
    }

    getPeripheralList () {
        return this._devices.getPeripheralList();
    }

    getActivePeripheralToolboxCategories () {
        return this._devices.getActivePeripheralToolboxCategories();
    }

    getActivePeripheralLibs () {
        return this._devices.getActivePeripheralLibs();
    }

    _applyBoard (board) {
        return this._devices._applyBoard(board);
    }

    // Device-link surface (board discovery, compile/upload, serial monitor). See {@link LinkController}.

    setLinkMode (mode) {
        return this._link.setLinkMode(mode);
    }

    listBoards (deviceId) {
        return this._link.listBoards(deviceId);
    }

    connectBoard (target) {
        return this._link.connectBoard(target);
    }

    compile (deviceId, source, callbacks) {
        return this._link.compile(deviceId, source, callbacks);
    }

    upload (deviceId, artifact, callbacks) {
        return this._link.upload(deviceId, artifact, callbacks);
    }

    cancelUpload () {
        return this._link.cancelUpload();
    }

    openMonitor (options) {
        return this._link.openMonitor(options);
    }

    writeMonitor (data) {
        return this._link.writeMonitor(data);
    }

    closeMonitor () {
        return this._link.closeMonitor();
    }

    setMonitorBaud (rate) {
        return this._link.setMonitorBaud(rate);
    }

    disconnectBoard () {
        return this._link.disconnectBoard();
    }

    /**
     * Allow VM consumer to configure the ScratchLink socket creator.
     * @param {Function} factory The custom ScratchLink socket factory.
     */
    configureScratchLinkSocketFactory (factory) {
        this.runtime.configureScratchLinkSocketFactory(factory);
    }
}

for (const Mixin of [ProjectIoMixin, AssetsMixin, EngineMixin, WorkspaceMixin, TargetsMixin]) {
    applyMixin(VirtualMachine, Mixin);
}

module.exports = VirtualMachine;
