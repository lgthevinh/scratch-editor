import { describe, expect, it } from 'vitest'
import viaBanhMiManifest from '../src/extensions/devices/viaBanhMi/manifest'
import { registerBlocks } from '../src/extensions/peripheral/viaBanhMi-core/blocks'
import { registerGenerators } from '../src/extensions/peripheral/viaBanhMi-core/generator'
import viaBanhMiCoreManifest from '../src/extensions/peripheral/viaBanhMi-core/manifest'
import viaBanhMiToolbox from '../src/extensions/peripheral/viaBanhMi-core/toolbox'
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

const viaBanhMiBlockIds = [
  'viaBanhMi_pwmInit',
  'viaBanhMi_setMotor',
  'viaBanhMi_setServo',
  'viaBanhMi_initMPU',
  'viaBanhMi_mpuReadData',
  'viaBanhMi_mpuAcceleration',
  'viaBanhMi_mpuGyro',
  'viaBanhMi_mpuTemperature',
]

describe('viaBanhMi-core blocks', () => {
  it('defines the full VIA Banh Mi block surface on the injected Blockly', () => {
    const Blocks: Record<string, unknown> = {}
    registerBlocks({ Blocks } as unknown as Blockly)
    expect(Object.keys(Blocks).sort()).toEqual([...viaBanhMiBlockIds].sort())
  })
})

describe('viaBanhMi-core generator', () => {
  it('emits the PWM include, driver instance, and init sequence', () => {
    const gen = makeGenerator()
    registerGenerators(gen as unknown as ArduinoGenerator, Order)

    const code = gen.forBlock.viaBanhMi_pwmInit(makeBlock())

    expect(code).toBe('pwm.begin();\npwm.setOscillatorFrequency(27000000);\npwm.setPWMFreq(50);\n')
    expect(gen.includes.get('viaBanhMi_pwm')).toBe('#include <Adafruit_PWMServoDriver.h>')
    expect(gen.globals.get('viaBanhMi_pwm')).toBe('Adafruit_PWMServoDriver pwm = Adafruit_PWMServoDriver();')
  })

  it('emits motor commands with direction and safe empty-input defaults', () => {
    const gen = makeGenerator()
    registerGenerators(gen as unknown as ArduinoGenerator, Order)

    expect(gen.forBlock.viaBanhMi_setMotor(makeBlock())).toBe(
      'pwm.setPWM(MOTOR_1_A, 0, 0);\npwm.setPWM(MOTOR_1_B, 0, 0);\n',
    )
    expect(gen.forBlock.viaBanhMi_setMotor(makeBlock({ SPEED: '200' }, { MOTOR: '2', DIRECTION: 'backward' }))).toBe(
      'pwm.setPWM(MOTOR_2_A, 0, 200);\npwm.setPWM(MOTOR_2_B, 0, 0);\n',
    )
    expect(gen.globals.get('viaBanhMi_motor_pins')).toContain('#define MOTOR_1_A 8')
  })

  it('maps servo angle to a PWM pulse, defaulting empty input to 90 degrees', () => {
    const gen = makeGenerator()
    registerGenerators(gen as unknown as ArduinoGenerator, Order)

    expect(gen.forBlock.viaBanhMi_setServo(makeBlock({ ANGLE: '0' }, { SERVO: '3' }))).toBe(
      'pwm.setPWM(SERVO_3, 0, 150);\n',
    )
    expect(gen.forBlock.viaBanhMi_setServo(makeBlock({}, { SERVO: '1' }))).toBe('pwm.setPWM(SERVO_1, 0, 375);\n')
    expect(gen.globals.get('viaBanhMi_servo_pins')).toContain('#define SERVO_6 7')
  })

  it('emits the MPU6050 init, read, and reporter expressions', () => {
    const gen = makeGenerator()
    registerGenerators(gen as unknown as ArduinoGenerator, Order)

    expect(gen.forBlock.viaBanhMi_initMPU(makeBlock())).toBe(
      'mpu6050.begin(0x69);\nmpu6050.setAccelerometerRange(MPU6050_RANGE_8_G);\nmpu6050.setGyroRange(MPU6050_RANGE_500_DEG);\nmpu6050.setFilterBandwidth(MPU6050_BAND_21_HZ);\n',
    )
    expect(gen.includes.get('viaBanhMi_mpu')).toContain('#include <Adafruit_MPU6050.h>')
    expect(gen.globals.get('viaBanhMi_mpu')).toContain('Adafruit_MPU6050 mpu6050;')
    expect(gen.forBlock.viaBanhMi_mpuReadData(makeBlock())).toBe('mpu6050.getEvent(&mpu_a, &mpu_g, &mpu_temp);\n')
    expect(gen.forBlock.viaBanhMi_mpuAcceleration(makeBlock({}, { AXIS: 'y' }))).toEqual([
      'mpu_a.acceleration.y',
      Order.ATOMIC,
    ])
    expect(gen.forBlock.viaBanhMi_mpuGyro(makeBlock({}, { AXIS: 'z' }))).toEqual(['mpu_g.gyro.z', Order.ATOMIC])
    expect(gen.forBlock.viaBanhMi_mpuTemperature(makeBlock())).toEqual(['mpu_temp.temperature', Order.ATOMIC])
  })
})

describe('viaBanhMi manifests', () => {
  it('viaBanhMi is an esp32 device activating its hidden core peripheral', () => {
    expect(viaBanhMiManifest.kind).toBe('device')
    expect(viaBanhMiManifest.id).toBe('viaBanhMi')
    expect(viaBanhMiManifest.fqbn).toBe('esp32:esp32:esp32')
    expect(viaBanhMiManifest.requires).toBe('serial')
    expect(viaBanhMiManifest.manufacturer).toBe('MakerViet')
    expect(viaBanhMiManifest.extensions).toEqual(['viaBanhMi-core'])
    expect(viaBanhMiManifest.compile).toBeUndefined()
  })

  it('viaBanhMi-core is a hidden peripheral vendoring the PWM and MPU libraries', () => {
    expect(viaBanhMiCoreManifest.kind).toBe('peripheral')
    expect(viaBanhMiCoreManifest.id).toBe('viaBanhMi-core')
    expect(viaBanhMiCoreManifest.hidden).toBe(true)
    expect(viaBanhMiCoreManifest.libs).toEqual([
      { path: 'libs/Adafruit_PWM_Servo_Driver_Library' },
      { path: 'libs/Adafruit_BusIO' },
      { path: 'libs/Adafruit_MPU6050' },
      { path: 'libs/Adafruit_Unified_Sensor' },
    ])
  })

  it('viaBanhMi toolbox preserves the block order and value-input shadows', () => {
    expect(viaBanhMiToolbox.colour).toBe('#42CCFF')
    expect(viaBanhMiToolbox.contents.map((item) => item.type)).toEqual(viaBanhMiBlockIds)
    const servo = viaBanhMiToolbox.contents.find((item) => item.type === 'viaBanhMi_setServo')
    expect(servo?.inputs).toEqual({ ANGLE: { type: 'math_number', fields: { NUM: 90 } } })
  })
})
