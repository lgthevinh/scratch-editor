/**
 * Serial peripheral block definitions. Registered against the editor's injected Blockly so the palette
 * shapes live in the same instance the workspace uses.
 */
import type { Block } from '@scratch/scratch-blocks'
import type { RegisterBlocks } from '../../../shared/types'

const COLOUR = '#5C9EAD'
const SECONDARY_COLOUR = '#3E7C8A'

export const registerBlocks: RegisterBlocks = (Blockly) => {
  Blockly.Blocks.serial_begin = {
    init(this: Block) {
      this.jsonInit({
        message0: 'begin serial at %1 baud',
        args0: [
          {
            type: 'field_dropdown',
            name: 'BAUD',
            options: [
              ['9600', '9600'],
              ['19200', '19200'],
              ['38400', '38400'],
              ['57600', '57600'],
              ['115200', '115200'],
            ],
          },
        ],
        colour: COLOUR,
        secondaryColour: SECONDARY_COLOUR,
        extensions: ['shape_statement'],
      })
    },
  }

  Blockly.Blocks.serial_print = {
    init(this: Block) {
      this.jsonInit({
        message0: 'serial print %1',
        args0: [{ type: 'input_value', name: 'VALUE' }],
        colour: COLOUR,
        secondaryColour: SECONDARY_COLOUR,
        extensions: ['shape_statement'],
      })
    },
  }

  Blockly.Blocks.serial_println = {
    init(this: Block) {
      this.jsonInit({
        message0: 'serial print line %1',
        args0: [{ type: 'input_value', name: 'VALUE' }],
        colour: COLOUR,
        secondaryColour: SECONDARY_COLOUR,
        extensions: ['shape_statement'],
      })
    },
  }

  Blockly.Blocks.serial_available = {
    init(this: Block) {
      this.jsonInit({
        message0: 'serial data available?',
        colour: COLOUR,
        secondaryColour: SECONDARY_COLOUR,
        extensions: ['output_boolean'],
      })
    },
  }

  Blockly.Blocks.serial_readString = {
    init(this: Block) {
      this.jsonInit({
        message0: 'read serial text',
        colour: COLOUR,
        secondaryColour: SECONDARY_COLOUR,
        extensions: ['output_string'],
      })
    },
  }

  Blockly.Blocks.serial_parseInt = {
    init(this: Block) {
      this.jsonInit({
        message0: 'read serial number',
        colour: COLOUR,
        secondaryColour: SECONDARY_COLOUR,
        extensions: ['output_number'],
      })
    },
  }
}
