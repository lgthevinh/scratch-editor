import { describe, expect, it } from 'vitest'
import { registerBlocks } from '../src/extensions/peripheral/serial/blocks'
import { registerGenerators } from '../src/extensions/peripheral/serial/generator'
import serialManifest from '../src/extensions/peripheral/serial/manifest'
import serialToolbox from '../src/extensions/peripheral/serial/toolbox'
import type { ArduinoGenerator, ArduinoOrder, Blockly } from '../src/shared/types'

// Minimal stand-ins for the editor's injected instances: the order enum the pack reads and a generator
// whose valueToCode returns the fake block's per-input source.
const Order = { ATOMIC: 0, NONE: 99 } as unknown as ArduinoOrder

const makeGenerator = () => ({
  forBlock: {} as Record<string, (block: unknown) => string | [string, number]>,
  valueToCode: (block: { values: Record<string, string> }, name: string) => block.values[name] ?? '',
})

const makeBlock = (values: Record<string, string> = {}, fields: Record<string, string> = {}) => ({
  values,
  getFieldValue: (name: string) => fields[name],
})

const serialBlockIds = [
  'serial_begin',
  'serial_print',
  'serial_println',
  'serial_available',
  'serial_readString',
  'serial_parseInt',
]

describe('serial generator', () => {
  it('emits Serial.begin with the selected baud and a default fallback', () => {
    const gen = makeGenerator()
    registerGenerators(gen as unknown as ArduinoGenerator, Order)

    expect(gen.forBlock.serial_begin(makeBlock({}, { BAUD: '115200' }))).toBe('Serial.begin(115200);\n')
    expect(gen.forBlock.serial_begin(makeBlock())).toBe('Serial.begin(9600);\n')
  })

  it('wraps print/println inputs and falls back to an empty string', () => {
    const gen = makeGenerator()
    registerGenerators(gen as unknown as ArduinoGenerator, Order)

    expect(gen.forBlock.serial_print(makeBlock({ VALUE: 'x' }))).toBe('Serial.print(x);\n')
    expect(gen.forBlock.serial_print(makeBlock())).toBe('Serial.print("");\n')
    expect(gen.forBlock.serial_println(makeBlock({ VALUE: 'x' }))).toBe('Serial.println(x);\n')
    expect(gen.forBlock.serial_println(makeBlock())).toBe('Serial.println("");\n')
  })

  it('emits the reporter expressions as atomic-order values', () => {
    const gen = makeGenerator()
    registerGenerators(gen as unknown as ArduinoGenerator, Order)

    expect(gen.forBlock.serial_available(makeBlock())).toEqual(['Serial.available() > 0', Order.ATOMIC])
    expect(gen.forBlock.serial_readString(makeBlock())).toEqual(["Serial.readStringUntil('\\n')", Order.ATOMIC])
    expect(gen.forBlock.serial_parseInt(makeBlock())).toEqual(['Serial.parseInt()', Order.ATOMIC])
  })
})

describe('serial blocks', () => {
  it('defines the full serial block surface on the injected Blockly', () => {
    const Blocks: Record<string, unknown> = {}
    registerBlocks({ Blocks } as unknown as Blockly)
    expect(Object.keys(Blocks).sort()).toEqual([...serialBlockIds].sort())
  })
})

describe('serial manifest', () => {
  it('is a peripheral pointing at its served modules', () => {
    expect(serialManifest.kind).toBe('peripheral')
    expect(serialManifest.id).toBe('serial')
    expect(serialManifest.blocks).toBe('./blocks.js')
    expect(serialManifest.generator).toBe('./generator.js')
    expect(serialManifest.toolbox).toBe('./toolbox.js')
  })

  it('carries the library-card icon and localized description, and is not hidden', () => {
    expect(serialManifest.icon).toBe('./icon.svg')
    expect(serialManifest.description?.id).toBe('peripheral.serial.description')
    expect(serialManifest.description?.default).toMatch(/serial/i)
    expect(serialManifest.hidden).toBeUndefined()
  })

  it('vendors no libraries (Serial is in the Arduino core)', () => {
    expect(serialManifest.libs).toBeUndefined()
    expect(serialManifest.registryLibs).toBeUndefined()
  })

  it('toolbox references every block type with print shadows', () => {
    expect(serialToolbox.contents.map((item) => item.type)).toEqual(serialBlockIds)
    const print = serialToolbox.contents.find((item) => item.type === 'serial_print')
    expect(print?.inputs).toEqual({ VALUE: { type: 'text', fields: { TEXT: 'Hello' } } })
  })
})
