const test = require('tap').test;

const Blocks = require('../../src/engine/blocks');
const {loadSound} = require('../../src/import/load-sound');
const makeTestStorage = require('../fixtures/make-test-storage');
const Runtime = require('../../src/engine/runtime');
const sb3 = require('../../src/serialization/sb3');
const Sprite = require('../../src/sprites/sprite');

const defaultSoundInfo = {
};

test('sb3-roundtrip', t => {
    const runtime1 = new Runtime();
    runtime1.attachStorage(makeTestStorage());

    const runtime2 = new Runtime();
    runtime2.attachStorage(makeTestStorage());

    const testRuntimeState = (label, runtime) => {
        t.equal(runtime.targets.length, 2, `${label}: target count`);
        const [stageClone, spriteClone] = runtime.targets;

        t.equal(stageClone.isOriginal, true);
        t.equal(stageClone.isStage, true);

        const stage = stageClone.sprite;
        t.equal(stage.name, 'Stage');
        t.equal(stage.clones.length, 1);
        t.equal(stage.clones[0], stageClone);

        t.equal(stage.sounds.length, 0);

        t.equal(spriteClone.isOriginal, true);
        t.equal(spriteClone.isStage, false);

        const sprite = spriteClone.sprite;
        t.equal(sprite.name, 'Sprite');
        t.equal(sprite.clones.length, 1);
        t.equal(sprite.clones[0], spriteClone);

        t.equal(sprite.sounds.length, 1);
        const [meow] = sprite.sounds;
        t.equal(meow.md5, '83c36d806dc92327b9e7049a565c6bff.wav');
    };

    const loadThings = Promise.all([
        loadSound(Object.assign({md5: '83c36d806dc92327b9e7049a565c6bff.wav'}, defaultSoundInfo), runtime1)
    ]);

    const installThings = loadThings.then(results => {
        const [meow] = results;

        const stageBlocks = new Blocks(runtime1);
        const stage = new Sprite(stageBlocks, runtime1);
        stage.name = 'Stage';
        stage.sounds = [];
        const stageClone = stage.createClone();
        stageClone.isStage = true;

        const spriteBlocks = new Blocks(runtime1);
        const sprite = new Sprite(spriteBlocks, runtime1);
        sprite.name = 'Sprite';
        sprite.sounds = [meow];
        const spriteClone = sprite.createClone();

        runtime1.targets = [stageClone, spriteClone];

        testRuntimeState('original', runtime1);
    });

    const serializeAndDeserialize = installThings.then(() => {
        // Doing a JSON `stringify` and `parse` here more accurately simulate a save/load cycle. In particular:
        // 1. it ensures that any non-serializable data is thrown away, and
        // 2. `sb3.deserialize` and its helpers do some `hasOwnProperty` checks which fail on the object returned by
        //    `sb3.serialize` but succeed if that object is "flattened" in this way.
        const serializedState = JSON.parse(JSON.stringify(sb3.serialize(runtime1)));
        return sb3.deserialize(serializedState, runtime2);
    });

    return serializeAndDeserialize.then(({targets}) => {
        runtime2.targets = targets;
        testRuntimeState('copy', runtime2);
    });
});
