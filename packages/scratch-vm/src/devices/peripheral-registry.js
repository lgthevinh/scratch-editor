/**
 * Holds the activated resource-pack peripherals and which are active for the selected device.
 *
 * A "peripheral" here is a reusable component/library pack (e.g. a servo) a device declares via a
 * `{kind:'peripheral', id}` ref — **not** the VM's existing BLE/Scratch-Link "peripheral" (a connected
 * device like a micro:bit). A pack contributes optional toolbox categories and vendored libs; its
 * blocks/codegen are registered once on the shared `scratch-blocks` singleton and persist. Selecting a
 * device activates the peripherals it references; deselecting clears the active set.
 */
class PeripheralRegistry {
    constructor () {
        /** @type {Map<string, object>} activated peripheral records, keyed by id. */
        this._byId = new Map();
        /** @type {Set<string>} ids of the peripherals active for the current device. */
        this._activeIds = new Set();
    }

    /**
     * @param {string} id - a peripheral id.
     * @returns {boolean} whether that peripheral has already been activated (blocks/codegen registered).
     */
    has (id) {
        return this._byId.has(id);
    }

    /**
     * Store an activated peripheral. Idempotent on the peripheral id.
     * @param {object} record - `{id, toolbox, libs, base}`.
     * @returns {object} the stored record.
     */
    register (record) {
        this._byId.set(record.id, record);
        return record;
    }

    /**
     * @param {string} id - the peripheral id to mark active.
     * @returns {void}
     */
    setActive (id) {
        this._activeIds.add(id);
    }

    /**
     * Clear the active set (e.g. when the device changes).
     * @returns {void}
     */
    clearActive () {
        this._activeIds.clear();
    }

    /**
     * @returns {Array.<object>} the active peripheral records.
     */
    get activeRecords () {
        const records = [];
        for (const id of this._activeIds) {
            const record = this._byId.get(id);
            if (record) records.push(record);
        }
        return records;
    }

    /**
     * The active peripherals' toolbox categories (only those that ship one), for the board-mode palette.
     * @returns {Array.<object>} toolbox category descriptors.
     */
    getActivePeripheralToolboxCategories () {
        return this.activeRecords.filter(record => record.toolbox).map(record => record.toolbox);
    }

    /**
     * The active peripherals' vendored libs, for compile-time include resolution.
     * @returns {Array.<object>} lib refs across all active peripherals.
     */
    getActivePeripheralLibs () {
        const libs = [];
        for (const record of this.activeRecords) {
            libs.push(...(record.libs || []));
        }
        return libs;
    }
}

module.exports = PeripheralRegistry;
