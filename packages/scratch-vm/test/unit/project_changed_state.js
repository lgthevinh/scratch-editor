const tap = require('tap');
const path = require('path');
const readFileToBuffer = require('../fixtures/readProjectFile').readFileToBuffer;
const makeTestStorage = require('../fixtures/make-test-storage');
const VirtualMachine = require('../../src/virtual-machine');

let vm;
let projectChanged;

tap.beforeEach(() => {
    const projectUri = path.resolve(__dirname, '../fixtures/default.sb2');
    const project = readFileToBuffer(projectUri);

    vm = new VirtualMachine();

    vm.runtime.addListener('PROJECT_CHANGED', () => {
        projectChanged = true;
    });

    vm.attachStorage(makeTestStorage());
    return vm.loadProject(project).then(() => {
        // The test in project_load_changed_state.js tests
        // that loading a project does not emit a project changed
        // event. This setup tries to be agnostic of whether that
        // test is passing or failing.
        projectChanged = false;
    });
});

const test = tap.test;

test('Adding a sprite (from sprite2) should emit a project changed event', t => {
    const sprite2Uri = path.resolve(__dirname, '../fixtures/cat.sprite2');
    const sprite2 = readFileToBuffer(sprite2Uri);

    vm.addSprite(sprite2).then(() => {
        t.equal(projectChanged, true);
        t.end();
    });
});

test('Adding a sprite (from sprite3) should emit a project changed event', t => {
    const sprite3Uri = path.resolve(__dirname, '../fixtures/cat.sprite3');
    const sprite3 = readFileToBuffer(sprite3Uri);

    vm.addSprite(sprite3).then(() => {
        t.equal(projectChanged, true);
        t.end();
    });
});

test('Adding a sound should emit a project changed event', t => {
    const newSound = {
        soundName: 'meow',
        soundID: 0,
        md5: '83c36d806dc92327b9e7049a565c6bff.wav',
        sampleCount: 18688,
        rate: 22050
    };

    vm.addSound(newSound).then(() => {
        t.equal(projectChanged, true);
        t.end();
    });
});

test('Deleting a sprite should emit a project changed event', t => {
    const spriteId = vm.editingTarget.id;

    vm.deleteSprite(spriteId);
    t.equal(projectChanged, true);
    t.end();
});

test('Deleting a sound should emit a project changed event', t => {
    vm.deleteSound(0);

    t.equal(projectChanged, true);
    t.end();
});

test('Renaming a sprite should emit a project changed event', t => {
    const spriteId = vm.editingTarget.id;
    vm.renameSprite(spriteId, 'My Sprite');
    t.equal(projectChanged, true);
    t.end();
});

test('Renaming a sound should emit a project changed event', t => {
    vm.renameSound(0, 'My Sound');

    t.equal(projectChanged, true);
    t.end();
});

test('Editing a sound should emit a project changed event', t => {
    const mockSoundBuffer = [];
    const mockSoundEncoding = [];

    vm.updateSoundBuffer(0, mockSoundBuffer, mockSoundEncoding);
    t.equal(projectChanged, true);
    t.end();
});
