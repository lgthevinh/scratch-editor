/**
 * VIA Banh Mi's device-exclusive peripheral. Published as a hidden peripheral so it never appears in the
 * peripheral library; the VIA Banh Mi device activates it by id when selected. It owns the device's
 * board-mode toolbox, block definitions, and Arduino codegen (PWM motors/servos plus an MPU6050 IMU).
 */
import type { PeripheralManifest } from '../../../shared/types'

const manifest: PeripheralManifest = {
  id: 'viaBanhMi-core',
  kind: 'peripheral',
  name: 'VIA Banh Mi',
  hidden: true,
  blocks: './blocks.js',
  generator: './generator.js',
  toolbox: './toolbox.js',
  libs: [
    { path: 'libs/Adafruit_PWM_Servo_Driver_Library' },
    { path: 'libs/Adafruit_BusIO' },
    { path: 'libs/Adafruit_MPU6050' },
    { path: 'libs/Adafruit_Unified_Sensor' },
  ],
}

export default manifest
