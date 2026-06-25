/**
 * ThingBot device manifest. A ThingEdu ESP32-C3 variant: a single-core RISC-V SoC on the built-in USB
 * Serial/JTAG, built with `CDCOnBoot=cdc` so `Serial` output reaches the Monitor over USB. The nested
 * extension is the hidden programming surface loaded only when this device is selected.
 */
import type { DeviceManifest } from '../../../shared/types'

const manifest: DeviceManifest = {
  id: 'thingbot',
  kind: 'device',
  name: 'ThingBot',
  fqbn: 'esp32:esp32:esp32c3',
  icon: './icon.svg',
  description: {
    id: 'device.thingbot.description',
    default: 'A ThingEdu ESP32-C3 robotics board with Wi-Fi and Bluetooth Low Energy.',
    description: 'Description of the ThingBot device',
  },
  manufacturer: 'thingedu.com',
  requires: 'serial',
  learnMore: 'https://thingedu.com',
  extensions: [
    { kind: 'deviceExtension', path: './extension/manifest.js' },
    { kind: 'peripheral', id: 'servo' },
  ],
  compile: { options: { CDCOnBoot: 'cdc' } },
  upload: {
    pnpid: ['USB\\VID_303A&PID_1001', 'USB\\VID_10C4&PID_EA60', 'USB\\VID_1A86&PID_7523'],
    uploadSpeed: 921600,
  },
}

export default manifest
