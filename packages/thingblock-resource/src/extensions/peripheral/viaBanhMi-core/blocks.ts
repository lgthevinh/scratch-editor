/**
 * VIA Banh Mi block definitions: PWM init, motor/servo drive, and the MPU6050 IMU (init, read, and the
 * acceleration/gyro/temperature reporters). Registered against the editor's injected Blockly.
 */
import type { Block } from '@scratch/scratch-blocks'
import type { RegisterBlocks } from '../../../shared/types'

const PWM_COLOUR = '#FF0000'
const MPU_COLOUR = '#0066CC'

export const registerBlocks: RegisterBlocks = (Blockly) => {
  Blockly.Blocks.viaBanhMi_pwmInit = {
    init(this: Block) {
      this.jsonInit({
        message0: 'init PWM on VIA BanhMi',
        colour: '#000080',
        secondaryColour: '#FF4D6A',
        extensions: ['shape_statement'],
      })
    },
  }

  Blockly.Blocks.viaBanhMi_setMotor = {
    init(this: Block) {
      this.jsonInit({
        message0: 'set motor %1 go %2 at speed %3',
        args0: [
          {
            type: 'field_dropdown',
            name: 'MOTOR',
            options: [
              ['1', '1'],
              ['2', '2'],
              ['3', '3'],
              ['4', '4'],
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
        colour: PWM_COLOUR,
        extensions: ['shape_statement'],
      })
    },
  }

  Blockly.Blocks.viaBanhMi_setServo = {
    init(this: Block) {
      this.jsonInit({
        message0: 'set servo %1 to angle %2',
        args0: [
          {
            type: 'field_dropdown',
            name: 'SERVO',
            options: [
              ['1', '1'],
              ['2', '2'],
              ['3', '3'],
              ['4', '4'],
              ['5', '5'],
              ['6', '6'],
            ],
          },
          { type: 'input_value', name: 'ANGLE', check: 'Number' },
        ],
        colour: PWM_COLOUR,
        extensions: ['shape_statement'],
      })
    },
  }

  Blockly.Blocks.viaBanhMi_initMPU = {
    init(this: Block) {
      this.jsonInit({
        message0: 'init MPU accelerometer range %1 gyro range %2 bandwidth %3',
        args0: [
          {
            type: 'field_dropdown',
            name: 'AR',
            options: [
              ['8G', 'MPU6050_RANGE_8_G'],
              ['2G', 'MPU6050_RANGE_2_G'],
              ['4G', 'MPU6050_RANGE_4_G'],
              ['16G', 'MPU6050_RANGE_16_G'],
            ],
          },
          {
            type: 'field_dropdown',
            name: 'GR',
            options: [
              ['500°/s', 'MPU6050_RANGE_500_DEG'],
              ['250°/s', 'MPU6050_RANGE_250_DEG'],
              ['1000°/s', 'MPU6050_RANGE_1000_DEG'],
              ['2000°/s', 'MPU6050_RANGE_2000_DEG'],
            ],
          },
          {
            type: 'field_dropdown',
            name: 'FB',
            options: [
              ['21Hz', 'MPU6050_BAND_21_HZ'],
              ['260Hz', 'MPU6050_BAND_260_HZ'],
              ['184Hz', 'MPU6050_BAND_184_HZ'],
              ['94Hz', 'MPU6050_BAND_94_HZ'],
              ['44Hz', 'MPU6050_BAND_44_HZ'],
              ['10Hz', 'MPU6050_BAND_10_HZ'],
              ['5Hz', 'MPU6050_BAND_5_HZ'],
            ],
          },
        ],
        colour: MPU_COLOUR,
        extensions: ['shape_statement'],
      })
    },
  }

  Blockly.Blocks.viaBanhMi_mpuReadData = {
    init(this: Block) {
      this.jsonInit({
        message0: 'mpu read data',
        colour: MPU_COLOUR,
        extensions: ['shape_statement'],
      })
    },
  }

  Blockly.Blocks.viaBanhMi_mpuAcceleration = {
    init(this: Block) {
      this.jsonInit({
        message0: 'mpu %1 axis acceleration (m/s^2)',
        args0: [
          {
            type: 'field_dropdown',
            name: 'AXIS',
            options: [
              ['x', 'x'],
              ['y', 'y'],
              ['z', 'z'],
            ],
          },
        ],
        colour: MPU_COLOUR,
        extensions: ['output_number'],
      })
    },
  }

  Blockly.Blocks.viaBanhMi_mpuGyro = {
    init(this: Block) {
      this.jsonInit({
        message0: 'mpu %1 axis rotation (°/s)',
        args0: [
          {
            type: 'field_dropdown',
            name: 'AXIS',
            options: [
              ['x', 'x'],
              ['y', 'y'],
              ['z', 'z'],
            ],
          },
        ],
        colour: MPU_COLOUR,
        extensions: ['output_number'],
      })
    },
  }

  Blockly.Blocks.viaBanhMi_mpuTemperature = {
    init(this: Block) {
      this.jsonInit({
        message0: 'mpu temperature (°C)',
        colour: MPU_COLOUR,
        extensions: ['output_number'],
      })
    },
  }
}
