/**
 * Copyright 2026 Scratch Foundation
 * SPDX-License-Identifier: Apache-2.0
 */
import type { Block } from 'blockly/core'
import type { ArduinoGenerator } from '../arduino'
import { Order } from './order'

/**
 * Register Arduino generators for the standard Arduino API — the digital/analog
 * pin blocks shared by every Arduino-compatible board. These are built in rather
 * than pack-provided because they are universal to the platform.
 * @param gen The Arduino generator to register on.
 */
export function registerArduinoApi(gen: ArduinoGenerator): void {
  // Pin mode and level menus are C++ identifiers (OUTPUT, HIGH, …), so a
  // connected value input is read as an expression and a bare field is emitted
  // unquoted. The name may be either a value input or a field depending on the
  // block, so resolve whichever is present.
  const arg = (generator: ArduinoGenerator, block: Block, name: string, fallback: string) => {
    if (block.getInput(name)) return generator.valueToCode(block, name, Order.NONE) || fallback
    return String(block.getFieldValue(name) ?? fallback)
  }

  const command = (opcode: string, cpp: (generator: ArduinoGenerator, block: Block) => string) => {
    gen.forBlock[opcode] = (block, generator) => `${cpp(generator, block)};`
  }
  const reporter = (opcode: string, cpp: (generator: ArduinoGenerator, block: Block) => string) => {
    gen.forBlock[opcode] = (block, generator) => [cpp(generator, block), Order.ATOMIC]
  }

  command('arduino_pinMode', (g, b) => `pinMode(${arg(g, b, 'PIN', '13')}, ${arg(g, b, 'MODE', 'OUTPUT')})`)
  command('arduino_digitalWrite', (g, b) => `digitalWrite(${arg(g, b, 'PIN', '13')}, ${arg(g, b, 'LEVEL', 'HIGH')})`)
  reporter('arduino_digitalRead', (g, b) => `digitalRead(${arg(g, b, 'PIN', '2')})`)
  command('arduino_analogWrite', (g, b) => `analogWrite(${arg(g, b, 'PIN', '9')}, ${arg(g, b, 'VALUE', '128')})`)
  reporter('arduino_analogRead', (g, b) => `analogRead(${arg(g, b, 'PIN', '0')})`)
  command('arduino_delay', (g, b) => `delay(${arg(g, b, 'MS', '1000')})`)
}
