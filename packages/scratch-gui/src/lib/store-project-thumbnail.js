import log from './log';

export const storeProjectThumbnail = async (vm, callback) => {
    try {
        await getProjectThumbnail(vm, callback);
    } catch (e) {
        log.error('Project thumbnail save error', e);
        throw e; // re-throw so it is handled by alert
    }
};

export const getProjectThumbnail = (vm, callback) => new Promise((resolve, reject) => {
    vm.postIOData('video', {forceTransparentPreview: true});
    vm.renderer.requestSnapshot(async dataURI => {
        vm.postIOData('video', {forceTransparentPreview: false});
        try {
            await callback(dataURI);
            resolve();
        } catch (e) {
            reject(e instanceof Error ? e : new Error(String(e)));
        }
    });
    vm.renderer.draw();
});
