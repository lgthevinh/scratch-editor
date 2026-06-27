/** PS2 wireless controller peripheral manifest. */
import type { PeripheralManifest } from '../../../shared/types'

const manifest: PeripheralManifest = {
  id: 'ps2',
  kind: 'peripheral',
  name: 'PS2 Remote Control',
  icon: './icon.png',
  description: {
    id: 'peripheral.ps2.description',
    default: 'PS2 wireless remote controller with 4 signal lines.',
    description: 'Description of the PS2 wireless controller peripheral',
  },
  blocks: './blocks.js',
  generator: './generator.js',
  toolbox: './toolbox.js',
  libs: [{ path: 'libs/PS2X_lib' }],
}

export default manifest
