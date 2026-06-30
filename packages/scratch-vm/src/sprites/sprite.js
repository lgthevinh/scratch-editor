const RenderedTarget = require('./rendered-target');
const Blocks = require('../engine/blocks');
const {loadSoundFromAsset} = require('../import/load-sound');
const newBlockIds = require('../util/new-block-ids');
const StringUtil = require('../util/string-util');

class Sprite {
    /**
     * Sprite to be used on the Scratch stage.
     * All clones of a sprite have shared blocks, shared variables, shared sounds, etc.
     * @param {?Blocks} blocks Shared blocks object for all clones of sprite.
     * @param {Runtime} runtime Reference to the runtime.
     * @class
     */
    constructor (blocks, runtime) {
        this.runtime = runtime;
        if (!blocks) {
            // Shared set of blocks for all clones.
            blocks = new Blocks(runtime);
        }
        this.blocks = blocks;
        /**
         * Human-readable name for this sprite (and all clones).
         * @type {string}
         */
        this.name = '';
        /**
         * List of sounds for this sprite.
         */
        this.sounds = [];
        /**
         * List of clones for this sprite, including the original.
         * @type {Array.<!RenderedTarget>}
         */
        this.clones = [];

        this.soundBank = null;
        if (this.runtime && this.runtime.audioEngine) {
            this.soundBank = this.runtime.audioEngine.createBank();
        }
    }

    /**
     * Create a clone of this sprite.
     * @returns {!RenderedTarget} Newly created clone.
     */
    createClone () {
        const newClone = new RenderedTarget(this, this.runtime);
        newClone.isOriginal = this.clones.length === 0;
        this.clones.push(newClone);
        newClone.initAudio();
        if (newClone.isOriginal) {
            this.runtime.fireTargetWasCreated(newClone);
        } else {
            this.runtime.fireTargetWasCreated(newClone, this.clones[0]);
        }
        return newClone;
    }

    /**
     * Disconnect a clone from this sprite. The clone is unmodified.
     * In particular, the clone's dispose() method is not called.
     * @param {!RenderedTarget} clone - the clone to be removed.
     */
    removeClone (clone) {
        this.runtime.fireTargetWasRemoved(clone);
        const cloneIndex = this.clones.indexOf(clone);
        if (cloneIndex >= 0) {
            this.clones.splice(cloneIndex, 1);
        }
    }

    duplicate () {
        const newSprite = new Sprite(null, this.runtime);
        const blocksContainer = this.blocks._blocks;
        const originalBlocks = Object.keys(blocksContainer).map(key => blocksContainer[key]);
        const copiedBlocks = JSON.parse(JSON.stringify(originalBlocks));
        newBlockIds(copiedBlocks);
        copiedBlocks.forEach(block => {
            newSprite.blocks.createBlock(block);
        });

        const allNames = this.runtime.targets.map(t => t.sprite.name);
        newSprite.name = StringUtil.unusedName(this.name, allNames);

        const assetPromises = [];

        newSprite.sounds = this.sounds.map(sound => {
            const newSound = Object.assign({}, sound);
            const soundAsset = sound.asset;
            assetPromises.push(loadSoundFromAsset(newSound, soundAsset, this.runtime, newSprite.soundBank));
            return newSound;
        });

        return Promise.all(assetPromises).then(() => newSprite);
    }

    dispose () {
        if (this.soundBank) {
            this.soundBank.dispose();
        }
    }
}

module.exports = Sprite;
