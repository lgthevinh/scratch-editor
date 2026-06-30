const test = require('tap').test;
const RenderedTarget = require('../../src/sprites/rendered-target');
const Sprite = require('../../src/sprites/sprite');
const Runtime = require('../../src/engine/runtime');
const FakeRenderer = require('../fixtures/fake-renderer');

test('blocks get new id on duplicate', t => {
    const r = new Runtime();
    const s = new Sprite(null, r);
    const rt = new RenderedTarget(s, r);
    const block = {
        id: 'id1',
        topLevel: true,
        fields: {}
    };

    rt.blocks.createBlock(block);

    return rt.duplicate().then(duplicate => {
        t.notOk(Object.prototype.hasOwnProperty.call(duplicate.blocks._blocks, block.id));
        t.end();
    });
});

test('deleteSound', t => {
    const o1 = {id: 1};
    const o2 = {id: 2};
    const o3 = {id: 3};

    const r = new Runtime();
    const s = new Sprite(null, r);
    s.sounds = [o1, o2, o3];
    const a = new RenderedTarget(s, r);
    const renderer = new FakeRenderer();
    a.renderer = renderer;

    const firstDeleted = a.deleteSound(0);
    t.same(a.sprite.sounds, [o2, o3]);
    t.same(firstDeleted, o1);

    // Allows deleting the only sound
    a.sprite.sounds = [o1];
    a.deleteSound(0);
    t.same(a.sprite.sounds, []);

    t.end();
});

test('#getSounds returns the sounds', t => {
    const r = new Runtime();
    const spr = new Sprite(null, r);
    const a = new RenderedTarget(spr, r);
    const sounds = [1, 2, 3];
    a.sprite.sounds = sounds;
    t.equal(a.getSounds(), sounds);
    t.end();
});

test('#toJSON returns the sounds', t => {
    const r = new Runtime();
    const spr = new Sprite(null, r);
    const a = new RenderedTarget(spr, r);
    const sounds = [1, 2, 3];
    a.sprite.sounds = sounds;
    t.same(a.toJSON().sounds, sounds);
    t.end();
});

test('#addSound does not duplicate names', t => {
    const r = new Runtime();
    const spr = new Sprite(null, r);
    const a = new RenderedTarget(spr, r);
    a.sprite.sounds = [{name: 'first'}];
    a.addSound({name: 'first'});
    t.same(a.sprite.sounds, [{name: 'first'}, {name: 'first2'}]);
    t.end();
});

test('#renameSound does not duplicate names', t => {
    const r = new Runtime();
    const spr = new Sprite(null, r);
    const a = new RenderedTarget(spr, r);
    a.sprite.sounds = [{name: 'first'}, {name: 'second'}];
    a.renameSound(0, 'first'); // Shouldn't increment the name, noop
    t.same(a.sprite.sounds, [{name: 'first'}, {name: 'second'}]);
    a.renameSound(1, 'first');
    t.same(a.sprite.sounds, [{name: 'first'}, {name: 'first2'}]);
    t.end();
});
