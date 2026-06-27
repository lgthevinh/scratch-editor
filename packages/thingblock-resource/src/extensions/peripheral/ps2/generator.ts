/** PS2 receiver Arduino codegen using one shared library include and controller instance. */
import type { Block } from '@scratch/scratch-blocks'
import type { RegisterGenerators } from '../../../shared/types'

export const registerGenerators: RegisterGenerators = (generator, Order) => {
  const fieldValue = (block: Block, name: string, fallback: string): string => {
    const value: unknown = block.getFieldValue(name)
    return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback
  }

  const ensurePs2 = () => {
    generator.includes.set('ps2x_include', '#include <PS2X_lib.h>')
    generator.globals.set('ps2x_instance', 'PS2X ps2x;')
  }

  generator.forBlock.ps2_init = (block) => {
    ensurePs2()
    const din = fieldValue(block, 'DIN', '2')
    const dout = fieldValue(block, 'DOUT', '3')
    const cs = fieldValue(block, 'CS', '4')
    const clk = fieldValue(block, 'CLK', '5')
    return `ps2x.config_gamepad(${clk}, ${dout}, ${cs}, ${din}, false, false);\n`
  }

  generator.forBlock.ps2_readData = () => {
    ensurePs2()
    return 'ps2x.read_gamepad();\n'
  }

  generator.forBlock.ps2_getButton = (block) => {
    ensurePs2()
    const button = fieldValue(block, 'BUTTON', 'PSB_PAD_UP')
    return [`ps2x.Button(${button})`, Order.ATOMIC]
  }

  generator.forBlock.ps2_GetJoystick = (block) => {
    ensurePs2()
    const joystick = fieldValue(block, 'JOYSTICK', 'PSS_LX')
    return [`ps2x.Analog(${joystick})`, Order.ATOMIC]
  }
}
