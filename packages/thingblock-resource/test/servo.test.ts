import { describe, expect, it } from 'vitest'
import thingbotManifest from '../src/extensions/devices/thingbot/manifest'
import ps2Manifest from '../src/extensions/peripheral/ps2/manifest'
import { registerBlocks } from '../src/extensions/peripheral/servo/blocks'
import { registerGenerators } from '../src/extensions/peripheral/servo/generator'
import servoManifest from '../src/extensions/peripheral/servo/manifest'
import servoToolbox from '../src/extensions/peripheral/servo/toolbox'
import { registerBlocks as registerThingbotBlocks } from '../src/extensions/peripheral/thingbot-core/blocks'
import { registerGenerators as registerThingbotGenerators } from '../src/extensions/peripheral/thingbot-core/generator'
import thingbotCoreManifest from '../src/extensions/peripheral/thingbot-core/manifest'
import thingbotToolbox from '../src/extensions/peripheral/thingbot-core/toolbox'
import type { ArduinoGenerator, ArduinoOrder, Blockly } from '../src/shared/types'

// Minimal stand-ins for the editor's injected instances: the order enum the pack reads and a generator
// whose buckets we can inspect. valueToCode returns the fake block's per-input source.
const Order = { ATOMIC: 0, NONE: 99 } as unknown as ArduinoOrder

const makeGenerator = () => ({
  forBlock: {} as Record<string, (block: unknown) => string | [string, number]>,
  includes: new Map<string, string>(),
  globals: new Map<string, string>(),
  setups: new Map<string, string>(),
  valueToCode: (block: { values: Record<string, string> }, name: string) => block.values[name] ?? '',
})

const makeBlock = (values: Record<string, string> = {}, fields: Record<string, string> = {}) => ({
  values,
  getFieldValue: (name: string) => fields[name],
})

const thingbotBlockIds = [
  'thingBotC3_init',
  'thingBotC3_setMotor',
  'thingBotC3_setServo',
  'thingBotC3_buzzer',
  'thingBotC3_setLed',
  'thingBotC3_switch',
  'thingBotC3_initPS2',
]

describe('servo generator', () => {
  it('emits the include, one Servo object, its attach, and the write call', () => {
    const gen = makeGenerator()
    registerGenerators(gen as unknown as ArduinoGenerator, Order)

    const code = gen.forBlock.servo_setangle({ values: { PIN: '9', ANGLE: '90' } })

    expect(code).toBe('servo_9.write(90);\n')
    expect(gen.includes.get('servo')).toBe('#include <Servo.h>')
    expect(gen.globals.get('servo_9')).toBe('Servo servo_9;')
    expect(gen.setups.get('servo_9_attach')).toBe('servo_9.attach(9);')
  })

  it('falls back to default pin and angle when inputs are empty', () => {
    const gen = makeGenerator()
    registerGenerators(gen as unknown as ArduinoGenerator, Order)

    const code = gen.forBlock.servo_setangle({ values: {} })

    expect(code).toBe('servo_9.write(90);\n')
    expect(gen.globals.get('servo_9')).toBe('Servo servo_9;')
  })
})

describe('servo blocks', () => {
  it('defines servo_setangle on the injected Blockly', () => {
    const Blocks: Record<string, unknown> = {}
    registerBlocks({ Blocks } as unknown as Blockly)
    expect(Blocks.servo_setangle).toBeDefined()
  })
})

describe('thingbot-core peripheral', () => {
  it('defines the legacy ThingBot C3 block surface on the injected Blockly', () => {
    const Blocks: Record<string, unknown> = {}
    registerThingbotBlocks({ Blocks } as unknown as Blockly)
    expect(Object.keys(Blocks).sort()).toEqual([...thingbotBlockIds].sort())
  })

  it('emits the ThingBot PWM declarations and initialization', () => {
    const gen = makeGenerator()
    registerThingbotGenerators(gen as unknown as ArduinoGenerator, Order)

    const code = gen.forBlock.thingBotC3_init(makeBlock())

    expect(code).toContain('pwm.begin();')
    expect(gen.includes.get('thingbot_pwm')).toContain('#include <Adafruit_PWMServoDriver.h>')
    expect(gen.globals.get('thingbot_pins')).toContain('#define SERVO_5 8')
    expect(gen.globals.get('thingbot_pwm')).toContain('Adafruit_PWMServoDriver pwm')
    expect(gen.globals.get('thingbot_map_to_pulse')).toContain('int mapToPulse(int value)')
  })

  it('emits motor, servo, buzzer, and LED commands with safe empty-input defaults', () => {
    const gen = makeGenerator()
    registerThingbotGenerators(gen as unknown as ArduinoGenerator, Order)

    expect(gen.forBlock.thingBotC3_setMotor(makeBlock())).toBe(
      'pwm.setPWM(M1_A, 0, 0);\npwm.setPWM(M1_B, 0, mapToPulse(0));\n',
    )
    expect(gen.forBlock.thingBotC3_setMotor(makeBlock({ SPEED: '60' }, { MOTOR: '2', DIRECTION: 'backward' }))).toBe(
      'pwm.setPWM(M2_A, 0, mapToPulse(60));\npwm.setPWM(M2_B, 0, 0);\n',
    )
    expect(gen.forBlock.thingBotC3_setServo(makeBlock({ PULSE: '1500' }, { SERVO: '3' }))).toBe(
      'pwm.setPWM(SERVO_3, 0, 1500);\n',
    )
    expect(gen.forBlock.thingBotC3_buzzer(makeBlock())).toBe('pwm.setPin(BUZZER, 0, 0);\n')
    expect(gen.forBlock.thingBotC3_setLed(makeBlock({ BRIGHTNESS: '50' }, { LED: 'LED_2' }))).toBe(
      'pwm.setPin(LED_2, mapToPulse(50));\n',
    )
  })

  it('preserves the PS2 initialization and switch reporter generators', () => {
    const gen = makeGenerator()
    registerThingbotGenerators(gen as unknown as ArduinoGenerator, Order)

    const ps2Code = gen.forBlock.thingBotC3_initPS2(makeBlock())

    expect(gen.includes.get('ps2x_include')).toBe('#include <PS2X_lib.h>')
    expect(gen.globals.get('thingbot_ps2_pins')).toContain('#define PS2_DAT 7')
    expect(ps2Code).toContain('ps2x.config_gamepad')
    expect(gen.forBlock.thingBotC3_switch(makeBlock())).toEqual(['!digitalRead(SW)', Order.ATOMIC])
  })
})

describe('manifests', () => {
  it('servo is a peripheral pointing at its served modules', () => {
    expect(servoManifest.kind).toBe('peripheral')
    expect(servoManifest.id).toBe('servo')
    expect(servoManifest.blocks).toBe('./blocks.js')
    expect(servoManifest.generator).toBe('./generator.js')
    expect(servoManifest.libs).toEqual([{ path: 'libs/Servo' }])
  })

  it('servo carries the library-card icon and localized description', () => {
    expect(servoManifest.icon).toBe('./icon.svg')
    expect(servoManifest.description?.id).toBe('peripheral.servo.description')
    expect(servoManifest.description?.default).toMatch(/servo/i)
    expect(servoManifest.hidden).toBeUndefined()
  })

  it('servo toolbox references the block type with shadow-filled value inputs', () => {
    expect(servoToolbox.contents).toContainEqual({
      kind: 'block',
      type: 'servo_setangle',
      inputs: {
        PIN: { type: 'math_number', fields: { NUM: 9 } },
        ANGLE: { type: 'math_number', fields: { NUM: 90 } },
      },
    })
  })

  it('thingbot is an esp32-c3 device with USB-CDC compile config', () => {
    expect(thingbotManifest.kind).toBe('device')
    expect(thingbotManifest.id).toBe('thingbot')
    expect(thingbotManifest.fqbn).toBe('esp32:esp32:esp32c3')
    expect(thingbotManifest.extensions).toEqual(['thingbot-core', 'ps2'])
    expect(thingbotManifest.compile?.options).toEqual({ CDCOnBoot: 'cdc' })
  })

  it('thingbot carries the device-card metadata the VM localizes and renders', () => {
    expect(thingbotManifest.description.id).toBe('device.thingbot.description')
    expect(thingbotManifest.description.default).toMatch(/ESP32-C3/)
    expect(thingbotManifest.manufacturer).toBe('ThingEdu')
    expect(thingbotManifest.requires).toBe('serial')
  })

  it('thingbot extension refs resolve to loaded peripheral packs', () => {
    const peripheralIds = new Set([thingbotCoreManifest.id, ps2Manifest.id, servoManifest.id])
    const refs = thingbotManifest.extensions ?? []
    expect(refs.length).toBeGreaterThan(0)
    for (const id of refs) {
      expect(peripheralIds).toContain(id)
    }
  })

  it('thingbot-core is a hidden peripheral pointing at its served modules', () => {
    expect(thingbotCoreManifest.kind).toBe('peripheral')
    expect(thingbotCoreManifest.id).toBe('thingbot-core')
    expect(thingbotCoreManifest.hidden).toBe(true)
    expect(thingbotCoreManifest.blocks).toBe('./blocks.js')
    expect(thingbotCoreManifest.generator).toBe('./generator.js')
    expect(thingbotCoreManifest.libs).toEqual([
      { path: 'libs/Adafruit_PWM_Servo_Driver_Library' },
      { path: 'libs/Adafruit_BusIO' },
    ])
  })

  it('thingbot toolbox preserves the legacy block order', () => {
    expect(thingbotToolbox.colour).toBe('#42CCFF')
    expect(thingbotToolbox.contents.map((item) => item.type)).toEqual(thingbotBlockIds)
  })

  it('thingbot toolbox fills the value inputs with math_number shadows', () => {
    const motor = thingbotToolbox.contents.find((item) => item.type === 'thingBotC3_setMotor')
    expect(motor?.inputs).toEqual({ SPEED: { type: 'math_number', fields: { NUM: 0 } } })
  })
})
