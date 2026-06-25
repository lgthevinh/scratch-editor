/**
 * Holds the loaded hidden device extensions and tracks which one is active for the selected device.
 *
 * A device extension's block definitions and Arduino codegen are registered once (on the shared
 * `scratch-blocks` singleton) and persist; this registry adds the data the GUI and compiler still need
 * per selection: the active extension's toolbox categories (board-mode palette) and its vendored libs
 * (compile-time `#include` resolution). Selecting a device sets exactly one extension active; selecting
 * a board without one — or none at all — leaves the active extension cleared.
 */
class DeviceExtensionRegistry {
    constructor () {
        /** @type {Map<string, object>} loaded extension records, keyed by extension id. */
        this._byId = new Map();
        /** @type {?string} the active extension id, or null when no device extension is selected. */
        this._activeId = null;
    }

    /**
     * @param {string} id - an extension id.
     * @returns {boolean} whether that extension has already been loaded and registered.
     */
    has (id) {
        return this._byId.has(id);
    }

    /**
     * Store a loaded extension. Idempotent on the extension id.
     * @param {object} record - `{deviceId, id, toolbox, libs, base}`.
     * @returns {object} the stored record.
     */
    register (record) {
        this._byId.set(record.id, record);
        return record;
    }

    /**
     * @param {string} id - the extension id to mark active.
     * @returns {void}
     */
    setActive (id) {
        this._activeId = id;
    }

    /**
     * Clear the active extension (e.g. when a device without a hidden extension is selected).
     * @returns {void}
     */
    clearActive () {
        this._activeId = null;
    }

    /**
     * @returns {?object} the active extension record, or null when none is active.
     */
    get active () {
        return this._activeId === null ? null : (this._byId.get(this._activeId) || null);
    }

    /**
     * The active device extension's toolbox categories, for the board-mode palette.
     * @returns {Array.<object>} one toolbox category, or empty when no extension is active.
     */
    getActiveDeviceToolboxCategories () {
        const active = this.active;
        return active && active.toolbox ? [active.toolbox] : [];
    }

    /**
     * The active device extension's vendored libs, for compile-time include resolution.
     * @returns {Array.<object>} the lib refs, or empty when no extension is active.
     */
    getActiveDeviceLibs () {
        const active = this.active;
        return active ? (active.libs || []) : [];
    }
}

module.exports = DeviceExtensionRegistry;
