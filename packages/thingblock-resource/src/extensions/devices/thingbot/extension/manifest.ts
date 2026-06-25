/**
 * Hidden ThingBot device extension. The VM loads this extension when the ThingBot device is selected;
 * it is not a standalone library entry.
 */
import type { DeviceExtensionManifest } from '../../../../shared/types'

const manifest: DeviceExtensionManifest = {
  id: 'thingbot.device',
  kind: 'deviceExtension',
  name: 'ThingBot',
  hidden: true,
  blocks: './blocks.js',
  generator: './generator.js',
  toolbox: './toolbox.js',
}

export default manifest
