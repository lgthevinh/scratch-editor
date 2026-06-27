/**
 * Servo toolbox category. The editor splices this into the workspace toolbox when the peripheral is
 * added, making the pack's blocks reachable from the palette.
 */
import type { ToolboxCategory } from '../../../shared/types'

const toolbox: ToolboxCategory = {
  kind: 'category',
  name: 'Servo',
  colour: '#CF63CF',
  contents: [
    {
      kind: 'block',
      type: 'servo_setangle',
      inputs: {
        PIN: { type: 'math_number', fields: { NUM: 9 } },
        ANGLE: { type: 'math_number', fields: { NUM: 90 } },
      },
    },
  ],
}

export default toolbox
