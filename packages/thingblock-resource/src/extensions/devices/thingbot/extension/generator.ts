/**
 * ThingBot-exclusive Arduino codegen. The block is namespaced to this device extension so it does not
 * collide with the standard Arduino API blocks.
 */
import type { RegisterGenerators } from '../../../../shared/types'

export const registerGenerators: RegisterGenerators = (generator, Order) => {
  generator.forBlock.thingbot_digitalwrite = (block) => {
    const pin = generator.valueToCode(block, 'PIN', Order.ATOMIC) || '2'
    const state = block.getFieldValue('STATE') === 'LOW' ? 'LOW' : 'HIGH'
    generator.setups.set(`thingbot_pin_${pin}_output`, `pinMode(${pin}, OUTPUT);`)
    return `digitalWrite(${pin}, ${state});\n`
  }
}
