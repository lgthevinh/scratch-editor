/**
 * VIA Banh Mi Arduino codegen using the editor's shared generator buckets. Motors and servos run through
 * an Adafruit PWM driver; the IMU blocks read an MPU6050 over I2C. Servo angle is mapped to a PWM pulse
 * (150–600) at codegen time.
 */
import type { Block } from '@scratch/scratch-blocks'
import type { RegisterGenerators } from '../../../shared/types'

const mapValue = (value: number, inMin: number, inMax: number, outMin: number, outMax: number): number =>
  ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin

export const registerGenerators: RegisterGenerators = (generator, Order) => {
  const fieldValue = (block: Block, name: string, fallback: string): string => {
    const value: unknown = block.getFieldValue(name)
    return typeof value === 'string' ? value : fallback
  }

  const defineMotorPins = () => {
    generator.globals.set(
      'viaBanhMi_motor_pins',
      [
        '#define MOTOR_1_A 8',
        '#define MOTOR_1_B 9',
        '#define MOTOR_2_A 10',
        '#define MOTOR_2_B 11',
        '#define MOTOR_3_A 12',
        '#define MOTOR_3_B 13',
        '#define MOTOR_4_A 14',
        '#define MOTOR_4_B 15',
      ].join('\n'),
    )
  }

  const defineServoPins = () => {
    generator.globals.set(
      'viaBanhMi_servo_pins',
      [
        '#define SERVO_1 2',
        '#define SERVO_2 3',
        '#define SERVO_3 4',
        '#define SERVO_4 5',
        '#define SERVO_5 6',
        '#define SERVO_6 7',
      ].join('\n'),
    )
  }

  generator.forBlock.viaBanhMi_pwmInit = () => {
    generator.includes.set('viaBanhMi_pwm', '#include <Adafruit_PWMServoDriver.h>')
    generator.globals.set('viaBanhMi_pwm', 'Adafruit_PWMServoDriver pwm = Adafruit_PWMServoDriver();')
    return 'pwm.begin();\npwm.setOscillatorFrequency(27000000);\npwm.setPWMFreq(50);\n'
  }

  generator.forBlock.viaBanhMi_setMotor = (block) => {
    const motor = fieldValue(block, 'MOTOR', '1')
    const direction = fieldValue(block, 'DIRECTION', 'forward')
    const speed = generator.valueToCode(block, 'SPEED', Order.ATOMIC) || '0'
    defineMotorPins()
    if (direction === 'forward') {
      return `pwm.setPWM(MOTOR_${motor}_A, 0, 0);\npwm.setPWM(MOTOR_${motor}_B, 0, ${speed});\n`
    }
    return `pwm.setPWM(MOTOR_${motor}_A, 0, ${speed});\npwm.setPWM(MOTOR_${motor}_B, 0, 0);\n`
  }

  generator.forBlock.viaBanhMi_setServo = (block) => {
    const servo = fieldValue(block, 'SERVO', '1')
    const angle = generator.valueToCode(block, 'ANGLE', Order.ATOMIC) || '90'
    defineServoPins()
    const pulse = mapValue(Number(angle), 0, 180, 150, 600)
    return `pwm.setPWM(SERVO_${servo}, 0, ${pulse});\n`
  }

  generator.forBlock.viaBanhMi_initMPU = (block) => {
    const ar = fieldValue(block, 'AR', 'MPU6050_RANGE_8_G')
    const gr = fieldValue(block, 'GR', 'MPU6050_RANGE_500_DEG')
    const fb = fieldValue(block, 'FB', 'MPU6050_BAND_21_HZ')
    generator.includes.set(
      'viaBanhMi_mpu',
      '#include <Adafruit_MPU6050.h>\n#include <Adafruit_Sensor.h>\n#include <Wire.h>',
    )
    generator.globals.set('viaBanhMi_mpu', 'Adafruit_MPU6050 mpu6050;\nsensors_event_t mpu_a, mpu_g, mpu_temp;')
    return `mpu6050.begin(0x69);\nmpu6050.setAccelerometerRange(${ar});\nmpu6050.setGyroRange(${gr});\nmpu6050.setFilterBandwidth(${fb});\n`
  }

  generator.forBlock.viaBanhMi_mpuReadData = () => 'mpu6050.getEvent(&mpu_a, &mpu_g, &mpu_temp);\n'

  generator.forBlock.viaBanhMi_mpuAcceleration = (block) => {
    const axis = fieldValue(block, 'AXIS', 'x')
    return [`mpu_a.acceleration.${axis}`, Order.ATOMIC]
  }

  generator.forBlock.viaBanhMi_mpuGyro = (block) => {
    const axis = fieldValue(block, 'AXIS', 'x')
    return [`mpu_g.gyro.${axis}`, Order.ATOMIC]
  }

  generator.forBlock.viaBanhMi_mpuTemperature = () => ['mpu_temp.temperature', Order.ATOMIC]
}
