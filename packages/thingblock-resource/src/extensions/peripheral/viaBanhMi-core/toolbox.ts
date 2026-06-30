/**
 * VIA Banh Mi toolbox category. The editor splices this into the workspace toolbox when the device is
 * selected, making the board-mode blocks reachable from the palette. Dropdown defaults come from each
 * block's first option; only the value inputs need shadow defaults.
 */
import type { ToolboxCategory } from '../../../shared/types'

const toolbox: ToolboxCategory = {
  kind: 'category',
  name: 'VIA - Banh Mi',
  colour: '#42CCFF',
  contents: [
    { kind: 'block', type: 'viaBanhMi_pwmInit' },
    {
      kind: 'block',
      type: 'viaBanhMi_setMotor',
      inputs: { SPEED: { type: 'math_number', fields: { NUM: 0 } } },
    },
    {
      kind: 'block',
      type: 'viaBanhMi_setServo',
      inputs: { ANGLE: { type: 'math_number', fields: { NUM: 90 } } },
    },
    { kind: 'block', type: 'viaBanhMi_initMPU' },
    { kind: 'block', type: 'viaBanhMi_mpuReadData' },
    { kind: 'block', type: 'viaBanhMi_mpuAcceleration' },
    { kind: 'block', type: 'viaBanhMi_mpuGyro' },
    { kind: 'block', type: 'viaBanhMi_mpuTemperature' },
  ],
}

export default toolbox
