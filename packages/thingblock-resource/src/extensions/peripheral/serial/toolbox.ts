/**
 * Serial toolbox category. The editor splices this into the workspace toolbox when the peripheral is
 * added, making the pack's blocks reachable from the palette.
 */
import type { ToolboxCategory } from '../../../shared/types'

const toolbox: ToolboxCategory = {
  kind: 'category',
  name: 'Serial',
  colour: '#5C9EAD',
  contents: [
    { kind: 'block', type: 'serial_begin' },
    {
      kind: 'block',
      type: 'serial_print',
      inputs: { VALUE: { type: 'text', fields: { TEXT: 'Hello' } } },
    },
    {
      kind: 'block',
      type: 'serial_println',
      inputs: { VALUE: { type: 'text', fields: { TEXT: 'Hello' } } },
    },
    { kind: 'block', type: 'serial_available' },
    { kind: 'block', type: 'serial_readString' },
    { kind: 'block', type: 'serial_parseInt' },
  ],
}

export default toolbox
