/**
 * ThingBot-exclusive block definitions. Registered against the editor's injected Blockly instance.
 */
import type { Block } from '@scratch/scratch-blocks'
import type { RegisterBlocks } from '../../../../shared/types'

export const registerBlocks: RegisterBlocks = (Blockly) => {
  Blockly.Blocks.thingbot_digitalwrite = {
    init(this: Block) {
      this.jsonInit({
        message0: 'set ThingBot pin %1 to %2',
        args0: [
          { type: 'input_value', name: 'PIN', check: 'Number' },
          {
            type: 'field_dropdown',
            name: 'STATE',
            options: [
              ['HIGH', 'HIGH'],
              ['LOW', 'LOW'],
            ],
          },
        ],
        category: 'thingbot',
        extensions: ['colours_more', 'shape_statement'],
      })
    },
  }
}
