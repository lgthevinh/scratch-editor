/**
 * Serial peripheral manifest. Serial is part of the Arduino core runtime, so the pack vendors no
 * library sources and declares no registry libs — it exposes only blocks, codegen, and a toolbox.
 */
import type { PeripheralManifest } from '../../../shared/types'

const manifest: PeripheralManifest = {
  id: 'serial',
  kind: 'peripheral',
  name: 'Serial',
  icon: './icon.svg',
  description: {
    id: 'peripheral.serial.description',
    default: 'Send and receive text over the serial monitor.',
    description: 'Description of the Serial peripheral',
  },
  blocks: './blocks.js',
  generator: './generator.js',
  toolbox: './toolbox.js',
}

export default manifest
