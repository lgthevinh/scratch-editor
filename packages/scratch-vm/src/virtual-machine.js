let _TextEncoder;
if (typeof TextEncoder === 'undefined') {
    _TextEncoder = require('text-encoding').TextEncoder;
} else {
    _TextEncoder = TextEncoder;
}
const EventEmitter = require('events');
const JSZip = require('jszip');

const Buffer = require('buffer').Buffer;
const centralDispatch = require('./dispatch/central-dispatch');
const ExtensionManager = require('./extension-support/extension-manager');
const log = require('./util/log');
const MathUtil = require('./util/math-util');
const Runtime = require('./engine/runtime');
const StringUtil = require('./util/string-util');
const formatMessage = require('format-message');
const {DeviceRegistry, PeripheralRegistry, ManifestDevice} = require('./devices');
const {boards} = require('./extensions/devices');
const LinkClient = require('./link/client/link-client');
const CloudClient = require('./link/client/cloud-client');

const Variable = require('./engine/variable');
const newBlockIds = require('./util/new-block-ids');

const {loadCostume} = require('./import/load-costume.js');
const {loadSound} = require('./import/load-sound.js');
const {serializeSounds, serializeCostumes} = require('./serialization/serialize-assets');
require('canvas-toBlob');

const RESERVED_NAMES = ['_mouse_', '_stage_', '_edge_', '_myself_', '_random_'];

/**
 * Default serial-monitor baud rate, used until the GUI changes it via {@link VirtualMachine#setMonitorBaud}.
 * @type {number}
 */
const DEFAULT_MONITOR_BAUD = 115200;

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

        /**
         * The currently dragging target, for redirecting IO data.
         * @type {Target}
         */
        this._dragTarget = null;

        // Runtime emits are passed along as VM emits.
        this.runtime.on(Runtime.SCRIPT_GLOW_ON, glowData => {
            this.emit(Runtime.SCRIPT_GLOW_ON, glowData);
        });
        this.runtime.on(Runtime.SCRIPT_GLOW_OFF, glowData => {
            this.emit(Runtime.SCRIPT_GLOW_OFF, glowData);
        });
        this.runtime.on(Runtime.BLOCK_GLOW_ON, glowData => {
            this.emit(Runtime.BLOCK_GLOW_ON, glowData);
        });
        this.runtime.on(Runtime.BLOCK_GLOW_OFF, glowData => {
            this.emit(Runtime.BLOCK_GLOW_OFF, glowData);
        });
        this.runtime.on(Runtime.PROJECT_START, () => {
            this.emit(Runtime.PROJECT_START);
        });
        this.runtime.on(Runtime.PROJECT_RUN_START, () => {
            this.emit(Runtime.PROJECT_RUN_START);
        });
        this.runtime.on(Runtime.PROJECT_RUN_STOP, () => {
            this.emit(Runtime.PROJECT_RUN_STOP);
        });
        this.runtime.on(Runtime.PROJECT_CHANGED, () => {
            this.emit(Runtime.PROJECT_CHANGED);
        });
        this.runtime.on(Runtime.VISUAL_REPORT, visualReport => {
            this.emit(Runtime.VISUAL_REPORT, visualReport);
        });
        this.runtime.on(Runtime.TARGETS_UPDATE, emitProjectChanged => {
            this.emitTargetsUpdate(emitProjectChanged);
        });
        this.runtime.on(Runtime.MONITORS_UPDATE, monitorList => {
            this.emit(Runtime.MONITORS_UPDATE, monitorList);
        });
        this.runtime.on(Runtime.BLOCK_DRAG_UPDATE, areBlocksOverGui => {
            this.emit(Runtime.BLOCK_DRAG_UPDATE, areBlocksOverGui);
        });
        this.runtime.on(Runtime.BLOCK_DRAG_END, (blocks, topBlockId) => {
            this.emit(Runtime.BLOCK_DRAG_END, blocks, topBlockId);
        });
        this.runtime.on(Runtime.EXTENSION_ADDED, categoryInfo => {
            this.emit(Runtime.EXTENSION_ADDED, categoryInfo);
        });
        this.runtime.on(Runtime.EXTENSION_FIELD_ADDED, (fieldName, fieldImplementation) => {
            this.emit(Runtime.EXTENSION_FIELD_ADDED, fieldName, fieldImplementation);
        });
        this.runtime.on(Runtime.BLOCKSINFO_UPDATE, categoryInfo => {
            this.emit(Runtime.BLOCKSINFO_UPDATE, categoryInfo);
        });
        this.runtime.on(Runtime.BLOCKS_NEED_UPDATE, () => {
            this.emitWorkspaceUpdate();
        });
        this.runtime.on(Runtime.TOOLBOX_EXTENSIONS_NEED_UPDATE, () => {
            this.extensionManager.refreshBlocks();
        });
        this.runtime.on(Runtime.PERIPHERAL_LIST_UPDATE, info => {
            this.emit(Runtime.PERIPHERAL_LIST_UPDATE, info);
        });
        this.runtime.on(Runtime.USER_PICKED_PERIPHERAL, info => {
            this.emit(Runtime.USER_PICKED_PERIPHERAL, info);
        });
        this.runtime.on(Runtime.PERIPHERAL_CONNECTED, () =>
            this.emit(Runtime.PERIPHERAL_CONNECTED)
        );
        this.runtime.on(Runtime.PERIPHERAL_REQUEST_ERROR, () =>
            this.emit(Runtime.PERIPHERAL_REQUEST_ERROR)
        );
        this.runtime.on(Runtime.PERIPHERAL_DISCONNECTED, () =>
            this.emit(Runtime.PERIPHERAL_DISCONNECTED)
        );
        this.runtime.on(Runtime.PERIPHERAL_CONNECTION_LOST_ERROR, data =>
            this.emit(Runtime.PERIPHERAL_CONNECTION_LOST_ERROR, data)
        );
        this.runtime.on(Runtime.PERIPHERAL_SCAN_TIMEOUT, () =>
            this.emit(Runtime.PERIPHERAL_SCAN_TIMEOUT)
        );
        this.runtime.on(Runtime.MIC_LISTENING, listening => {
            this.emit(Runtime.MIC_LISTENING, listening);
        });
        this.runtime.on(Runtime.EXTENSION_DATA_LOADING, loading => {
            this.emit(Runtime.EXTENSION_DATA_LOADING, loading);
        });
        this.runtime.on(Runtime.RUNTIME_STARTED, () => {
            this.emit(Runtime.RUNTIME_STARTED);
        });
        this.runtime.on(Runtime.HAS_CLOUD_DATA_UPDATE, hasCloudData => {
            this.emit(Runtime.HAS_CLOUD_DATA_UPDATE, hasCloudData);
        });
        this.runtime.on(Runtime.DEVICE_CONNECTED, () =>
            this.emit(Runtime.DEVICE_CONNECTED)
        );
        this.runtime.on(Runtime.DEVICE_DISCONNECTED, () =>
            this.emit(Runtime.DEVICE_DISCONNECTED)
        );

        this.extensionManager = new ExtensionManager(this.runtime);

        // Load core extensions
        for (const id of CORE_EXTENSIONS) {
            this.extensionManager.loadExtensionIdSync(id);
        }

        /**
         * Registry of upload-mode devices, keyed by deviceId. Drives the GUI device-selection list.
         * @type {DeviceRegistry}
         */
        this.deviceRegistry = new DeviceRegistry();
        this._deviceManifestsById = new Map();
        for (const board of boards) {
            const device = this.deviceRegistry.register(new board.Device(this.runtime));
            this._deviceManifestsById.set(device.deviceId, board);
        }

        /**
         * Guards {@link loadResourcePacks} to one successful run per VM instance: the registries throw
         * on duplicate ids and the toolbox/codegen registrations are not idempotent.
         * @type {boolean}
         */
        this._resourcePacksLoaded = false;

        /**
         * Source data for helper-served device packs, keyed by deviceId: `{manifest, base}`. Device
         * selection reads it to activate the device's hidden extension(s).
         * @type {Map<string, {manifest: object, base: string}>}
         */
        this._resourceDevicePacks = new Map();

        /**
         * Source data for helper-served peripheral packs, keyed by id: `{manifest, base}`. Device
         * selection reads it to activate the peripherals the selected device references.
         * @type {Map<string, {manifest: object, base: string}>}
         */
        this._resourcePeripheralPacks = new Map();

        /**
         * The peripheral packs active for the selected device — the device's own hidden pack plus any
         * reusable components — for the board-mode toolbox and compile-time lib resolution.
         * @type {PeripheralRegistry}
         */
        this.peripheralRegistry = new PeripheralRegistry();

        /**
         * The selected device's id, or null in host mode. Tracked so the project can persist which board
         * (and thus which peripherals) it targets.
         * @type {?string}
         */
        this._selectedDeviceId = null;

        /**
         * Peripheral ids the user added from the library, beyond the ones the selected device provides
         * automatically. Project-level (persisted with the project) and re-activated on each device
         * selection; kept disjoint from the device's own peripherals, which are never user-removable.
         * @type {Set<string>}
         */
        this._projectPeripheralIds = new Set();

        /**
         * A loaded project's saved board, held when its device's helper pack has not registered yet, to be
         * applied once resource packs finish loading. Null when there is nothing pending.
         * @type {?{device: string, peripherals: Array.<string>}}
         */
        this._pendingBoard = null;

        /**
         * The GUI-injected `@scratch/scratch-blocks` module, or null when headless. Registering an active
         * peripheral's block definitions and Arduino codegen needs the shared singleton it holds; absent,
         * device selection still tracks active peripherals' toolbox/libs but skips block/codegen.
         * @type {?object}
         */
        this._scratchBlocks = null;

        /**
         * The GUI-injected dynamic-import function for helper-served pack modules, or null when not
         * provided. Kept out of the VM bundle so webpack neither rewrites the remote `import()` nor marks
         * the bundle an ES module (which would strip its default export); the GUI supplies
         * `url => import(url)` from its own build. Absent (headless / no GUI), packs cannot be loaded.
         * @type {?function(string): Promise<object>}
         */
        this._moduleImporter = null;

        /**
         * Device link to the native helper (thingblock-link), over a WebSocket. Constructing it is
         * free — the socket opens lazily on first use.
         * @type {LinkClient}
         */
        this.linkClient = new LinkClient(this.runtime);

        /**
         * Device link for the server-build (full-web) mode, over Web Serial. The web-mode peer to
         * `linkClient`; its port opens lazily on first use.
         * @type {CloudClient}
         */
        this.cloudClient = new CloudClient(this.runtime);

        /**
         * The active device-link {@link Client} that board discovery, connection, and (later)
         * compile/upload/monitor route through. `setLinkMode` swaps it between `linkClient` and
         * `cloudClient`; both instances persist so a mode switch keeps each transport's state.
         * @type {Client}
         */
        this.client = this.linkClient;

        /**
         * Baud rate the serial monitor is (re)opened at. The active client auto-opens a monitor on
         * connect and reopens around upload, so it needs a remembered rate; the GUI changes it via
         * {@link setMonitorBaud}.
         * @type {number}
         */
        this._monitorBaud = DEFAULT_MONITOR_BAUD;

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
     * Load a Scratch project from a .sb, .sb2, .sb3 or json string.
     * @param {string | object} input A json string, object, or ArrayBuffer representing the project to load.
     * @returns {!Promise} Promise that resolves after targets are installed.
     */
    loadProject (input) {
        if (typeof input === 'object' && !(input instanceof ArrayBuffer) &&
          !ArrayBuffer.isView(input)) {
            // If the input is an object and not any ArrayBuffer
            // or an ArrayBuffer view (this includes all typed arrays and DataViews)
            // turn the object into a JSON string, because we suspect
            // this is a project.json as an object
            // validate expects a string or buffer as input
            // TODO not sure if we need to check that it also isn't a data view
            input = JSON.stringify(input);
        }

        const validationPromise = new Promise((resolve, reject) => {
            const validate = require('scratch-parser');
            // The second argument of false below indicates to the validator that the
            // input should be parsed/validated as an entire project (and not a single sprite)
            validate(input, false, (error, res) => {
                if (error) return reject(error);
                resolve(res);
            });
        })
            .catch(error => {
                const {SB1File, ValidationError} = require('scratch-sb1-converter');

                try {
                    const sb1 = new SB1File(input);
                    const json = sb1.json;
                    json.projectVersion = 2;
                    return Promise.resolve([json, sb1.zip]);
                } catch (sb1Error) {
                    if (sb1Error instanceof ValidationError) {
                        // The input does not validate as a Scratch 1 file.
                    } else {
                        // The project appears to be a Scratch 1 file but it
                        // could not be successfully translated into a Scratch 2
                        // project.
                        return Promise.reject(sb1Error);
                    }
                }
                // Throw original error since the input does not appear to be
                // an SB1File.
                return Promise.reject(error);
            });

        return validationPromise
            .then(validatedInput => this.deserializeProject(validatedInput[0], validatedInput[1]))
            .then(() => this.runtime.handleProjectLoaded())
            .catch(error => {
                // Intentionally rejecting here (want errors to be handled by caller)
                if (Object.prototype.hasOwnProperty.call(error, 'validationError')) {
                    return Promise.reject(JSON.stringify(error));
                }
                return Promise.reject(error);
            });
    }

    /**
     * Load a project from the Scratch web site, by ID.
     * @param {string} id - the ID of the project to download, as a string.
     */
    downloadProjectId (id) {
        const storage = this.runtime.storage;
        if (!storage) {
            log.error('No storage module present; cannot load project: ', id);
            return;
        }
        const vm = this;
        const promise = storage.load(storage.AssetType.Project, id);
        promise.then(projectAsset => {
            if (!projectAsset) {
                log.error(`Failed to fetch project with id: ${id}`);
                return null;
            }
            return vm.loadProject(projectAsset.data);
        });
    }

    /**
     * @returns {string} Project in a Scratch 3.0 JSON representation.
     */
    saveProjectSb3 () {
        const soundDescs = serializeSounds(this.runtime);
        const costumeDescs = serializeCostumes(this.runtime);
        const projectJson = this.toJSON();

        // TODO want to eventually move zip creation out of here, and perhaps
        // into scratch-storage
        const zip = new JSZip();

        // Put everything in a zip file
        zip.file('project.json', projectJson);
        this._addFileDescsToZip(soundDescs.concat(costumeDescs), zip);

        return zip.generateAsync({
            type: 'blob',
            mimeType: 'application/x.scratch.sb3',
            compression: 'DEFLATE',
            compressionOptions: {
                level: 6 // Tradeoff between best speed (1) and best compression (9)
            }
        });
    }

    /*
     * @type {Array<object>} Array of all costumes and sounds currently in the runtime
     */
    get assets () {
        return this.runtime.targets.reduce((acc, target) => (
            acc
                .concat(target.sprite.sounds.map(sound => sound.asset))
                .concat(target.sprite.costumes.map(costume => costume.asset))
        ), []);
    }

    _addFileDescsToZip (fileDescs, zip) {
        for (let i = 0; i < fileDescs.length; i++) {
            const currFileDesc = fileDescs[i];
            zip.file(currFileDesc.fileName, currFileDesc.fileContent);
        }
    }

    /**
     * Exports a sprite in the sprite3 format.
     * @param {string} targetId ID of the target to export
     * @param {string=} optZipType Optional type that the resulting
     * zip should be outputted in. Options are: base64, binarystring,
     * array, uint8array, arraybuffer, blob, or nodebuffer. Defaults to
     * blob if argument not provided.
     * See https://stuk.github.io/jszip/documentation/api_jszip/generate_async.html#type-option
     * for more information about these options.
     * @returns {object} A generated zip of the sprite and its assets in the format
     * specified by optZipType or blob by default.
     */
    exportSprite (targetId, optZipType) {
        const soundDescs = serializeSounds(this.runtime, targetId);
        const costumeDescs = serializeCostumes(this.runtime, targetId);
        const spriteJson = this.toJSON(targetId);

        const zip = new JSZip();
        zip.file('sprite.json', spriteJson);
        this._addFileDescsToZip(soundDescs.concat(costumeDescs), zip);

        return zip.generateAsync({
            type: typeof optZipType === 'string' ? optZipType : 'blob',
            mimeType: 'application/x.scratch.sprite3',
            compression: 'DEFLATE',
            compressionOptions: {
                level: 6
            }
        });
    }

    /**
     * Export project or sprite as a Scratch 3.0 JSON representation.
     * @param {string=} optTargetId - Optional id of a sprite to serialize
     * @returns {string} Serialized state of the runtime.
     */
    toJSON (optTargetId) {
        const sb3 = require('./serialization/sb3');
        return StringUtil.stringify(sb3.serialize(this.runtime, optTargetId));
    }

    // TODO do we still need this function? Keeping it here so as not to introduce
    // a breaking change.
    /**
     * Load a project from a Scratch JSON representation.
     * @param {string} json JSON string representing a project.
     * @returns {Promise} Promise that resolves after the project has loaded
     */
    fromJSON (json) {
        log.warning('fromJSON is now just a wrapper around loadProject, please use that function instead.');
        return this.loadProject(json);
    }

    /**
     * Load a project from a Scratch JSON representation.
     * @param {string} projectJSON JSON string representing a project.
     * @param {?JSZip} zip Optional zipped project containing assets to be loaded.
     * @returns {Promise} Promise that resolves after the project has loaded
     */
    deserializeProject (projectJSON, zip) {
        // Clear the current runtime
        this.clear();

        if (typeof performance !== 'undefined') {
            performance.mark('scratch-vm-deserialize-start');
        }
        const runtime = this.runtime;
        const deserializePromise = function () {
            const projectVersion = projectJSON.projectVersion;
            if (projectVersion === 2) {
                const sb2 = require('./serialization/sb2');
                return sb2.deserialize(projectJSON, runtime, false, zip);
            }
            if (projectVersion === 3) {
                const sb3 = require('./serialization/sb3');
                return sb3.deserialize(projectJSON, runtime, zip);
            }
            // TODO: reject with an Error (possible breaking API change!)
            // eslint-disable-next-line prefer-promise-reject-errors
            return Promise.reject('Unable to verify Scratch Project version.');
        };
        return deserializePromise()
            .then(({targets, extensions, board}) => {
                if (typeof performance !== 'undefined') {
                    performance.mark('scratch-vm-deserialize-end');
                    performance.measure('scratch-vm-deserialize',
                        'scratch-vm-deserialize-start', 'scratch-vm-deserialize-end');
                }
                return this.installTargets(targets, extensions, true)
                    .then(async installed => {
                        // Restore the project's saved board (sb3 only; sb2 has none) once targets are in.
                        await this._applyBoard(board || null);
                        return installed;
                    });
            });
    }

    /**
     * Install `deserialize` results: zero or more targets after the extensions (if any) used by those targets.
     * @param {Array.<Target>} targets - the targets to be installed
     * @param {ImportedExtensionsInfo} extensions - metadata about extensions used by these targets
     * @param {boolean} wholeProject - set to true if installing a whole project, as opposed to a single sprite.
     * @returns {Promise} resolved once targets have been installed
     */
    installTargets (targets, extensions, wholeProject) {
        const extensionPromises = [];

        extensions.extensionIDs.forEach(extensionID => {
            if (!this.extensionManager.isExtensionLoaded(extensionID)) {
                const extensionURL = extensions.extensionURLs.get(extensionID) || extensionID;
                extensionPromises.push(this.extensionManager.loadExtensionURL(extensionURL));
            }
        });

        targets = targets.filter(target => !!target);

        return Promise.all(extensionPromises).then(() => {
            targets.forEach(target => {
                this.runtime.addTarget(target);
                (/** @type RenderedTarget */ target).updateAllDrawableProperties();
                // Ensure unique sprite name
                if (target.isSprite()) this.renameSprite(target.id, target.getName());
            });
            // Sort the executable targets by layerOrder.
            // Remove layerOrder property after use.
            this.runtime.executableTargets.sort((a, b) => a.layerOrder - b.layerOrder);
            targets.forEach(target => {
                delete target.layerOrder;
            });

            // Select the first target for editing, e.g., the first sprite.
            if (wholeProject && (targets.length > 1)) {
                this.editingTarget = targets[1];
            } else {
                this.editingTarget = targets[0];
            }

            if (wholeProject) {
                // A loaded project may carry dangling variable, list, or broadcast
                // references baked in by historical bugs. Reconcile each target so
                // those references resolve cleanly without renaming any legitimate
                // local-vs-global name collisions.
                targets.forEach(target => target.reconcileVariableReferences());
            } else {
                this.editingTarget.fixUpVariableReferences();
            }

            // Update the VM user's knowledge of targets and blocks on the workspace.
            this.emitTargetsUpdate(false /* Don't emit project change */);
            this.emitWorkspaceUpdate();
            this.runtime.setEditingTarget(this.editingTarget);
            this.runtime.ioDevices.cloud.setStage(this.runtime.getTargetForStage());
        });
    }

    /**
     * Add a sprite, this could be .sprite2 or .sprite3. Unpack and validate
     * such a file first.
     * @param {string | object} input A json string, object, or ArrayBuffer representing the project to load.
     * @returns {!Promise} Promise that resolves after targets are installed.
     */
    addSprite (input) {
        const errorPrefix = 'Sprite Upload Error:';
        if (typeof input === 'object' && !(input instanceof ArrayBuffer) &&
          !ArrayBuffer.isView(input)) {
            // If the input is an object and not any ArrayBuffer
            // or an ArrayBuffer view (this includes all typed arrays and DataViews)
            // turn the object into a JSON string, because we suspect
            // this is a project.json as an object
            // validate expects a string or buffer as input
            // TODO not sure if we need to check that it also isn't a data view
            input = JSON.stringify(input);
        }

        const validationPromise = new Promise((resolve, reject) => {
            const validate = require('scratch-parser');
            // The second argument of true below indicates to the parser/validator
            // that the given input should be treated as a single sprite and not
            // an entire project
            validate(input, true, (error, res) => {
                if (error) return reject(error);
                resolve(res);
            });
        });

        return validationPromise
            .then(validatedInput => {
                const projectVersion = validatedInput[0].projectVersion;
                if (projectVersion === 2) {
                    return this._addSprite2(validatedInput[0], validatedInput[1]);
                }
                if (projectVersion === 3) {
                    return this._addSprite3(validatedInput[0], validatedInput[1]);
                }
                // TODO: reject with an Error (possible breaking API change!)
                // eslint-disable-next-line prefer-promise-reject-errors
                return Promise.reject(`${errorPrefix} Unable to verify sprite version.`);
            })
            .then(() => this.runtime.emitProjectChanged())
            .catch(error => {
                // Intentionally rejecting here (want errors to be handled by caller)
                if (Object.prototype.hasOwnProperty.call(error, 'validationError')) {
                    return Promise.reject(JSON.stringify(error));
                }
                // TODO: reject with an Error (possible breaking API change!)
                // eslint-disable-next-line prefer-promise-reject-errors
                return Promise.reject(`${errorPrefix} ${error}`);
            });
    }

    /**
     * Add a single sprite from the "Sprite2" (i.e., SB2 sprite) format.
     * @param {object} sprite Object representing 2.0 sprite to be added.
     * @param {?ArrayBuffer} zip Optional zip of assets being referenced by json
     * @returns {Promise} Promise that resolves after the sprite is added
     */
    _addSprite2 (sprite, zip) {
        // Validate & parse

        const sb2 = require('./serialization/sb2');
        return sb2.deserialize(sprite, this.runtime, true, zip)
            .then(({targets, extensions}) =>
                this.installTargets(targets, extensions, false));
    }

    /**
     * Add a single sb3 sprite.
     * @param {object} sprite Object rperesenting 3.0 sprite to be added.
     * @param {?ArrayBuffer} zip Optional zip of assets being referenced by target json
     * @returns {Promise} Promise that resolves after the sprite is added
     */
    _addSprite3 (sprite, zip) {
        // Validate & parse
        const sb3 = require('./serialization/sb3');
        return sb3
            .deserialize(sprite, this.runtime, zip, true)
            .then(({targets, extensions}) => this.installTargets(targets, extensions, false));
    }

    /**
     * Add a costume to the current editing target.
     * @param {string} md5ext - the MD5 and extension of the costume to be loaded.
     * @param {!object} costumeObject Object representing the costume.
     * @property {int} skinId - the ID of the costume's render skin, once installed.
     * @property {number} rotationCenterX - the X component of the costume's origin.
     * @property {number} rotationCenterY - the Y component of the costume's origin.
     * @property {number} [bitmapResolution] - the resolution scale for a bitmap costume.
     * @param {string} optTargetId - the id of the target to add to, if not the editing target.
     * @param {string} optVersion - if this is 2, load costume as sb2, otherwise load costume as sb3.
     * @returns {?Promise} - a promise that resolves when the costume has been added
     */
    addCostume (md5ext, costumeObject, optTargetId, optVersion) {
        const target = optTargetId ? this.runtime.getTargetById(optTargetId) :
            this.editingTarget;
        if (target) {
            return loadCostume(md5ext, costumeObject, this.runtime, optVersion).then(() => {
                target.addCostume(costumeObject);
                target.setCostume(
                    target.getCostumes().length - 1
                );
                this.runtime.emitProjectChanged();
            });
        }
        // If the target cannot be found by id, return a rejected promise
        // TODO: reject with an Error (possible breaking API change!)
        // eslint-disable-next-line prefer-promise-reject-errors
        return Promise.reject();
    }

    /**
     * Add a costume loaded from the library to the current editing target.
     * @param {string} md5ext - the MD5 and extension of the costume to be loaded.
     * @param {!object} costumeObject Object representing the costume.
     * @property {int} skinId - the ID of the costume's render skin, once installed.
     * @property {number} rotationCenterX - the X component of the costume's origin.
     * @property {number} rotationCenterY - the Y component of the costume's origin.
     * @property {number} [bitmapResolution] - the resolution scale for a bitmap costume.
     * @returns {?Promise} - a promise that resolves when the costume has been added
     */
    addCostumeFromLibrary (md5ext, costumeObject) {
        // TODO: reject with an Error (possible breaking API change!)
        // eslint-disable-next-line prefer-promise-reject-errors
        if (!this.editingTarget) return Promise.reject();
        return this.addCostume(md5ext, costumeObject, this.editingTarget.id, 2 /* optVersion */);
    }

    /**
     * Duplicate the costume at the given index. Add it at that index + 1.
     * @param {!int} costumeIndex Index of costume to duplicate
     * @returns {?Promise} - a promise that resolves when the costume has been decoded and added
     */
    duplicateCostume (costumeIndex) {
        const originalCostume = this.editingTarget.getCostumes()[costumeIndex];
        const clone = Object.assign({}, originalCostume);
        const md5ext = `${clone.assetId}.${clone.dataFormat}`;
        return loadCostume(md5ext, clone, this.runtime).then(() => {
            this.editingTarget.addCostume(clone, costumeIndex + 1);
            this.editingTarget.setCostume(costumeIndex + 1);
            this.emitTargetsUpdate();
        });
    }

    /**
     * Duplicate the sound at the given index. Add it at that index + 1.
     * @param {!int} soundIndex Index of sound to duplicate
     * @returns {?Promise} - a promise that resolves when the sound has been decoded and added
     */
    duplicateSound (soundIndex) {
        const originalSound = this.editingTarget.getSounds()[soundIndex];
        const clone = Object.assign({}, originalSound);
        return loadSound(clone, this.runtime, this.editingTarget.sprite.soundBank).then(() => {
            this.editingTarget.addSound(clone, soundIndex + 1);
            this.emitTargetsUpdate();
        });
    }

    /**
     * Rename a costume on the current editing target.
     * @param {int} costumeIndex - the index of the costume to be renamed.
     * @param {string} newName - the desired new name of the costume (will be modified if already in use).
     */
    renameCostume (costumeIndex, newName) {
        this.editingTarget.renameCostume(costumeIndex, newName);
        this.emitTargetsUpdate();
    }

    /**
     * Delete a costume from the current editing target.
     * @param {int} costumeIndex - the index of the costume to be removed.
     * @returns {?Function} A function to restore the deleted costume, or null,
     * if no costume was deleted.
     */
    deleteCostume (costumeIndex) {
        const deletedCostume = this.editingTarget.deleteCostume(costumeIndex);
        if (deletedCostume) {
            const target = this.editingTarget;
            this.runtime.emitProjectChanged();
            return () => {
                target.addCostume(deletedCostume);
                this.emitTargetsUpdate();
            };
        }
        return null;
    }

    /**
     * Add a sound to the current editing target.
     * @param {!object} soundObject Object representing the costume.
     * @param {string} optTargetId - the id of the target to add to, if not the editing target.
     * @returns {?Promise} - a promise that resolves when the sound has been decoded and added
     */
    addSound (soundObject, optTargetId) {
        const target = optTargetId ? this.runtime.getTargetById(optTargetId) :
            this.editingTarget;
        if (target) {
            return loadSound(soundObject, this.runtime, target.sprite.soundBank).then(() => {
                target.addSound(soundObject);
                this.emitTargetsUpdate();
            });
        }
        // If the target cannot be found by id, return a rejected promise
        return new Promise.reject();
    }

    /**
     * Rename a sound on the current editing target.
     * @param {int} soundIndex - the index of the sound to be renamed.
     * @param {string} newName - the desired new name of the sound (will be modified if already in use).
     */
    renameSound (soundIndex, newName) {
        this.editingTarget.renameSound(soundIndex, newName);
        this.emitTargetsUpdate();
    }

    /**
     * Get a sound buffer from the audio engine.
     * @param {int} soundIndex - the index of the sound to be got.
     * @returns {AudioBuffer} the sound's audio buffer.
     */
    getSoundBuffer (soundIndex) {
        const id = this.editingTarget.sprite.sounds[soundIndex]?.soundId;
        if (id && this.runtime && this.runtime.audioEngine) {
            return this.editingTarget.sprite.soundBank.getSoundPlayer(id).buffer;
        }
        return null;
    }

    /**
     * Update a sound buffer.
     * @param {int} soundIndex - the index of the sound to be updated.
     * @param {AudioBuffer} newBuffer - new audio buffer for the audio engine.
     * @param {ArrayBuffer} soundEncoding - the new (wav) encoded sound to be stored
     */
    updateSoundBuffer (soundIndex, newBuffer, soundEncoding) {
        const sound = this.editingTarget.sprite.sounds[soundIndex];
        if (sound && sound.broken) delete sound.broken;
        const id = sound ? sound.soundId : null;
        if (id && this.runtime && this.runtime.audioEngine) {
            this.editingTarget.sprite.soundBank.getSoundPlayer(id).buffer = newBuffer;
        }
        // Update sound in runtime
        if (soundEncoding) {
            // Now that we updated the sound, the format should also be updated
            // so that the sound can eventually be decoded the right way.
            // Sounds that were formerly 'adpcm', but were updated in sound editor
            // will not get decoded by the audio engine correctly unless the format
            // is updated as below.
            sound.format = '';
            const storage = this.runtime.storage;
            sound.asset = storage.createAsset(
                storage.AssetType.Sound,
                storage.DataFormat.WAV,
                soundEncoding,
                null,
                true // generate md5
            );
            sound.assetId = sound.asset.assetId;
            sound.dataFormat = storage.DataFormat.WAV;
            sound.md5 = `${sound.assetId}.${sound.dataFormat}`;
            sound.sampleCount = newBuffer.length;
            sound.rate = newBuffer.sampleRate;
        }
        // If soundEncoding is null, it's because gui had a problem
        // encoding the updated sound. We don't want to store anything in this
        // case, and gui should have logged an error.

        this.emitTargetsUpdate();
    }

    /**
     * Delete a sound from the current editing target.
     * @param {int} soundIndex - the index of the sound to be removed.
     * @returns {?Function} A function to restore the sound that was deleted,
     * or null, if no sound was deleted.
     */
    deleteSound (soundIndex) {
        const target = this.editingTarget;
        const deletedSound = this.editingTarget.deleteSound(soundIndex);
        if (deletedSound) {
            this.runtime.emitProjectChanged();
            const restoreFun = () => {
                target.addSound(deletedSound);
                this.emitTargetsUpdate();
            };
            return restoreFun;
        }
        return null;
    }

    /**
     * Get a string representation of the image from storage.
     * @param {int} costumeIndex - the index of the costume to be got.
     * @returns {string} the costume's SVG string if it's SVG,
     *     a dataURI if it's a PNG or JPG, or null if it couldn't be found or decoded.
     */
    getCostume (costumeIndex) {
        const asset = this.editingTarget.getCostumes()[costumeIndex].asset;
        if (!asset || !this.runtime || !this.runtime.storage) return null;
        const format = asset.dataFormat;
        if (format === this.runtime.storage.DataFormat.SVG) {
            return asset.decodeText();
        } else if (format === this.runtime.storage.DataFormat.PNG ||
                format === this.runtime.storage.DataFormat.JPG) {
            return asset.encodeDataURI();
        }
        log.error(`Unhandled format: ${asset.dataFormat}`);
        return null;
    }

    /**
     * Update a costume with the given bitmap
     * @param {!int} costumeIndex - the index of the costume to be updated.
     * @param {!ImageData} bitmap - new bitmap for the renderer.
     * @param {!number} rotationCenterX x of point about which the costume rotates, relative to its upper left corner
     * @param {!number} rotationCenterY y of point about which the costume rotates, relative to its upper left corner
     * @param {!number} bitmapResolution 1 for bitmaps that have 1 pixel per unit of stage,
     *     2 for double-resolution bitmaps
     */
    updateBitmap (costumeIndex, bitmap, rotationCenterX, rotationCenterY, bitmapResolution) {
        const costume = this.editingTarget.getCostumes()[costumeIndex];
        if (!(costume && this.runtime && this.runtime.renderer)) return;
        if (costume && costume.broken) delete costume.broken;

        costume.rotationCenterX = rotationCenterX;
        costume.rotationCenterY = rotationCenterY;

        // If the bitmap originally had a zero width or height, use that value
        const bitmapWidth = bitmap.sourceWidth === 0 ? 0 : bitmap.width;
        const bitmapHeight = bitmap.sourceHeight === 0 ? 0 : bitmap.height;
        // @todo: updateBitmapSkin does not take ImageData
        const canvas = document.createElement('canvas');
        canvas.width = bitmapWidth;
        canvas.height = bitmapHeight;
        const context = canvas.getContext('2d');
        context.putImageData(bitmap, 0, 0);

        // Divide by resolution because the renderer's definition of the rotation center
        // is the rotation center divided by the bitmap resolution
        this.runtime.renderer.updateBitmapSkin(
            costume.skinId,
            canvas,
            bitmapResolution,
            [rotationCenterX / bitmapResolution, rotationCenterY / bitmapResolution]
        );

        // @todo there should be a better way to get from ImageData to a decodable storage format
        canvas.toBlob(blob => {
            const reader = new FileReader();
            reader.addEventListener('loadend', () => {
                const storage = this.runtime.storage;
                costume.dataFormat = storage.DataFormat.PNG;
                costume.bitmapResolution = bitmapResolution;
                costume.size = [bitmapWidth, bitmapHeight];
                costume.asset = storage.createAsset(
                    storage.AssetType.ImageBitmap,
                    costume.dataFormat,
                    Buffer.from(reader.result),
                    null, // id
                    true // generate md5
                );
                costume.assetId = costume.asset.assetId;
                costume.md5 = `${costume.assetId}.${costume.dataFormat}`;
                this.emitTargetsUpdate();
            });
            // Bitmaps with a zero width or height return null for their blob
            if (blob){
                reader.readAsArrayBuffer(blob);
            }
        });
    }

    /**
     * Update a costume with the given SVG
     * @param {int} costumeIndex - the index of the costume to be updated.
     * @param {string} svg - new SVG for the renderer.
     * @param {number} rotationCenterX x of point about which the costume rotates, relative to its upper left corner
     * @param {number} rotationCenterY y of point about which the costume rotates, relative to its upper left corner
     */
    updateSvg (costumeIndex, svg, rotationCenterX, rotationCenterY) {
        const costume = this.editingTarget.getCostumes()[costumeIndex];
        if (costume && costume.broken) delete costume.broken;
        if (costume && this.runtime && this.runtime.renderer) {
            costume.rotationCenterX = rotationCenterX;
            costume.rotationCenterY = rotationCenterY;
            this.runtime.renderer.updateSVGSkin(costume.skinId, svg, [rotationCenterX, rotationCenterY]);
            costume.size = this.runtime.renderer.getSkinSize(costume.skinId);
        }
        const storage = this.runtime.storage;
        // If we're in here, we've edited an svg in the vector editor,
        // so the dataFormat should be 'svg'
        costume.dataFormat = storage.DataFormat.SVG;
        costume.bitmapResolution = 1;
        costume.asset = storage.createAsset(
            storage.AssetType.ImageVector,
            costume.dataFormat,
            (new _TextEncoder()).encode(svg),
            null,
            true // generate md5
        );
        costume.assetId = costume.asset.assetId;
        costume.md5 = `${costume.assetId}.${costume.dataFormat}`;
        this.emitTargetsUpdate();
    }

    /**
     * Add a backdrop to the stage.
     * @param {string} md5ext - the MD5 and extension of the backdrop to be loaded.
     * @param {!object} backdropObject Object representing the backdrop.
     * @property {int} skinId - the ID of the backdrop's render skin, once installed.
     * @property {number} rotationCenterX - the X component of the backdrop's origin.
     * @property {number} rotationCenterY - the Y component of the backdrop's origin.
     * @property {number} [bitmapResolution] - the resolution scale for a bitmap backdrop.
     * @returns {?Promise} - a promise that resolves when the backdrop has been added
     */
    addBackdrop (md5ext, backdropObject) {
        return loadCostume(md5ext, backdropObject, this.runtime).then(() => {
            const stage = this.runtime.getTargetForStage();
            stage.addCostume(backdropObject);
            stage.setCostume(stage.getCostumes().length - 1);
            this.runtime.emitProjectChanged();
        });
    }

    /**
     * Rename a sprite.
     * @param {string} targetId ID of a target whose sprite to rename.
     * @param {string} newName New name of the sprite.
     */
    renameSprite (targetId, newName) {
        const target = this.runtime.getTargetById(targetId);
        if (target) {
            if (!target.isSprite()) {
                throw new Error('Cannot rename non-sprite targets.');
            }
            const sprite = target.sprite;
            if (!sprite) {
                throw new Error('No sprite associated with this target.');
            }
            if (newName && RESERVED_NAMES.indexOf(newName) === -1) {
                const names = this.runtime.targets
                    .filter(runtimeTarget => runtimeTarget.isSprite() && runtimeTarget.id !== target.id)
                    .map(runtimeTarget => runtimeTarget.sprite.name);
                const oldName = sprite.name;
                const newUnusedName = StringUtil.unusedName(newName, names);
                sprite.name = newUnusedName;
                const allTargets = this.runtime.targets;
                for (let i = 0; i < allTargets.length; i++) {
                    const currTarget = allTargets[i];
                    currTarget.blocks.updateAssetName(oldName, newName, 'sprite');
                }

                if (newUnusedName !== oldName) this.emitTargetsUpdate();
            }
        } else {
            throw new Error('No target with the provided id.');
        }
    }

    /**
     * Delete a sprite and all its clones.
     * @param {string} targetId ID of a target whose sprite to delete.
     * @returns {Function} Returns a function to restore the sprite that was deleted
     */
    deleteSprite (targetId) {
        const target = this.runtime.getTargetById(targetId);

        if (target) {
            const targetIndexBeforeDelete = this.runtime.targets.map(t => t.id).indexOf(target.id);
            if (!target.isSprite()) {
                throw new Error('Cannot delete non-sprite targets.');
            }
            const sprite = target.sprite;
            if (!sprite) {
                throw new Error('No sprite associated with this target.');
            }
            const spritePromise = this.exportSprite(targetId, 'uint8array');
            const restoreSprite = () => spritePromise.then(spriteBuffer => this.addSprite(spriteBuffer));
            // Remove monitors from the runtime state and remove the
            // target-specific monitored blocks (e.g. local variables)
            target.deleteMonitors();
            const currentEditingTarget = this.editingTarget;
            for (let i = 0; i < sprite.clones.length; i++) {
                const clone = sprite.clones[i];
                this.runtime.stopForTarget(sprite.clones[i]);
                this.runtime.disposeTarget(sprite.clones[i]);
                // Ensure editing target is switched if we are deleting it.
                if (clone === currentEditingTarget) {
                    const nextTargetIndex = Math.min(this.runtime.targets.length - 1, targetIndexBeforeDelete);
                    if (this.runtime.targets.length > 0){
                        this.setEditingTarget(this.runtime.targets[nextTargetIndex].id);
                    } else {
                        this.editingTarget = null;
                    }
                }
            }
            // Sprite object should be deleted by GC.
            this.emitTargetsUpdate();
            return restoreSprite;
        }

        throw new Error('No target with the provided id.');
    }

    /**
     * Duplicate a sprite.
     * @param {string} targetId ID of a target whose sprite to duplicate.
     * @returns {Promise} Promise that resolves when duplicated target has
     *     been added to the runtime.
     */
    duplicateSprite (targetId) {
        const target = this.runtime.getTargetById(targetId);
        if (!target) {
            throw new Error('No target with the provided id.');
        } else if (!target.isSprite()) {
            throw new Error('Cannot duplicate non-sprite targets.');
        } else if (!target.sprite) {
            throw new Error('No sprite associated with this target.');
        }
        return target.duplicate().then(newTarget => {
            this.runtime.addTarget(newTarget);
            newTarget.goBehindOther(target);
            this.setEditingTarget(newTarget.id);
        });
    }

    /**
     * Set the audio engine for the VM/runtime
     * @param {!AudioEngine} audioEngine The audio engine to attach
     */
    attachAudioEngine (audioEngine) {
        this.runtime.attachAudioEngine(audioEngine);
    }

    /**
     * Set the renderer for the VM/runtime
     * @param {!RenderWebGL} renderer The renderer to attach
     */
    attachRenderer (renderer) {
        this.runtime.attachRenderer(renderer);
    }

    /**
     * @returns {RenderWebGL} The renderer attached to the vm
     */
    get renderer () {
        return this.runtime && this.runtime.renderer;
    }

    // @deprecated
    attachV2SVGAdapter () {
    }

    /**
     * Set the bitmap adapter for the VM/runtime, which converts scratch 2
     * bitmaps to scratch 3 bitmaps. (Scratch 3 bitmaps are all bitmap resolution 2)
     * @param {!Function} bitmapAdapter The adapter to attach
     */
    attachV2BitmapAdapter (bitmapAdapter) {
        this.runtime.attachV2BitmapAdapter(bitmapAdapter);
    }

    /**
     * Set the storage module for the VM/runtime
     * @param {!ScratchStorage} storage The storage module to attach
     */
    attachStorage (storage) {
        this.runtime.attachStorage(storage);
    }

    /**
     * set the current locale and builtin messages for the VM
     * @param {!string} locale       current locale
     * @param {!object} messages     builtin messages map for current locale
     * @returns {Promise} Promise that resolves when all the blocks have been
     *     updated for a new locale (or empty if locale hasn't changed.)
     */
    setLocale (locale, messages) {
        if (locale !== formatMessage.setup().locale) {
            formatMessage.setup({locale: locale, translations: {[locale]: messages}});
        }
        return this.extensionManager.refreshBlocks();
    }

    /**
     * get the current locale for the VM
     * @returns {string} the current locale in the VM
     */
    getLocale () {
        return formatMessage.setup().locale;
    }

    /**
     * The list of selectable devices for the GUI, each with its presentation info and FQBN.
     * @returns {Array.<object>} device descriptors: {deviceId, fqbn, iconURL, name, description,
     *   manufacturer, requires, learnMore, help}.
     */
    getDeviceList () {
        return this.deviceRegistry.deviceIds.map(deviceId => {
            const device = this.deviceRegistry.get(deviceId);
            const manifest = this._deviceManifestsById.get(deviceId);
            if (!manifest) {
                throw new Error(`getDeviceList: no device manifest registered for "${deviceId}"`);
            }
            return Object.assign(
                {deviceId: device.deviceId, fqbn: device.fqbn, iconURL: manifest.iconURL},
                device.getDeviceInfo()
            );
        });
    }

    /**
     * The HTTP origin the native helper serves resource packs from, derived from the active link
     * client's WebSocket URL (same process, sibling route). Null unless the link client is active
     * (cloud mode has no helper), so resource loading is a no-op outside link mode.
     *
     * The helper roots its `/resources` static route at the pack directory itself (its `--resource-root`
     * is the `thingblock-resource` dir), so the pack name is the root and does not appear in the path:
     * `extensions/…` sits directly under `/resources`.
     * @returns {?string} the resource base, e.g. `http://localhost:3030/resources/extensions`.
     */
    getResourceOrigin () {
        if (this.client !== this.linkClient) return null;
        const httpBase = this.linkClient.url.replace(/^ws/, 'http').replace(/\/$/, '');
        return `${httpBase}/resources/extensions`;
    }

    /**
     * Register a helper-served device manifest as a selectable device. Idempotent: a manifest whose id
     * is already registered is skipped, so a repeated load never throws on a duplicate id.
     * @param {object} manifest - the pack's device manifest (its `manifest.js` default export).
     * @param {string} base - the manifest's served base URL, used to resolve its relative `icon`.
     * @returns {void}
     */
    registerDeviceManifest (manifest, base) {
        if (this.deviceRegistry.get(manifest.id)) return;
        const device = this.deviceRegistry.register(new ManifestDevice(this.runtime, manifest));
        const iconURL = `${base}/${manifest.icon.replace(/^\.\//, '')}`;
        this._deviceManifestsById.set(device.deviceId, {iconURL});
        this._resourceDevicePacks.set(device.deviceId, {manifest, base});
    }

    /**
     * Record a helper-served peripheral pack as a reusable component a device may reference. Peripherals
     * are not registered into the device list; they activate only when a selected device references them.
     * @param {object} manifest - the pack's peripheral manifest (its `manifest.js` default export).
     * @param {string} base - the manifest's served base URL.
     * @returns {void}
     */
    registerPeripheralManifest (manifest, base) {
        this._resourcePeripheralPacks.set(manifest.id, {manifest, base});
    }

    /**
     * Fetch the helper-served pack index and register each device pack against the device registry, so
     * helper-provided boards join the built-in list. One successful run per VM instance (guarded); a
     * missing or unreachable helper logs and returns, leaving built-in devices working and the next
     * link-mode entry free to retry. Peripheral packs are recorded here and activated on device selection.
     * @returns {Promise<void>} resolves once packs are loaded (or skipped).
     */
    async loadResourcePacks () {
        if (this._resourcePacksLoaded) return;
        const origin = this.getResourceOrigin();
        if (!origin) return;

        let packs;
        try {
            const response = await fetch(`${origin}/index.json`);
            ({packs} = await response.json());
        } catch (e) {
            log.warn(`loadResourcePacks: resource index unreachable at ${origin}; ` +
                'using built-in devices only', e);
            return;
        }

        for (const {kind, path} of packs) {
            const base = `${origin}/${path}`;
            try {
                const manifest = (await this._importPackModule(`${base}/manifest.js`)).default;
                if (kind === 'device') {
                    this.registerDeviceManifest(manifest, base);
                } else if (kind === 'peripheral') {
                    this.registerPeripheralManifest(manifest, base);
                }
            } catch (e) {
                log.warn(`loadResourcePacks: failed to load ${kind} pack at ${base}`, e);
            }
        }

        this._resourcePacksLoaded = true;
        this.emit(Runtime.RESOURCE_PACKS_LOADED);

        // A project loaded before its device's pack was available left its board pending; apply it now.
        if (this._pendingBoard) await this._applyBoard(this._pendingBoard);
    }

    /**
     * Dynamically import a helper-served pack module from its HTTP URL at runtime, via the GUI-injected
     * importer ({@link setModuleImporter}). The `import()` literal lives in the GUI's build, not the VM
     * bundle, so webpack never rewrites the remote import nor marks the VM bundle an ES module. Rejects
     * when no importer was set; callers treat that as the pack being unavailable. The single seam tests
     * override to supply in-memory modules.
     * @param {string} url - the served module URL.
     * @returns {Promise<object>} the imported module namespace.
     */
    _importPackModule (url) {
        if (!this._moduleImporter) {
            return Promise.reject(new Error('VirtualMachine: no module importer set; call setModuleImporter()'));
        }
        return this._moduleImporter(url);
    }

    /**
     * Inject the editor's `@scratch/scratch-blocks` module so device selection can register its active
     * peripherals' blocks and Arduino codegen against the shared singleton. Called by the GUI; left null
     * in headless use, where block/codegen registration is skipped.
     * @param {object} scratchBlocks - the `@scratch/scratch-blocks` module handle.
     * @returns {void}
     */
    setScratchBlocks (scratchBlocks) {
        this._scratchBlocks = scratchBlocks;
    }

    /**
     * Inject the function the VM uses to dynamically import helper-served pack modules. The GUI supplies
     * `url => import(url)` from its own bundle so the remote `import()` stays out of the VM build, where
     * webpack would rewrite it and break the bundle's default export. Absent (headless / no GUI), resource
     * packs cannot be loaded.
     * @param {function(string): Promise<object>} importer - imports a module URL, resolving its namespace.
     * @returns {void}
     */
    setModuleImporter (importer) {
        this._moduleImporter = importer;
    }

    /**
     * Select a device and activate its peripherals: first the ones the device provides automatically (its
     * own hidden pack plus any reusable components it references, in `extensions` order), then the
     * user-added project peripherals on top. Clears the previously active peripherals first; selecting a
     * built-in board (no pack) or `null` just clears them. Idempotent per peripheral — a re-selected
     * device re-activates without re-importing or re-registering.
     * @param {?string} deviceId - the selected device's id, or null when none is selected.
     * @returns {Promise<void>} resolves once the device's peripherals are active.
     */
    async selectDevice (deviceId) {
        this._selectedDeviceId = deviceId || null;
        this.peripheralRegistry.clearActive();
        const pack = this._resourceDevicePacks.get(deviceId);
        if (pack) {
            for (const id of pack.manifest.extensions || []) {
                await this._activatePeripheral(id);
            }
            for (const id of this._projectPeripheralIds) {
                await this._activatePeripheral(id);
            }
        }
        this._syncRuntimeBoard();
    }

    /**
     * The peripheral ids the selected device provides automatically (its `extensions`), or empty for a
     * built-in board with no pack. These are always active while the device is selected and cannot be
     * removed from the library.
     * @returns {Array.<string>} the device's own peripheral ids.
     * @private
     */
    _deviceAutoPeripheralIds () {
        const pack = this._resourceDevicePacks.get(this._selectedDeviceId);
        return pack ? (pack.manifest.extensions || []) : [];
    }

    /**
     * Add a user-chosen peripheral to the project and activate it. No-op when the peripheral is already
     * active — whether the device provides it automatically or the user already added it. Emits
     * `PERIPHERALS_CHANGED` so the palette and generated code rebuild.
     * @param {string} id - the peripheral id to add.
     * @returns {Promise<void>} resolves once the peripheral is active.
     */
    async addPeripheral (id) {
        if (this._deviceAutoPeripheralIds().includes(id)) return;
        if (this._projectPeripheralIds.has(id)) return;
        this._projectPeripheralIds.add(id);
        await this._activatePeripheral(id);
        this._syncRuntimeBoard();
        this.emit(Runtime.PERIPHERALS_CHANGED);
    }

    /**
     * Remove a user-added peripheral from the project and deactivate it. Refuses to remove a peripheral
     * the selected device provides automatically (it is not the user's to remove). Emits
     * `PERIPHERALS_CHANGED` when something changed.
     * @param {string} id - the peripheral id to remove.
     * @returns {void}
     */
    removePeripheral (id) {
        if (this._deviceAutoPeripheralIds().includes(id)) {
            log.warn(`removePeripheral: "${id}" is provided by the selected device and cannot be removed`);
            return;
        }
        if (!this._projectPeripheralIds.delete(id)) return;
        this.peripheralRegistry.setInactive(id);
        this._syncRuntimeBoard();
        this.emit(Runtime.PERIPHERALS_CHANGED);
    }

    /**
     * The user-added peripheral ids, beyond what the device provides automatically — the set the project
     * persists.
     * @returns {Array.<string>} the user-added peripheral ids.
     */
    getProjectPeripheralIds () {
        return Array.from(this._projectPeripheralIds);
    }

    /**
     * The non-hidden peripheral packs the library lists, each tagged with its current state: `active`
     * (in the palette now) and `locked` (provided by the selected device, so not user-removable). Hidden
     * packs — a device's own programming surface — never appear. A pack's `iconURL` and localized
     * `description` are included only when its manifest provides them.
     * @returns {Array.<{id: string, name: string, active: boolean, locked: boolean,
     *   description?: string, iconURL?: string}>} library entries.
     */
    getPeripheralList () {
        const auto = this._deviceAutoPeripheralIds();
        const list = [];
        for (const {manifest, base} of this._resourcePeripheralPacks.values()) {
            if (manifest.hidden) continue;
            const locked = auto.includes(manifest.id);
            const entry = {
                id: manifest.id,
                name: manifest.name,
                active: locked || this._projectPeripheralIds.has(manifest.id),
                locked
            };
            if (manifest.description) entry.description = formatMessage(manifest.description);
            if (manifest.icon) entry.iconURL = `${base}/${manifest.icon.replace(/^\.\//, '')}`;
            list.push(entry);
        }
        return list;
    }

    /**
     * Mirror the current board selection onto the runtime so the serializer (which only receives the
     * runtime) can persist it. Null in host mode, so host-mode projects carry no board field.
     * @returns {void}
     * @private
     */
    _syncRuntimeBoard () {
        this.runtime.board = this._selectedDeviceId ?
            {device: this._selectedDeviceId, peripherals: this.getProjectPeripheralIds()} :
            null;
    }

    /**
     * Apply a project's saved board after load: reset to a clean board state, then — once the device is
     * registered (helper packs may still be loading) — restore the user peripherals and select the device.
     * Always emits `BOARD_RESTORED` with the resolved board (a null device for a host-mode project) so the
     * editor syncs its board selection, clearing it when the loaded project has no board. When the device
     * is not yet known, the board is held in `_pendingBoard` and retried (and emitted) once resource packs
     * finish loading.
     * @param {?{device: string, peripherals: Array.<string>}} board - the saved board, or null in host mode.
     * @returns {Promise<void>} resolves once the board is applied or deferred.
     * @private
     */
    async _applyBoard (board) {
        this._selectedDeviceId = null;
        this._projectPeripheralIds = new Set();
        this.peripheralRegistry.clearActive();
        this._pendingBoard = null;
        this._syncRuntimeBoard();

        if (board && board.device && !this.deviceRegistry.get(board.device)) {
            this._pendingBoard = board;
            return;
        }
        if (board && board.device) {
            this._projectPeripheralIds = new Set(board.peripherals || []);
            await this.selectDevice(board.device);
        }
        this.emit(Runtime.BOARD_RESTORED, {
            device: this._selectedDeviceId,
            peripherals: this.getProjectPeripheralIds()
        });
    }

    /**
     * The active peripherals' toolbox categories, for the board-mode palette. Empty until a selected
     * device activates the peripherals it references.
     * @returns {Array.<object>} toolbox category descriptors.
     */
    getActivePeripheralToolboxCategories () {
        return this.peripheralRegistry.getActivePeripheralToolboxCategories();
    }

    /**
     * The active peripherals' vendored libs, for compile-time include resolution. Empty until a selected
     * device activates the peripherals it references.
     * @returns {Array.<object>} lib refs.
     */
    getActivePeripheralLibs () {
        return this.peripheralRegistry.getActivePeripheralLibs();
    }

    /**
     * Activate a peripheral the selected device references (a hidden device-owned pack or a reusable
     * component): import its toolbox and libs and, when a `scratch-blocks` handle is present and it ships
     * blocks, register its blocks and codegen on the shared singleton. Idempotent — an already-activated
     * peripheral is just re-marked active. A failure is logged and skipped so one bad peripheral does not
     * break device selection.
     * @param {string} id - the referenced peripheral id.
     * @returns {Promise<void>} resolves once the peripheral is active.
     * @private
     */
    async _activatePeripheral (id) {
        const pack = this._resourcePeripheralPacks.get(id);
        if (!pack) {
            log.warn(`selectDevice: device references unknown peripheral "${id}"`);
            return;
        }
        if (this.peripheralRegistry.has(id)) {
            this.peripheralRegistry.setActive(id);
            return;
        }
        const {manifest, base} = pack;
        try {
            let toolbox;
            if (manifest.toolbox) {
                toolbox = (await this._importPackModule(
                    `${base}/${manifest.toolbox.replace(/^\.\//, '')}`
                )).default;
            }
            // Compile lib references the helper resolves from its resource root: `pack` is this pack's
            // directory relative to that root (the path after `/resources/` in its served base), `lib`
            // the manifest's lib directory within the pack. The helper joins root/pack/lib in place.
            const packPath = base.split('/resources/')[1];
            const libs = (manifest.libs || []).map(lib => ({pack: packPath, lib: lib.path}));
            if (this._scratchBlocks && manifest.blocks) {
                const {registerBlocks} = await this._importPackModule(
                    `${base}/${manifest.blocks.replace(/^\.\//, '')}`
                );
                registerBlocks(this._scratchBlocks);
                if (manifest.generator) {
                    const {registerGenerators} = await this._importPackModule(
                        `${base}/${manifest.generator.replace(/^\.\//, '')}`
                    );
                    registerGenerators(this._scratchBlocks.arduinoGenerator, this._scratchBlocks.ArduinoOrder);
                }
            }
            this.peripheralRegistry.register({id: manifest.id, toolbox, libs, base});
            this.peripheralRegistry.setActive(manifest.id);
        } catch (e) {
            log.warn(`selectDevice: failed to activate peripheral "${id}" at ${base}`, e);
        }
    }

    /**
     * Select the device-link backend board operations route through: `'cloud'` for the web/Web Serial
     * client, anything else for the native helper. Disconnects the current client first so switching
     * never leaves a dangling link.
     * @param {string} mode - the link mode, `'link'` or `'cloud'`.
     * @returns {void}
     */
    setLinkMode (mode) {
        const next = mode === 'cloud' ? this.cloudClient : this.linkClient;
        if (next === this.client) return;
        if (this.client.isConnected) {
            this.client.disconnect();
        }
        this.client = next;
    }

    /**
     * Discover the boards connected to the user's machine that match the selected device, via the
     * active link client. Discovery filters connected ports by the device's `getUploadConfig().pnpid`.
     * @param {string} deviceId - the selected device's id (from `getDeviceList()`).
     * @returns {Promise<Array.<object>>} the available targets, each `{id, name}`.
     */
    listBoards (deviceId) {
        const device = this.deviceRegistry.get(deviceId);
        if (!device) {
            return Promise.reject(new Error(`listBoards: no device registered for "${deviceId}"`));
        }
        return this.client.listBoards(device);
    }

    /**
     * Open the link to a discovered board via the active link client. Emits `DEVICE_CONNECTED` on
     * success.
     * @param {object} target - the target to open (from `listBoards()`), `{id, name}`.
     * @returns {Promise<void>} resolves once connected.
     */
    connectBoard (target) {
        return this.client.connect(target).then(() => {
            // Auto-open the serial monitor so the board's output streams as soon as it is connected.
            // Best-effort: a monitor that fails to open must not fail the connection itself.
            this.client.openMonitor({baudRate: this._monitorBaud})
                .catch(err => log.warn(`connectBoard: serial monitor did not open: ${err.message}`));
        });
    }

    /**
     * Compile generated firmware source for the selected device via the active link client, streaming
     * build log and progress to the optional callbacks. The active peripherals' vendored libs are
     * passed as references the helper resolves from its resource root (no lib bytes cross the link).
     * @param {string} deviceId - the selected device's id (from `getDeviceList()`).
     * @param {string} source - the generated Arduino C++ source.
     * @param {import('./link/client/callbacks').CompileCallbacks} [callbacks] - optional
     *   `{onLog, onProgress}` streaming callbacks.
     * @returns {Promise<object>} the compiled artifact `{format, path}`.
     */
    compile (deviceId, source, callbacks) {
        const device = this.deviceRegistry.get(deviceId);
        if (!device) {
            return Promise.reject(new Error(`compile: no device registered for "${deviceId}"`));
        }
        return this.client.compile(device, source, this.getActivePeripheralLibs(), callbacks);
    }

    /**
     * Flash a compiled artifact to the connected board for the selected device via the active link
     * client, streaming the upload tool's output to the optional callbacks. Requires a connected board.
     * @param {string} deviceId - the selected device's id (from `getDeviceList()`).
     * @param {object} artifact - the artifact from `compile()` (`{format, path}`).
     * @param {import('./link/client/callbacks').CompileCallbacks} [callbacks] - optional
     *   `{onLog, onProgress}` streaming callbacks.
     * @returns {Promise<void>} resolves once the flash completes.
     */
    async upload (deviceId, artifact, callbacks) {
        const device = this.deviceRegistry.get(deviceId);
        if (!device) {
            throw new Error(`upload: no device registered for "${deviceId}"`);
        }
        // The board's one serial port can't be monitored while the upload tool drives it, so free it
        // for the flash and restore the monitor after. `closeMonitor` is a no-op when none is open.
        await this.client.closeMonitor();
        try {
            await this.client.flash(device, artifact, callbacks);
        } finally {
            if (this.client.isConnected) {
                this.client.openMonitor({baudRate: this._monitorBaud})
                    .catch(err => log.warn(`upload: serial monitor did not reopen: ${err.message}`));
            }
        }
    }

    /**
     * Abort the in-flight compile or upload on the active link client, if any. The running
     * `compile`/`upload` promise rejects with a cancellation error. A no-op when nothing is running.
     * @returns {void}
     */
    cancelUpload () {
        this.client.cancel();
    }

    /**
     * Open the serial monitor on the connected board via the active link client. Inbound serial bytes
     * are emitted on the runtime as `SERIAL_DATA`. Requires a connected board.
     * @param {{baudRate: number}} options - the monitor baud rate.
     * @returns {Promise<void>} resolves once the monitor is open.
     */
    openMonitor (options) {
        return this.client.openMonitor(options);
    }

    /**
     * Write bytes to the open serial monitor via the active link client. A no-op when no monitor is
     * open.
     * @param {string} data - the bytes to send.
     * @returns {void}
     */
    writeMonitor (data) {
        this.client.writeMonitor(data);
    }

    /**
     * Close the serial monitor via the active link client, leaving the board connected.
     * @returns {Promise<void>} resolves once the monitor is closed.
     */
    closeMonitor () {
        return this.client.closeMonitor();
    }

    /**
     * Set the baud rate the serial monitor (re)opens at. When a board is connected the open monitor is
     * reopened at the new rate; otherwise the rate is just remembered for the next auto-open. The rate
     * is also reused when the monitor reopens after an upload.
     * @param {number} rate - the baud rate.
     * @returns {void}
     */
    setMonitorBaud (rate) {
        this._monitorBaud = rate;
        if (this.client.isConnected) {
            this.client.closeMonitor()
                .then(() => this.client.openMonitor({baudRate: rate}))
                .catch(err => log.warn(`setMonitorBaud: serial monitor did not reopen: ${err.message}`));
        }
    }

    /**
     * Close the link to the connected board. Emits `DEVICE_DISCONNECTED`. Safe when not connected.
     * @returns {Promise<void>} resolves once disconnected.
     */
    disconnectBoard () {
        return this.client.disconnect();
    }

    /**
     * Handle a Blockly event for the current editing target.
     * @param {!Blockly.Event} e Any Blockly event.
     */
    blockListener (e) {
        if (this.editingTarget) {
            this.editingTarget.blocks.blocklyListen(e);
        }
    }

    /**
     * Handle a Blockly event for the flyout.
     * @param {!Blockly.Event} e Any Blockly event.
     */
    flyoutBlockListener (e) {
        this.runtime.flyoutBlocks.blocklyListen(e);
    }

    /**
     * Handle a Blockly event for the flyout to be passed to the monitor container.
     * @param {!Blockly.Event} e Any Blockly event.
     */
    monitorBlockListener (e) {
        // Filter events by type, since monitor blocks only need to listen to these events.
        // Monitor blocks shouldn't be destroyed when flyout blocks are deleted.
        if (['create', 'change'].indexOf(e.type) !== -1) {
            this.runtime.monitorBlocks.blocklyListen(e);
        }
    }

    /**
     * Handle a Blockly event for the variable map.
     * @param {!Blockly.Event} e Any Blockly event.
     */
    variableListener (e) {
        // Filter events by type, since blocks only needs to listen to these
        // var events.
        if (['var_create', 'var_rename', 'var_delete'].indexOf(e.type) !== -1) {
            this.runtime.getTargetForStage().blocks.blocklyListen(e);
        }
    }

    /**
     * Delete all of the flyout blocks.
     */
    clearFlyoutBlocks () {
        this.runtime.flyoutBlocks.deleteAllBlocks();
    }

    /**
     * Set an editing target. An editor UI can use this function to switch
     * between editing different targets, sprites, etc.
     * After switching the editing target, the VM may emit updates
     * to the list of targets and any attached workspace blocks
     * (see `emitTargetsUpdate` and `emitWorkspaceUpdate`).
     * @param {string} targetId Id of target to set as editing.
     */
    setEditingTarget (targetId) {
        // Has the target id changed? If not, exit.
        if (this.editingTarget && targetId === this.editingTarget.id) {
            return;
        }
        const target = this.runtime.getTargetById(targetId);
        if (target) {
            this.editingTarget = target;
            // Emit appropriate UI updates.
            this.emitTargetsUpdate(false /* Don't emit project change */);
            this.emitWorkspaceUpdate();
            this.runtime.setEditingTarget(target);
        }
    }

    /**
     * Called when blocks are dragged from one sprite to another. Adds the blocks to the
     * workspace of the given target.
     * @param {!Array<object>} blocks Blocks to add.
     * @param {!string} targetId Id of target to add blocks to.
     * @param {?string} optFromTargetId Optional target id indicating that blocks are being
     * shared from that target. This is needed for resolving any potential variable conflicts.
     * @returns {!Promise} Promise that resolves when the extensions and blocks have been added.
     */
    shareBlocksToTarget (blocks, targetId, optFromTargetId) {
        const sb3 = require('./serialization/sb3');

        const copiedBlocks = JSON.parse(JSON.stringify(blocks));
        newBlockIds(copiedBlocks);
        const target = this.runtime.getTargetById(targetId);

        if (optFromTargetId) {
            // If the blocks are being shared from another target,
            // resolve any possible variable conflicts that may arise.
            const fromTarget = this.runtime.getTargetById(optFromTargetId);
            fromTarget.resolveVariableSharingConflictsWithTarget(copiedBlocks, target);
        }

        // Create a unique set of extensionIds that are not yet loaded
        const extensionIDs = new Set(copiedBlocks
            .map(b => sb3.getExtensionIdForOpcode(b.opcode))
            .filter(id => !!id) // Remove ids that do not exist
            .filter(id => !this.extensionManager.isExtensionLoaded(id)) // and remove loaded extensions
        );

        // Create an array promises for extensions to load
        const extensionPromises = Array.from(extensionIDs,
            id => this.extensionManager.loadExtensionURL(id)
        );

        return Promise.all(extensionPromises).then(() => {
            copiedBlocks.forEach(block => {
                target.blocks.createBlock(block);
            });
            target.blocks.updateTargetSpecificBlocks(target.isStage);
            if (!optFromTargetId) {
                // No source target means the blocks come from outside the project (e.g. the
                // backpack). Reconcile any variable, list, or broadcast references against
                // what's defined in the project, creating missing definitions on the stage.
                target.fixUpVariableReferences();
            }
        });
    }

    /**
     * Called when costumes are dragged from editing target to another target.
     * Sets the newly added costume as the current costume.
     * @param {!number} costumeIndex Index of the costume of the editing target to share.
     * @param {!string} targetId Id of target to add the costume.
     * @returns {Promise} Promise that resolves when the new costume has been loaded.
     */
    shareCostumeToTarget (costumeIndex, targetId) {
        const originalCostume = this.editingTarget.getCostumes()[costumeIndex];
        const clone = Object.assign({}, originalCostume);
        const md5ext = `${clone.assetId}.${clone.dataFormat}`;
        return loadCostume(md5ext, clone, this.runtime).then(() => {
            const target = this.runtime.getTargetById(targetId);
            if (target) {
                target.addCostume(clone);
                target.setCostume(
                    target.getCostumes().length - 1
                );
            }
        });
    }

    /**
     * Called when sounds are dragged from editing target to another target.
     * @param {!number} soundIndex Index of the sound of the editing target to share.
     * @param {!string} targetId Id of target to add the sound.
     * @returns {Promise} Promise that resolves when the new sound has been loaded.
     */
    shareSoundToTarget (soundIndex, targetId) {
        const originalSound = this.editingTarget.getSounds()[soundIndex];
        const clone = Object.assign({}, originalSound);
        const target = this.runtime.getTargetById(targetId);
        return loadSound(clone, this.runtime, target.sprite.soundBank).then(() => {
            if (target) {
                target.addSound(clone);
                this.emitTargetsUpdate();
            }
        });
    }

    /**
     * Repopulate the workspace with the blocks of the current editingTarget. This
     * allows us to get around bugs like gui#413.
     */
    refreshWorkspace () {
        if (this.editingTarget) {
            this.emitWorkspaceUpdate();
            this.runtime.setEditingTarget(this.editingTarget);
            this.emitTargetsUpdate(false /* Don't emit project change */);
        }
    }

    /**
     * Emit metadata about available targets.
     * An editor UI could use this to display a list of targets and show
     * the currently editing one.
     * @param {bool} triggerProjectChange If true, also emit a project changed event.
     * Disabled selectively by updates that don't affect project serialization.
     * Defaults to true.
     */
    emitTargetsUpdate (triggerProjectChange) {
        if (typeof triggerProjectChange === 'undefined') triggerProjectChange = true;
        this.emit('targetsUpdate', {
            // [[target id, human readable target name], ...].
            targetList: this.runtime.targets
                .filter(
                    // Don't report clones.
                    target => !Object.prototype.hasOwnProperty.call(target, 'isOriginal') || target.isOriginal
                ).map(
                    target => target.toJSON()
                ),
            // Currently editing target id.
            editingTarget: this.editingTarget ? this.editingTarget.id : null
        });
        if (triggerProjectChange) {
            this.runtime.emitProjectChanged();
        }
    }

    /**
     * Emit an Blockly/scratch-blocks compatible XML representation
     * of the current editing target's blocks.
     */
    emitWorkspaceUpdate () {
        // Create a list of broadcast message Ids according to the stage variables
        const stageVariables = this.runtime.getTargetForStage().variables;
        let messageIds = [];
        for (const varId in stageVariables) {
            if (stageVariables[varId].type === Variable.BROADCAST_MESSAGE_TYPE) {
                messageIds.push(varId);
            }
        }
        // Go through all blocks on all targets, removing referenced
        // broadcast ids from the list.
        for (let i = 0; i < this.runtime.targets.length; i++) {
            const currTarget = this.runtime.targets[i];
            const currBlocks = currTarget.blocks._blocks;
            for (const blockId in currBlocks) {
                if (currBlocks[blockId].fields.BROADCAST_OPTION) {
                    const id = currBlocks[blockId].fields.BROADCAST_OPTION.id;
                    const index = messageIds.indexOf(id);
                    if (index !== -1) {
                        messageIds = messageIds.slice(0, index)
                            .concat(messageIds.slice(index + 1));
                    }
                }
            }
        }
        // Anything left in messageIds is not referenced by a block, so delete it.
        for (let i = 0; i < messageIds.length; i++) {
            const id = messageIds[i];
            delete this.runtime.getTargetForStage().variables[id];
        }
        const globalVarMap = Object.assign({}, this.runtime.getTargetForStage().variables);
        const localVarMap = this.editingTarget.isStage ?
            Object.create(null) :
            Object.assign({}, this.editingTarget.variables);

        const globalVariables = Object.keys(globalVarMap).map(k => globalVarMap[k]);
        const localVariables = Object.keys(localVarMap).map(k => localVarMap[k]);
        const workspaceComments = Object.keys(this.editingTarget.comments)
            .map(k => this.editingTarget.comments[k])
            .filter(c => c.blockId === null);

        const xmlString = `<xml xmlns="http://www.w3.org/1999/xhtml">
                            <variables>
                                ${globalVariables.map(v => v.toXML()).join()}
                                ${localVariables.map(v => v.toXML(true)).join()}
                            </variables>
                            ${workspaceComments.map(c => c.toXML()).join()}
                            ${this.editingTarget.blocks.toXML(this.editingTarget.comments)}
                        </xml>`;

        this.emit('workspaceUpdate', {xml: xmlString});
    }

    /**
     * Get a target id for a drawable id. Useful for interacting with the renderer
     * @param {int} drawableId The drawable id to request the target id for
     * @returns {?string} The target id, if found. Will also be null if the target found is the stage.
     */
    getTargetIdForDrawableId (drawableId) {
        const target = this.runtime.getTargetByDrawableId(drawableId);
        if (target &&
            Object.prototype.hasOwnProperty.call(target, 'id') &&
            Object.prototype.hasOwnProperty.call(target, 'isStage') &&
            !target.isStage) {
            return target.id;
        }
        return null;
    }

    /**
     * Reorder target by index. Return whether a change was made.
     * @param {!string} targetIndex Index of the target.
     * @param {!number} newIndex index that the target should be moved to.
     * @returns {boolean} Whether a target was reordered.
     */
    reorderTarget (targetIndex, newIndex) {
        let targets = this.runtime.targets;
        targetIndex = MathUtil.clamp(targetIndex, 0, targets.length - 1);
        newIndex = MathUtil.clamp(newIndex, 0, targets.length - 1);
        if (targetIndex === newIndex) return false;
        const target = targets[targetIndex];
        targets = targets.slice(0, targetIndex).concat(targets.slice(targetIndex + 1));
        targets.splice(newIndex, 0, target);
        this.runtime.targets = targets;
        this.emitTargetsUpdate();
        return true;
    }

    /**
     * Reorder the costumes of a target if it exists. Return whether it succeeded.
     * @param {!string} targetId ID of the target which owns the costumes.
     * @param {!number} costumeIndex index of the costume to move.
     * @param {!number} newIndex index that the costume should be moved to.
     * @returns {boolean} Whether a costume was reordered.
     */
    reorderCostume (targetId, costumeIndex, newIndex) {
        const target = this.runtime.getTargetById(targetId);
        if (target) {
            const reorderSuccessful = target.reorderCostume(costumeIndex, newIndex);
            if (reorderSuccessful) {
                this.runtime.emitProjectChanged();
            }
            return reorderSuccessful;
        }
        return false;
    }

    /**
     * Reorder the sounds of a target if it exists. Return whether it occured.
     * @param {!string} targetId ID of the target which owns the sounds.
     * @param {!number} soundIndex index of the sound to move.
     * @param {!number} newIndex index that the sound should be moved to.
     * @returns {boolean} Whether a sound was reordered.
     */
    reorderSound (targetId, soundIndex, newIndex) {
        const target = this.runtime.getTargetById(targetId);
        if (target) {
            const reorderSuccessful = target.reorderSound(soundIndex, newIndex);
            if (reorderSuccessful) {
                this.runtime.emitProjectChanged();
            }
            return reorderSuccessful;
        }
        return false;
    }

    /**
     * Put a target into a "drag" state, during which its X/Y positions will be unaffected
     * by blocks.
     * @param {string} targetId The id for the target to put into a drag state
     */
    startDrag (targetId) {
        const target = this.runtime.getTargetById(targetId);
        if (target) {
            this._dragTarget = target;
            target.startDrag();
        }
    }

    /**
     * Remove a target from a drag state, so blocks may begin affecting X/Y position again
     * @param {string} targetId The id for the target to remove from the drag state
     */
    stopDrag (targetId) {
        const target = this.runtime.getTargetById(targetId);
        if (target) {
            this._dragTarget = null;
            target.stopDrag();
            this.setEditingTarget(target.sprite && target.sprite.clones[0] ?
                target.sprite.clones[0].id : target.id);
        }
    }

    /**
     * Post/edit sprite info for the current editing target or the drag target.
     * @param {object} data An object with sprite info data to set.
     */
    postSpriteInfo (data) {
        if (this._dragTarget) {
            this._dragTarget.postSpriteInfo(data);
        } else {
            this.editingTarget.postSpriteInfo(data);
        }
        // Post sprite info means the gui has changed something about a sprite,
        // either through the sprite info pane fields (e.g. direction, size) or
        // through dragging a sprite on the stage
        // Emit a project changed event.
        this.runtime.emitProjectChanged();
    }

    /**
     * Set a target's variable's value. Return whether it succeeded.
     * @param {!string} targetId ID of the target which owns the variable.
     * @param {!string} variableId ID of the variable to set.
     * @param {!*} value The new value of that variable.
     * @returns {boolean} whether the target and variable were found and updated.
     */
    setVariableValue (targetId, variableId, value) {
        const target = this.runtime.getTargetById(targetId);
        if (target) {
            const variable = target.lookupVariableById(variableId);
            if (variable) {
                variable.value = value;

                if (variable.isCloud) {
                    this.runtime.ioDevices.cloud.requestUpdateVariable(variable.name, variable.value);
                }

                return true;
            }
        }
        return false;
    }

    /**
     * Get a target's variable's value. Return null if the target or variable does not exist.
     * @param {!string} targetId ID of the target which owns the variable.
     * @param {!string} variableId ID of the variable to set.
     * @returns {?*} The value of the variable, or null if it could not be looked up.
     */
    getVariableValue (targetId, variableId) {
        const target = this.runtime.getTargetById(targetId);
        if (target) {
            const variable = target.lookupVariableById(variableId);
            if (variable) {
                return variable.value;
            }
        }
        return null;
    }

    /**
     * Allow VM consumer to configure the ScratchLink socket creator.
     * @param {Function} factory The custom ScratchLink socket factory.
     */
    configureScratchLinkSocketFactory (factory) {
        this.runtime.configureScratchLinkSocketFactory(factory);
    }
}

module.exports = VirtualMachine;
