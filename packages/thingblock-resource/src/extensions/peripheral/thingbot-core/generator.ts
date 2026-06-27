/**
 * ThingBot C3 Arduino codegen using the editor's shared generator buckets. The PS2 block relies on the
 * separate PS2 peripheral for `PS2X_lib.h`.
 */
import type { Block } from '@scratch/scratch-blocks'
import type { RegisterGenerators } from '../../../shared/types'

export const registerGenerators: RegisterGenerators = (generator, Order) => {
  const fieldValue = (block: Block, name: string, fallback: string): string => {
    const value: unknown = block.getFieldValue(name)
    return typeof value === 'string' ? value : fallback
  }

  generator.forBlock.thingBotC3_init = () => {
    generator.includes.set('thingbot_pwm', '#include <Wire.h>\n#include <Adafruit_PWMServoDriver.h>')
    generator.globals.set(
      'thingbot_pins',
      [
        '#define M1_A 2',
        '#define M1_B 3',
        '#define M2_A 4',
        '#define M2_B 5',
        '#define M3_A 7',
        '#define M3_B 6',
        '#define M4_A 1',
        '#define M4_B 0',
        '#define SERVO_1 12',
        '#define SERVO_2 11',
        '#define SERVO_3 10',
        '#define SERVO_4 9',
        '#define SERVO_5 8',
        '#define BUZZER 14',
        '#define SW 3',
        '#define LED_1 15',
        '#define LED_2 13',
      ].join('\n'),
    )
    generator.globals.set('thingbot_pwm', 'Adafruit_PWMServoDriver pwm = Adafruit_PWMServoDriver();')
    generator.globals.set(
      'thingbot_map_to_pulse',
      'int mapToPulse(int value) {\n\treturn map(min(100, max(0, value)), 0, 100, 0, 4095);\n}',
    )
    return 'pwm.begin();\npwm.setOscillatorFrequency(27000000);\npwm.setPWMFreq(50);\npinMode(SW, INPUT);\n'
  }

  generator.forBlock.thingBotC3_setMotor = (block) => {
    const motor = fieldValue(block, 'MOTOR', '1')
    const direction = fieldValue(block, 'DIRECTION', 'forward')
    const speed = generator.valueToCode(block, 'SPEED', Order.ATOMIC) || '0'
    if (direction === 'forward') {
      return `pwm.setPWM(M${motor}_A, 0, 0);\npwm.setPWM(M${motor}_B, 0, mapToPulse(${speed}));\n`
    }
    return `pwm.setPWM(M${motor}_A, 0, mapToPulse(${speed}));\npwm.setPWM(M${motor}_B, 0, 0);\n`
  }

  generator.forBlock.thingBotC3_setServo = (block) => {
    const servo = fieldValue(block, 'SERVO', '1')
    const pulse = generator.valueToCode(block, 'PULSE', Order.ATOMIC) || '0'
    return `pwm.setPWM(SERVO_${servo}, 0, ${pulse});\n`
  }

  generator.forBlock.thingBotC3_buzzer = (block) => {
    const sound = generator.valueToCode(block, 'SOUND', Order.ATOMIC) || '0'
    return `pwm.setPin(BUZZER, 0, ${sound});\n`
  }

  generator.forBlock.thingBotC3_setLed = (block) => {
    const led = fieldValue(block, 'LED', 'LED_1')
    const brightness = generator.valueToCode(block, 'BRIGHTNESS', Order.ATOMIC) || '0'
    return `pwm.setPin(${led}, mapToPulse(${brightness}));\n`
  }

  generator.forBlock.thingBotC3_initPS2 = () => {
    generator.includes.set('ps2x_include', '#include <PS2X_lib.h>')
    generator.globals.set(
      'thingbot_ps2_pins',
      [
        '#define PS2_DAT 7   // DIN',
        '#define PS2_CMD 2   // DOUT',
        '#define PS2_SEL 10  // CS',
        '#define PS2_CLK 6   // CLK',
        '#define pressures false',
        '#define rumble false',
      ].join('\n'),
    )
    generator.globals.set('ps2x_instance', 'PS2X ps2x;')
    generator.globals.set('thingbot_ps2_config', 'int error = 1;\nint tryNum = 1;')
    return [
      'while (error != 0) {',
      '\tdelay(1000);',
      '\terror = ps2x.config_gamepad(PS2_CLK, PS2_CMD, PS2_SEL, PS2_DAT, pressures, rumble);',
      '\tSerial.print("#try config ");',
      '\tSerial.println(tryNum);',
      '\ttryNum++;',
      '}',
      '',
    ].join('\n')
  }

  generator.forBlock.thingBotC3_switch = () => ['!digitalRead(SW)', Order.ATOMIC]
}
