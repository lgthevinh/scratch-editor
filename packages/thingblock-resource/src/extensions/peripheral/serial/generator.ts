/**
 * Serial peripheral codegen. Serial lives in the Arduino core, so each block maps directly to a
 * `Serial.*` call with no include/global/setup fragments to push.
 */
import type { Block } from '@scratch/scratch-blocks'
import type { RegisterGenerators } from '../../../shared/types'

export const registerGenerators: RegisterGenerators = (generator, Order) => {
  const fieldValue = (block: Block, name: string, fallback: string): string => {
    const value: unknown = block.getFieldValue(name)
    return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback
  }

  generator.forBlock.serial_begin = (block) => {
    const baud = fieldValue(block, 'BAUD', '9600')
    return `Serial.begin(${baud});\n`
  }

  generator.forBlock.serial_print = (block) => {
    const value = generator.valueToCode(block, 'VALUE', Order.NONE) || '""'
    return `Serial.print(${value});\n`
  }

  generator.forBlock.serial_println = (block) => {
    const value = generator.valueToCode(block, 'VALUE', Order.NONE) || '""'
    return `Serial.println(${value});\n`
  }

  generator.forBlock.serial_available = () => ['Serial.available() > 0', Order.ATOMIC]

  generator.forBlock.serial_readString = () => ["Serial.readStringUntil('\\n')", Order.ATOMIC]

  generator.forBlock.serial_parseInt = () => ['Serial.parseInt()', Order.ATOMIC]
}
