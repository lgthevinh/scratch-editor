/**
 * ThingBot's device-exclusive peripheral. Published as a hidden peripheral so it never appears in the
 * peripheral library; the ThingBot device activates it by id when selected. It owns the device's
 * board-mode toolbox, block definitions, and Arduino codegen.
 */
import type { PeripheralManifest } from '../../../shared/types'

const manifest: PeripheralManifest = {
  id: 'thingbot-core',
  kind: 'peripheral',
  name: 'ThingBot',
  hidden: true,
  blocks: './blocks.js',
  generator: './generator.js',
  toolbox: './toolbox.js',
  libs: [{ path: 'libs/Adafruit_PWM_Servo_Driver_Library' }, { path: 'libs/Adafruit_BusIO' }],
}

export default manifest
