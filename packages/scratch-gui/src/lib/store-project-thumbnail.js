import log from './log';

export const storeProjectThumbnail = async (vm, callback) => {
    try {
        await getProjectThumbnail(vm, callback);
    } catch (e) {
        log.error('Project thumbnail save error', e);
        throw e;
    }
};

export const getProjectThumbnail = (vm, callback) => new Promise((resolve, reject) => {
    vm.postIOData('video', {forceTransparentPreview: true});
    vm.renderer.requestSnapshot(dataURI => {
        vm.postIOData('video', {forceTransparentPreview: false});
        const result = callback(dataURI);
        result
            .then(() => {
                resolve();
            })
            .catch(e => {
                reject(e instanceof Error ? e : new Error(String(e)));
            });
    });
    vm.renderer.draw();
});
