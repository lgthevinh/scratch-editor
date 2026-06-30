const Runtime = require('../engine/runtime');

/**
 * Forward the runtime's events out through the VM, so VM consumers can subscribe to a single emitter.
 * Most events are passed straight along; a few drive VM-side updates (targets, workspace, toolbox).
 * @param {VirtualMachine} vm - the VM whose runtime to wire and whose emitter to forward through.
 * @returns {void}
 */
const wireRuntimeEvents = vm => {
    // Runtime emits are passed along as VM emits.
    vm.runtime.on(Runtime.SCRIPT_GLOW_ON, glowData => {
        vm.emit(Runtime.SCRIPT_GLOW_ON, glowData);
    });
    vm.runtime.on(Runtime.SCRIPT_GLOW_OFF, glowData => {
        vm.emit(Runtime.SCRIPT_GLOW_OFF, glowData);
    });
    vm.runtime.on(Runtime.BLOCK_GLOW_ON, glowData => {
        vm.emit(Runtime.BLOCK_GLOW_ON, glowData);
    });
    vm.runtime.on(Runtime.BLOCK_GLOW_OFF, glowData => {
        vm.emit(Runtime.BLOCK_GLOW_OFF, glowData);
    });
    vm.runtime.on(Runtime.PROJECT_START, () => {
        vm.emit(Runtime.PROJECT_START);
    });
    vm.runtime.on(Runtime.PROJECT_RUN_START, () => {
        vm.emit(Runtime.PROJECT_RUN_START);
    });
    vm.runtime.on(Runtime.PROJECT_RUN_STOP, () => {
        vm.emit(Runtime.PROJECT_RUN_STOP);
    });
    vm.runtime.on(Runtime.PROJECT_CHANGED, () => {
        vm.emit(Runtime.PROJECT_CHANGED);
    });
    vm.runtime.on(Runtime.VISUAL_REPORT, visualReport => {
        vm.emit(Runtime.VISUAL_REPORT, visualReport);
    });
    vm.runtime.on(Runtime.TARGETS_UPDATE, emitProjectChanged => {
        vm.emitTargetsUpdate(emitProjectChanged);
    });
    vm.runtime.on(Runtime.MONITORS_UPDATE, monitorList => {
        vm.emit(Runtime.MONITORS_UPDATE, monitorList);
    });
    vm.runtime.on(Runtime.BLOCK_DRAG_UPDATE, areBlocksOverGui => {
        vm.emit(Runtime.BLOCK_DRAG_UPDATE, areBlocksOverGui);
    });
    vm.runtime.on(Runtime.BLOCK_DRAG_END, (blocks, topBlockId) => {
        vm.emit(Runtime.BLOCK_DRAG_END, blocks, topBlockId);
    });
    vm.runtime.on(Runtime.EXTENSION_ADDED, categoryInfo => {
        vm.emit(Runtime.EXTENSION_ADDED, categoryInfo);
    });
    vm.runtime.on(Runtime.EXTENSION_FIELD_ADDED, (fieldName, fieldImplementation) => {
        vm.emit(Runtime.EXTENSION_FIELD_ADDED, fieldName, fieldImplementation);
    });
    vm.runtime.on(Runtime.BLOCKSINFO_UPDATE, categoryInfo => {
        vm.emit(Runtime.BLOCKSINFO_UPDATE, categoryInfo);
    });
    vm.runtime.on(Runtime.BLOCKS_NEED_UPDATE, () => {
        vm.emitWorkspaceUpdate();
    });
    vm.runtime.on(Runtime.TOOLBOX_EXTENSIONS_NEED_UPDATE, () => {
        vm.extensionManager.refreshBlocks();
    });
    vm.runtime.on(Runtime.PERIPHERAL_LIST_UPDATE, info => {
        vm.emit(Runtime.PERIPHERAL_LIST_UPDATE, info);
    });
    vm.runtime.on(Runtime.USER_PICKED_PERIPHERAL, info => {
        vm.emit(Runtime.USER_PICKED_PERIPHERAL, info);
    });
    vm.runtime.on(Runtime.PERIPHERAL_CONNECTED, () =>
        vm.emit(Runtime.PERIPHERAL_CONNECTED)
    );
    vm.runtime.on(Runtime.PERIPHERAL_REQUEST_ERROR, () =>
        vm.emit(Runtime.PERIPHERAL_REQUEST_ERROR)
    );
    vm.runtime.on(Runtime.PERIPHERAL_DISCONNECTED, () =>
        vm.emit(Runtime.PERIPHERAL_DISCONNECTED)
    );
    vm.runtime.on(Runtime.PERIPHERAL_CONNECTION_LOST_ERROR, data =>
        vm.emit(Runtime.PERIPHERAL_CONNECTION_LOST_ERROR, data)
    );
    vm.runtime.on(Runtime.PERIPHERAL_SCAN_TIMEOUT, () =>
        vm.emit(Runtime.PERIPHERAL_SCAN_TIMEOUT)
    );
    vm.runtime.on(Runtime.MIC_LISTENING, listening => {
        vm.emit(Runtime.MIC_LISTENING, listening);
    });
    vm.runtime.on(Runtime.EXTENSION_DATA_LOADING, loading => {
        vm.emit(Runtime.EXTENSION_DATA_LOADING, loading);
    });
    vm.runtime.on(Runtime.RUNTIME_STARTED, () => {
        vm.emit(Runtime.RUNTIME_STARTED);
    });
    vm.runtime.on(Runtime.HAS_CLOUD_DATA_UPDATE, hasCloudData => {
        vm.emit(Runtime.HAS_CLOUD_DATA_UPDATE, hasCloudData);
    });
    vm.runtime.on(Runtime.DEVICE_CONNECTED, () =>
        vm.emit(Runtime.DEVICE_CONNECTED)
    );
    vm.runtime.on(Runtime.DEVICE_DISCONNECTED, () =>
        vm.emit(Runtime.DEVICE_DISCONNECTED)
    );
};

module.exports = wireRuntimeEvents;
