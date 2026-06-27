/**
 * ThingBot-exclusive block definitions for motors, servos, LEDs, the buzzer, the switch, and PS2 setup.
 */
import type { Block } from '@scratch/scratch-blocks'
import type { RegisterBlocks } from '../../../shared/types'

const CORE_COLOUR = '#009933'
const ACTUATOR_COLOUR = '#cc0000'
const ELECTRONIC_COLOUR = '#6600ff'

export const registerBlocks: RegisterBlocks = (Blockly) => {
  Blockly.Blocks.thingBotC3_init = {
    init(this: Block) {
      this.jsonInit({
        message0: 'init ThingBot',
        colour: CORE_COLOUR,
        extensions: ['shape_statement'],
      })
    },
  }

  Blockly.Blocks.thingBotC3_setMotor = {
    init(this: Block) {
      this.jsonInit({
        message0: 'set motor %1 go %2 at %3',
        args0: [
          {
            type: 'field_dropdown',
            name: 'MOTOR',
            options: [
              ['M1', '1'],
              ['M2', '2'],
              ['M3', '3'],
              ['M4', '4'],
            ],
          },
          {
            type: 'field_dropdown',
            name: 'DIRECTION',
            options: [
              ['forward', 'forward'],
              ['backward', 'backward'],
            ],
          },
          { type: 'input_value', name: 'SPEED', check: 'Number' },
        ],
        colour: ACTUATOR_COLOUR,
        extensions: ['shape_statement'],
      })
    },
  }

  Blockly.Blocks.thingBotC3_setServo = {
    init(this: Block) {
      this.jsonInit({
        message0: 'set servo %1 to pulse %2',
        args0: [
          {
            type: 'field_dropdown',
            name: 'SERVO',
            options: [
              ['S1', '1'],
              ['S2', '2'],
              ['S3', '3'],
              ['S4', '4'],
              ['S5', '5'],
            ],
          },
          { type: 'input_value', name: 'PULSE', check: 'Number' },
        ],
        colour: ACTUATOR_COLOUR,
        extensions: ['shape_statement'],
      })
    },
  }

  Blockly.Blocks.thingBotC3_buzzer = {
    init(this: Block) {
      this.jsonInit({
        message0: 'set buzzer to %1 pulse',
        args0: [{ type: 'input_value', name: 'SOUND', check: 'Number' }],
        colour: ELECTRONIC_COLOUR,
        extensions: ['shape_statement'],
      })
    },
  }

  Blockly.Blocks.thingBotC3_setLed = {
    init(this: Block) {
      this.jsonInit({
        message0: 'set led %1 %2',
        args0: [
          {
            type: 'field_dropdown',
            name: 'LED',
            options: [
              ['1', 'LED_1'],
              ['2', 'LED_2'],
            ],
          },
          { type: 'input_value', name: 'BRIGHTNESS', check: 'Number' },
        ],
        colour: ELECTRONIC_COLOUR,
        extensions: ['shape_statement'],
      })
    },
  }

  Blockly.Blocks.thingBotC3_initPS2 = {
    init(this: Block) {
      this.jsonInit({
        message0: 'init PS2 on ThingBot',
        colour: '#FF3399',
        extensions: ['shape_statement'],
      })
    },
  }

  Blockly.Blocks.thingBotC3_switch = {
    init(this: Block) {
      this.jsonInit({
        message0: 'read switch',
        colour: ELECTRONIC_COLOUR,
        extensions: ['output_boolean'],
      })
    },
  }
}
