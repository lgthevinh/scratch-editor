/** Toolbox category for the PS2 wireless controller peripheral. */
import type { ToolboxCategory } from '../../../shared/types'

const toolbox: ToolboxCategory = {
  kind: 'category',
  name: 'PS2',
  colour: '#FF3399',
  contents: [
    { kind: 'block', type: 'ps2_init' },
    { kind: 'block', type: 'ps2_readData' },
    { kind: 'block', type: 'ps2_getButton' },
    { kind: 'block', type: 'ps2_GetJoystick' },
  ],
}

export default toolbox
