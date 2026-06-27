# @thingblock/thingblock-resource

ThingEdu's **Scratch-plane resource pack**: device manifests, peripheral packs (some hidden and
activated by device selection), Arduino codegen, toolbox categories, and vendored C++ library sources, authored as one
versioned package and built to **dynamically-importable ESM**. The local helper (`thingblock-link`)
serves the built packs as static files; the editor `import()`s them at runtime and registers each
pack's codegen against the editor's shared `arduinoGenerator` singleton.

Design context: `scratch-editor/.agents/docs/25-06_01.blockly-arduino-codegen.md` (the codegen
contract this pack registers against) and `25-06_02.resource-distribution.md` (the distribution model:
helper serves packs, editor imports them).

## The one rule: inject, never bundle

Pack modules bind to the editor's **live** Blockly and `arduinoGenerator` by injection, so the build
externalizes `blockly` and `@scratch/scratch-blocks` (they are build/type-time only). A pack that
bundled its own copy would get a different singleton and its registrations would be invisible.

```text
// blocks.js
export const registerBlocks = (Blockly) => { Blockly.Blocks.servo_setangle = { init() { ... } } }
// generator.js
export const registerGenerators = (generator, Order) => { generator.forBlock.servo_setangle = ... }
```

## Layout

Source mirrors scratch-vm's `extensions/<group>/<pack>` layout:

```
src/
  shared/types.ts                       the pack contract (manifest + register* signatures)
  extensions/
    peripheral/servo/                   worked peripheral: manifest, blocks, generator, toolbox, libs/
    peripheral/ps2/                     PS2 controller blocks, codegen, icon, and vendored PS2X library
    peripheral/thingbot-core/           ThingBot's hidden peripheral: its blocks, generator, toolbox
    devices/thingbot/                   worked device: ESP32-C3 manifest + icon
```

The build wraps everything under one served root that preserves that layout:

```
dist/thingblock-resource/extensions/
  index.json                          pack enumerator the editor fetches first
  peripheral/servo/{manifest,blocks,generator,toolbox}.js + libs/Servo/…
  peripheral/ps2/{manifest,blocks,generator,toolbox}.js + icon.png + libs/PS2X_lib/…
  peripheral/thingbot-core/{manifest,blocks,generator,toolbox}.js
  devices/thingbot/manifest.js + icon.svg
```

Modules compile to ESM; `libs/` and icons are copied verbatim. The build also writes
`extensions/index.json` (`{packs:[{kind,path}]}`) because the helper's `ServeDir` serves files, not
directory listings — the editor reads it to learn which packs exist before importing them. The helper
roots its `/resources` route at this pack directory, so the served path is
`/resources/extensions/<group>/<pack>/…` (the pack name is the root, not a path segment). The build also writes a versioned archive
of the pack, `dist/thingblock-resource_v<major>.<minor>.zip` (e.g. `thingblock-resource_v0.1.zip`), for
distribution to the helper.

## Commands

```sh
npm run build --workspace=packages/thingblock-resource     # typecheck + Vite build + copy assets + zip
npm test  --workspace=packages/thingblock-resource          # lint + Vitest
THINGBLOCK_RESOURCE_ROOT=<helper-resource-dir> \
  npm run deploy --workspace=packages/thingblock-resource    # copy the pack folder into the helper
```

## Adding a pack

1. Create `src/extensions/peripheral/<id>/` (or `src/extensions/devices/<id>/`) with a `manifest.ts`.
2. For a device, add the board `icon.svg`. Device-exclusive blocks live in their own peripheral pack
   published with `hidden: true` (so the peripheral library skips it); the device activates it — and any
   reusable peripherals — by listing their ids in `extensions: ['<id>', …]` (the device's own pack
   first, since order is the palette order).
3. For a peripheral, add only the surfaces it needs: `blocks.ts`, `generator.ts`, and `toolbox.ts` are
   optional; vendored `libs/` sources can exist without a toolbox. A non-hidden peripheral may add an
   `icon` (`./icon.svg`) and a localized `description` for its library card. Set `hidden: true` for a
   pack that should be reachable only through a device reference (it never appears in the library).
4. The build discovers it automatically (no entry list to maintain).

> Two libs categories: published Arduino libraries go in `registryLibs` (the helper installs them via
> arduino-cli); un-published, extension-vendored source goes under `libs/` and is referenced by
> `libs:[{path}]` (as the bundled Servo peripheral does).
