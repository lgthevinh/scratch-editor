import log from './log';

export const storeProjectThumbnail = async (vm, callback) => {
    try {
        const dataURI = await getProjectThumbnail(vm);
        if (callback) {
            await callback(dataURI);
        }
    } catch (e) {
        log.error('Project thumbnail save error', e);
        throw e; // re-throw so it can be handled elsewhere
    }
};

export const getProjectThumbnail = async vm => {
    vm.postIOData('video', {forceTransparentPreview: true});
    try {
        const dataURI = await new Promise((resolve, reject) => {
            try {
                vm.renderer.requestSnapshot(resolve);
                vm.renderer.draw();
            } catch (e) {
                reject(e);
            }
        });
        return dataURI;
    } finally {
        vm.postIOData('video', {forceTransparentPreview: false});
    }
};
