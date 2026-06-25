/**
 * Toolbox category shown while the ThingBot device is selected.
 */
import type { ToolboxCategory } from '../../../../shared/types'

const toolbox: ToolboxCategory = {
  kind: 'category',
  name: 'ThingBot',
  colour: '#0FBD8C',
  contents: [{ kind: 'block', type: 'thingbot_digitalwrite' }],
}

export default toolbox
