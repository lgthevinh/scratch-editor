const formatMessage = require('format-message');

const Runtime = require('../engine/runtime');
const log = require('../util/log');
const {DeviceRegistry, PeripheralRegistry, ManifestDevice} = require('../devices');
const {boards} = require('../extensions/devices');

/**
 * The board-mode device subsystem owned by the VM: the device registry, helper-served resource packs,
 * and the selected board's active peripherals. The VM exposes its public surface through delegators
 * and exposes `deviceRegistry`/`peripheralRegistry` through getters. Cross-subsystem state (the
 * runtime, the active link client, VM event emission) is reached through the `vm` back-reference.
 */
module.exports = class DeviceManager {
    /**
     * @param {VirtualMachine} vm - the owning VM, used to reach the runtime, the active link client,
     *   and the VM event emitter.
     */
    constructor (vm) {
        this.vm = vm;

        /**
         * Registry of upload-mode devices, keyed by deviceId. Drives the GUI device-selection list.
         * @type {DeviceRegistry}
         */
        this.deviceRegistry = new DeviceRegistry();
        this._deviceManifestsById = new Map();
        for (const board of boards) {
            const device = this.deviceRegistry.register(new board.Device(this.vm.runtime));
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
        if (this.vm.client !== this.vm.linkClient) return null;
        const httpBase = this.vm.linkClient.url.replace(/^ws/, 'http').replace(/\/$/, '');
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
        const device = this.deviceRegistry.register(new ManifestDevice(this.vm.runtime, manifest));
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
        this.vm.emit(Runtime.RESOURCE_PACKS_LOADED);

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
        this.vm.emit(Runtime.PERIPHERALS_CHANGED);
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
        this.vm.emit(Runtime.PERIPHERALS_CHANGED);
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
        this.vm.runtime.board = this._selectedDeviceId ?
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
        this.vm.emit(Runtime.BOARD_RESTORED, {
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
};
