import { describe, expect, it } from 'vitest'
import { registerBlocks } from '../src/extensions/peripheral/ps2/blocks'
import { registerGenerators } from '../src/extensions/peripheral/ps2/generator'
import ps2Manifest from '../src/extensions/peripheral/ps2/manifest'
import ps2Toolbox from '../src/extensions/peripheral/ps2/toolbox'
import { registerGenerators as registerThingbotGenerators } from '../src/extensions/peripheral/thingbot-core/generator'
import type { ArduinoGenerator, ArduinoOrder, Blockly } from '../src/shared/types'

const Order = { ATOMIC: 0 } as unknown as ArduinoOrder

const makeGenerator = () => ({
  forBlock: {} as Record<string, (block: unknown) => string | [string, number]>,
  includes: new Map<string, string>(),
  globals: new Map<string, string>(),
  setups: new Map<string, string>(),
  valueToCode: () => '',
})

const makeBlock = (fields: Record<string, string | number> = {}) => ({
  getFieldValue: (name: string) => fields[name],
})

interface JsonArgument {
  name?: string
  value?: unknown
  options?: string[][]
}

interface JsonConfig {
  args0?: JsonArgument[]
}

interface BlockDefinition {
  init(this: { jsonInit: (config: JsonConfig) => void }): void
}

const configFor = (definition: unknown): JsonConfig => {
  let config: JsonConfig | undefined
  const block = { jsonInit: (value: JsonConfig) => (config = value) }
  ;(definition as BlockDefinition).init.call(block)
  if (!config) throw new Error('configFor: block did not call jsonInit')
  return config
}

const blockIds = ['ps2_init', 'ps2_readData', 'ps2_getButton', 'ps2_GetJoystick']

describe('PS2 blocks', () => {
  it('defines the four PS2 block opcodes', () => {
    const Blocks: Record<string, unknown> = {}
    registerBlocks({ Blocks } as unknown as Blockly)
    expect(Object.keys(Blocks)).toEqual(blockIds)
  })

  it('uses numeric pin fields with the PS2 defaults', () => {
    const Blocks: Record<string, unknown> = {}
    registerBlocks({ Blocks } as unknown as Blockly)

    const args = configFor(Blocks.ps2_init).args0 ?? []
    expect(args.map(({ name }) => name)).toEqual(['DIN', 'DOUT', 'CS', 'CLK'])
    expect(args.map(({ value }) => value)).toEqual([2, 3, 4, 5])
  })

  it('preserves the button and joystick constants', () => {
    const Blocks: Record<string, unknown> = {}
    registerBlocks({ Blocks } as unknown as Blockly)

    const buttons = configFor(Blocks.ps2_getButton).args0?.[0].options?.map((option) => option[1])
    const joysticks = configFor(Blocks.ps2_GetJoystick).args0?.[0].options?.map((option) => option[1])
    expect(buttons).toContain('PSB_PAD_UP')
    expect(buttons).toContain('PSB_START')
    expect(joysticks).toEqual(['PSS_LX', 'PSS_LY', 'PSS_RX', 'PSS_RY'])
  })
})

describe('PS2 generator', () => {
  it('emits configuration with selected pins and safe defaults', () => {
    const gen = makeGenerator()
    registerGenerators(gen as unknown as ArduinoGenerator, Order)

    expect(gen.forBlock.ps2_init(makeBlock({ DIN: 7, DOUT: 2, CS: 10, CLK: 6 }))).toBe(
      'ps2x.config_gamepad(6, 2, 10, 7, false, false);\n',
    )
    expect(gen.forBlock.ps2_init(makeBlock())).toBe('ps2x.config_gamepad(5, 3, 4, 2, false, false);\n')
  })

  it('emits polling, button, and joystick code', () => {
    const gen = makeGenerator()
    registerGenerators(gen as unknown as ArduinoGenerator, Order)

    expect(gen.forBlock.ps2_readData(makeBlock())).toBe('ps2x.read_gamepad();\n')
    expect(gen.forBlock.ps2_getButton(makeBlock({ BUTTON: 'PSB_CROSS' }))).toEqual([
      'ps2x.Button(PSB_CROSS)',
      Order.ATOMIC,
    ])
    expect(gen.forBlock.ps2_GetJoystick(makeBlock({ JOYSTICK: 'PSS_RY' }))).toEqual([
      'ps2x.Analog(PSS_RY)',
      Order.ATOMIC,
    ])
  })

  it('deduplicates the include and controller instance across PS2 and ThingBot generators', () => {
    const gen = makeGenerator()
    registerGenerators(gen as unknown as ArduinoGenerator, Order)
    registerThingbotGenerators(gen as unknown as ArduinoGenerator, Order)

    gen.forBlock.ps2_readData(makeBlock())
    gen.forBlock.thingBotC3_initPS2(makeBlock())

    expect(gen.includes.get('ps2x_include')).toBe('#include <PS2X_lib.h>')
    expect(gen.globals.get('ps2x_instance')).toBe('PS2X ps2x;')
    expect([...gen.globals.values()].filter((value) => value === 'PS2X ps2x;')).toHaveLength(1)
  })
})

describe('PS2 resource pack', () => {
  it('declares its served modules, icon, and vendored library', () => {
    expect(ps2Manifest).toMatchObject({
      id: 'ps2',
      kind: 'peripheral',
      icon: './icon.png',
      blocks: './blocks.js',
      generator: './generator.js',
      toolbox: './toolbox.js',
      libs: [{ path: 'libs/PS2X_lib' }],
    })
  })

  it('preserves the toolbox block order', () => {
    expect(ps2Toolbox.colour).toBe('#FF3399')
    expect(ps2Toolbox.contents.map(({ type }) => type)).toEqual(blockIds)
  })
})
