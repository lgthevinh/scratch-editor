/**
 * Copyright 2026 Scratch Foundation
 * SPDX-License-Identifier: Apache-2.0
 */
import type { Block } from 'blockly/core'
import type { ArduinoGenerator } from '../arduino'
import { Order } from './order'

/**
 * Register Arduino generators for the built-in operator (reporter) blocks.
 * @param gen The Arduino generator to register on.
 */
export function registerOperators(gen: ArduinoGenerator): void {
  const val = (generator: ArduinoGenerator, block: Block, name: string, fallback: string, order = Order.NONE) =>
    generator.valueToCode(block, name, order) || fallback

  const binary =
    (left: string, right: string, op: string, order: Order) =>
    (block: Block, generator: ArduinoGenerator): [string, number] => {
      const a = generator.valueToCode(block, left, order) || '0'
      const b = generator.valueToCode(block, right, order) || '0'
      return [`${a} ${op} ${b}`, order]
    }

  gen.forBlock.operator_add = binary('NUM1', 'NUM2', '+', Order.ADDITIVE)
  gen.forBlock.operator_subtract = binary('NUM1', 'NUM2', '-', Order.ADDITIVE)
  gen.forBlock.operator_multiply = binary('NUM1', 'NUM2', '*', Order.MULTIPLICATIVE)
  gen.forBlock.operator_divide = binary('NUM1', 'NUM2', '/', Order.MULTIPLICATIVE)
  gen.forBlock.operator_lt = binary('OPERAND1', 'OPERAND2', '<', Order.RELATIONAL)
  gen.forBlock.operator_gt = binary('OPERAND1', 'OPERAND2', '>', Order.RELATIONAL)
  gen.forBlock.operator_equals = binary('OPERAND1', 'OPERAND2', '==', Order.EQUALITY)
  gen.forBlock.operator_and = binary('OPERAND1', 'OPERAND2', '&&', Order.LOGICAL_AND)
  gen.forBlock.operator_or = binary('OPERAND1', 'OPERAND2', '||', Order.LOGICAL_OR)

  gen.forBlock.operator_not = (block, generator) => [
    `!${val(generator, block, 'OPERAND', 'false', Order.UNARY)}`,
    Order.UNARY,
  ]

  gen.forBlock.operator_random = (block, generator) => {
    const from = val(generator, block, 'FROM', '0')
    const to = val(generator, block, 'TO', '1')
    return [`random(${from}, ${to} + 1)`, Order.ATOMIC]
  }

  gen.forBlock.operator_join = (block, generator) => {
    const first = val(generator, block, 'STRING1', '""')
    const second = val(generator, block, 'STRING2', '""')
    return [`String(${first}) + String(${second})`, Order.ADDITIVE]
  }

  gen.forBlock.operator_letter_of = (block, generator) => {
    const index = val(generator, block, 'LETTER', '1')
    const string = val(generator, block, 'STRING', '""')
    return [`String(${string}).charAt(${index} - 1)`, Order.ATOMIC]
  }

  gen.forBlock.operator_length = (block, generator) => [
    `String(${val(generator, block, 'STRING', '""')}).length()`,
    Order.ATOMIC,
  ]

  gen.forBlock.operator_contains = (block, generator) => {
    const string = val(generator, block, 'STRING1', '""')
    const search = val(generator, block, 'STRING2', '""')
    return [`String(${string}).indexOf(String(${search})) >= 0`, Order.RELATIONAL]
  }

  gen.forBlock.operator_mod = (block, generator) => {
    const number = val(generator, block, 'NUM1', '0', Order.MULTIPLICATIVE)
    const modulus = val(generator, block, 'NUM2', '1', Order.MULTIPLICATIVE)
    // Floored modulo so a negative dividend matches Scratch's wrap-around result.
    return [`((${number} % ${modulus}) + ${modulus}) % ${modulus}`, Order.MULTIPLICATIVE]
  }

  gen.forBlock.operator_round = (block, generator) => [`round(${val(generator, block, 'NUM', '0')})`, Order.ATOMIC]

  gen.forBlock.operator_mathop = (block, generator) => {
    const operator = String(block.getFieldValue('OPERATOR') ?? 'abs').toLowerCase()
    const number = val(generator, block, 'NUM', '0')
    const cppOperators: Record<string, string> = {
      abs: 'abs',
      floor: 'floor',
      ceiling: 'ceil',
      sqrt: 'sqrt',
      sin: 'sin',
      cos: 'cos',
      tan: 'tan',
      asin: 'asin',
      acos: 'acos',
      atan: 'atan',
      ln: 'log',
      log: 'log10',
    }
    if (operator === 'e ^') return [`exp(${number})`, Order.ATOMIC]
    if (operator === '10 ^') return [`pow(10, ${number})`, Order.ATOMIC]
    return [`${cppOperators[operator] ?? 'abs'}(${number})`, Order.ATOMIC]
  }

  gen.forBlock.operator_tonumber = (block, generator) => [
    `String(${val(generator, block, 'VALUE', '0')}).toFloat()`,
    Order.ATOMIC,
  ]
  gen.forBlock.operator_totext = (block, generator) => [
    `String(${val(generator, block, 'VALUE', '""')})`,
    Order.ATOMIC,
  ]
}
