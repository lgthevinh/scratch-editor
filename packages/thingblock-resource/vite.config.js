import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig } from 'vite'

// The whole pack is served under one named root that mirrors scratch-vm's `extensions/<group>/<pack>`
// layout. Raw assets (libs/, icons) are copied separately by scripts/copy-assets.mjs.
const PACK_ROOT = 'thingblock-resource'
const EXTENSIONS_DIR = join('src', 'extensions')
const PACK_GROUPS = ['devices', 'peripheral']
const ENTRY_MODULES = ['manifest', 'blocks', 'generator', 'toolbox']

/**
 * Discover each pack under src/extensions/{devices,peripheral}/<id>/ and map its present entry modules
 * to an output key under the served layout `thingblock-resource/extensions/<group>/<id>/<module>.js`.
 * A device may own a single nested `extension/` dir (its hidden device extension), emitted under
 * `thingblock-resource/extensions/devices/<id>/extension/<module>.js`; the fixed `extension/` name is
 * the convention, so a device has at most one. The build needs no hand-maintained entry list.
 * @returns {Record<string, string>} A Vite lib entry map from the output key to the source file.
 */
function discoverEntries() {
  /** @type {Record<string, string>} */
  const entries = {}

  // Map each present `${srcDir}/<mod>.ts` to the output key `${outKey}/<mod>`.
  const addModules = (srcDir, outKey) => {
    for (const mod of ENTRY_MODULES) {
      const file = join(srcDir, `${mod}.ts`)
      if (existsSync(file)) entries[`${outKey}/${mod}`] = file
    }
  }

  for (const group of PACK_GROUPS) {
    const groupDir = join(EXTENSIONS_DIR, group)
    if (!existsSync(groupDir)) continue
    const packs = readdirSync(groupDir, { withFileTypes: true }).filter((d) => d.isDirectory())
    for (const pack of packs) {
      const packKey = `${PACK_ROOT}/extensions/${group}/${pack.name}`
      addModules(join(groupDir, pack.name), packKey)
      addModules(join(groupDir, pack.name, 'extension'), `${packKey}/extension`)
    }
  }
  return entries
}

// The pack binds to the editor's live Blockly and arduinoGenerator by injection, so these must never
// be bundled — they are externalized and resolved from the editor at import time.
const external = [/^blockly(\/.*)?$/, /^@scratch\/scratch-blocks(\/.*)?$/]

export default defineConfig({
  build: {
    outDir: 'dist',
    lib: {
      entry: discoverEntries(),
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
    rolldownOptions: { external },
  },
})
