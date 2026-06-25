// Emit the pack enumerator the editor fetches first. `ServeDir` serves files, not directory listings,
// so the loader cannot crawl the served root; it reads this index to learn which packs exist and where.
// Each entry is {kind, path}: kind from the group (devices→device, peripheral→peripheral), path the
// served `<group>/<pack>` folder. Run after copy-assets, before zip.
import { existsSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const EXTENSIONS_OUT = join('dist', 'thingblock-resource', 'extensions')
const GROUP_KIND = { devices: 'device', peripheral: 'peripheral' }

const packs = []
for (const [group, kind] of Object.entries(GROUP_KIND)) {
  const groupDir = join(EXTENSIONS_OUT, group)
  if (!existsSync(groupDir)) continue
  for (const pack of readdirSync(groupDir, { withFileTypes: true })) {
    if (pack.isDirectory()) packs.push({ kind, path: `${group}/${pack.name}` })
  }
}

writeFileSync(join(EXTENSIONS_OUT, 'index.json'), `${JSON.stringify({ packs }, null, 2)}\n`)
