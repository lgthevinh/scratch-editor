const StringUtil = require('../util/string-util');
const Target = require('../engine/target');

/**
 * Rendered target: instance of a sprite (clone), or the stage.
 */
class RenderedTarget extends Target {
    /**
     * @param {!Sprite} sprite Reference to the parent sprite.
     * @param {Runtime} runtime Reference to the runtime.
     * @class
     */
    constructor (sprite, runtime) {
        super(runtime, sprite.blocks);

        /**
         * Reference to the sprite that this is a render of.
         * @type {!Sprite}
         */
        this.sprite = sprite;

        /**
         * Whether this represents an "original" non-clone rendered-target for a sprite,
         * i.e., created by the editor and not clone blocks.
         * @type {boolean}
         */
        this.isOriginal = true;

        /**
         * Whether this rendered target represents the Scratch stage.
         * @type {boolean}
         */
        this.isStage = false;

        /**
         * Loudness for sound playback for this target, as a percentage.
         * @type {number}
         */
        this.volume = 100;

        /**
         * Current tempo (used by the music extension).
         * This property is global to the project and stored in the stage.
         * @type {number}
         */
        this.tempo = 60;

        /**
         * The language to use for speech synthesis, in the text2speech extension.
         * It is initialized to null so that on extension load, we can check for
         * this and try setting it using the editor locale.
         * @type {string}
         */
        this.textToSpeechLanguage = null;
    }

    get audioPlayer () {
        /* eslint-disable no-console */
        console.warn('get audioPlayer deprecated, please update to use .sprite.soundBank methods');
        console.warn(new Error('stack for debug').stack);
        /* eslint-enable no-console */
        const bank = this.sprite.soundBank;
        const audioPlayerProxy = {
            playSound: soundId => bank.play(this, soundId)
        };

        Object.defineProperty(this, 'audioPlayer', {
            configurable: false,
            enumerable: true,
            writable: false,
            value: audioPlayerProxy
        });

        return audioPlayerProxy;
    }

    /**
     * Initialize the audio player for this sprite or clone.
     */
    initAudio () {
    }

    /**
     * Add a sound, taking care to avoid duplicate names.
     * @param {!object} soundObject Object representing the sound.
     * @param {?int} index Index at which to add the sound
     */
    addSound (soundObject, index) {
        const usedNames = this.sprite.sounds.map(sound => sound.name);
        soundObject.name = StringUtil.unusedName(soundObject.name, usedNames);
        if (typeof index === 'number' && !isNaN(index)) {
            this.sprite.sounds.splice(index, 0, soundObject);
        } else {
            this.sprite.sounds.push(soundObject);
        }
    }

    /**
     * Rename a sound, taking care to avoid duplicate names.
     * @param {int} soundIndex - the index of the sound to be renamed.
     * @param {string} newName - the desired new name of the sound (will be modified if already in use).
     */
    renameSound (soundIndex, newName) {
        const usedNames = this.sprite.sounds
            .filter((sound, index) => soundIndex !== index)
            .map(sound => sound.name);
        const oldName = this.sprite.sounds[soundIndex].name;
        const newUnusedName = StringUtil.unusedName(newName, usedNames);
        this.sprite.sounds[soundIndex].name = newUnusedName;
        this.blocks.updateAssetName(oldName, newUnusedName, 'sound');
    }

    /**
     * Delete a sound by index.
     * @param {number} index Sound index to be deleted
     * @returns {object} The deleted sound object, or null if no sound was deleted.
     */
    deleteSound (index) {
        // Make sure the sound index is not out of bounds
        if (index < 0 || index >= this.sprite.sounds.length) {
            return null;
        }
        // Delete the sound at the given index
        const deletedSound = this.sprite.sounds.splice(index, 1)[0];
        this.runtime.requestTargetsUpdate(this);
        return deletedSound;
    }

    /**
     * Get full sound list
     * @returns {object[]} list of sounds
     */
    getSounds () {
        return this.sprite.sounds;
    }

    /**
     * Return the human-readable name for this rendered target, e.g., the sprite's name.
     * @override
     * @returns {string} Human-readable name.
     */
    getName () {
        return this.sprite.name;
    }

    /**
     * Return whether this rendered target is a sprite (not a clone, not the stage).
     * @returns {boolean} True if not a clone and not the stage.
     */
    isSprite () {
        return !this.isStage && this.isOriginal;
    }

    /**
     * Make a duplicate using a duplicate sprite.
     * @returns {RenderedTarget} New clone.
     */
    duplicate () {
        return this.sprite.duplicate().then(newSprite => {
            const newTarget = newSprite.createClone();
            newTarget.variables = this.duplicateVariables(newTarget.blocks);
            return newTarget;
        });
    }

    /**
     * Serialize sprite info, used when emitting events about the sprite
     * @returns {object} Sprite data as a simple object
     */
    toJSON () {
        return {
            id: this.id,
            name: this.getName(),
            isStage: this.isStage,
            comments: this.comments,
            blocks: this.blocks._blocks,
            variables: this.variables,
            sounds: this.getSounds(),
            textToSpeechLanguage: this.textToSpeechLanguage,
            tempo: this.tempo,
            volume: this.volume
        };
    }

    /**
     * Dispose, destroying any run-time properties.
     */
    dispose () {
        this.runtime.changeCloneCounter(-1);
        this.runtime.stopForTarget(this);
        this.runtime.removeExecutable(this);
        this.sprite.removeClone(this);
    }
}

module.exports = RenderedTarget;
