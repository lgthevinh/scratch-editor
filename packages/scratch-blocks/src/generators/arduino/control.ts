/**
 * Copyright 2026 Scratch Foundation
 * SPDX-License-Identifier: Apache-2.0
 */
import type { Block } from 'blockly/core'
import type { ArduinoGenerator } from '../arduino'
import { Order } from './order'

/** Declaration for the Scratch counter the counter blocks share. */
const COUNTER_GLOBAL = ['__scratchCounter', 'int __scratchCounter = 0;'] as const

/**
 * Register Arduino generators for the built-in control blocks: the C-shaped
 * loops/conditionals, timed waits, stop, and the counter blocks.
 * @param gen The Arduino generator to register on.
 */
export function registerControl(gen: ArduinoGenerator): void {
  const cond = (generator: ArduinoGenerator, block: Block) =>
    generator.valueToCode(block, 'CONDITION', Order.NONE) || 'false'

  gen.forBlock.control_if = (block, generator) => {
    const branch = generator.statementToCode(block, 'SUBSTACK')
    return `if (${cond(generator, block)}) {\n${branch}\n}`
  }

  gen.forBlock.control_if_else = (block, generator) => {
    const thenBranch = generator.statementToCode(block, 'SUBSTACK')
    const elseBranch = generator.statementToCode(block, 'SUBSTACK2')
    return `if (${cond(generator, block)}) {\n${thenBranch}\n} else {\n${elseBranch}\n}`
  }

  gen.forBlock.control_forever = (block, generator) => {
    const branch = generator.statementToCode(block, 'SUBSTACK')
    return `while (true) {\n${branch}\n}`
  }

  gen.forBlock.control_repeat = (block, generator) => {
    const times = generator.valueToCode(block, 'TIMES', Order.RELATIONAL) || '0'
    const i = generator.nextLoopVar()
    const branch = generator.statementToCode(block, 'SUBSTACK')
    return `for (int ${i} = 0; ${i} < ${times}; ${i}++) {\n${branch}\n}`
  }

  gen.forBlock.control_repeat_until = (block, generator) => {
    const branch = generator.statementToCode(block, 'SUBSTACK')
    return `while (!(${cond(generator, block)})) {\n${branch}\n}`
  }

  gen.forBlock.control_while = (block, generator) => {
    const branch = generator.statementToCode(block, 'SUBSTACK')
    return `while (${cond(generator, block)}) {\n${branch}\n}`
  }

  gen.forBlock.control_for_each = (block, generator) => {
    const variable = generator.getVariableName(String(block.getFieldValue('VARIABLE')))
    const value = generator.valueToCode(block, 'VALUE', Order.RELATIONAL) || '0'
    const branch = generator.statementToCode(block, 'SUBSTACK')
    return `for (int ${variable} = 1; ${variable} <= ${value}; ${variable}++) {\n${branch}\n}`
  }

  gen.forBlock.control_all_at_once = (block, generator) => generator.statementToCode(block, 'SUBSTACK')

  // Scratch waits are in seconds; Arduino's delay() is in milliseconds.
  gen.forBlock.control_wait = (block, generator) => {
    const duration = generator.valueToCode(block, 'DURATION', Order.MULTIPLICATIVE) || '0'
    return `delay(${duration} * 1000);`
  }

  gen.forBlock.control_wait_until = (block, generator) => `while (!(${cond(generator, block)})) { delay(16); }`

  gen.forBlock.control_stop = (block) => `return; /* stop ${block.getFieldValue('STOP_OPTION') ?? 'this script'} */`

  gen.forBlock.control_clear_counter = (_block, generator) => {
    generator.globals.set(...COUNTER_GLOBAL)
    return '__scratchCounter = 0;'
  }
  gen.forBlock.control_incr_counter = (_block, generator) => {
    generator.globals.set(...COUNTER_GLOBAL)
    return '__scratchCounter++;'
  }
  gen.forBlock.control_get_counter = (_block, generator) => {
    generator.globals.set(...COUNTER_GLOBAL)
    return ['__scratchCounter', Order.ATOMIC]
  }

  gen.forBlock.control_print = (block, generator) => {
    generator.setups.set('Serial.begin', 'Serial.begin(9600);')
    const value = generator.valueToCode(block, 'STRING', Order.NONE) || '""'
    return `Serial.println(${value});`
  }
}
