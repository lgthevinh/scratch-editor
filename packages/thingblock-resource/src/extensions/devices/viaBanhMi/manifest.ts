/**
 * VIA Banh Mi device manifest. A MakerViet ESP32 robotics board that talks to the host over a
 * CP2102/CH340 USB-UART bridge (a real serial port, so no USB-CDC compile flag is needed). The hidden
 * `viaBanhMi-core` peripheral is its programming surface, activated only when this device is selected.
 */
import type { DeviceManifest } from '../../../shared/types'

const manifest: DeviceManifest = {
  id: 'viaBanhMi',
  kind: 'device',
  name: 'VIA Banh Mi',
  fqbn: 'esp32:esp32:esp32',
  icon: './icon.svg',
  description: {
    id: 'device.viaBanhMi.description',
    default:
      'A MakerViet ESP32 robotics board for Vietnamese students to build robotics and autonomous-vehicle projects.',
    description: 'Description of the VIA Banh Mi device',
  },
  manufacturer: 'MakerViet',
  requires: 'serial',
  extensions: ['viaBanhMi-core'],
  upload: {
    pnpid: ['USB\\VID_10C4&PID_EA60', 'USB\\VID_1A86&PID_7523'],
    uploadSpeed: 921600,
  },
}

export default manifest
