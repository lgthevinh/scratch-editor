let _TextEncoder;
if (typeof TextEncoder === 'undefined') {
    _TextEncoder = require('text-encoding').TextEncoder;
} else {
    _TextEncoder = TextEncoder;
}
const Buffer = require('buffer').Buffer;
const log = require('../../util/log');
const StringUtil = require('../../util/string-util');
const {loadCostume} = require('../../import/load-costume.js');
const {loadSound} = require('../../import/load-sound.js');
require('canvas-toBlob');

const RESERVED_NAMES = ['_mouse_', '_stage_', '_edge_', '_myself_', '_random_'];

module.exports = class AssetsMixin {
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

        const sb2 = require('../../serialization/sb2');
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
        const sb3 = require('../../serialization/sb3');
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

};
