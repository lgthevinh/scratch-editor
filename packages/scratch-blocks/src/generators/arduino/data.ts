/**
 * Copyright 2026 Scratch Foundation
 * SPDX-License-Identifier: Apache-2.0
 */
import type { Block } from 'blockly/core'
import type { ArduinoGenerator } from '../arduino'
import { Order } from './order'

/**
 * Register Arduino generators for the built-in data blocks: scalar variables and
 * lists.
 * @param gen The Arduino generator to register on.
 */
export function registerData(gen: ArduinoGenerator): void {
  // Declare each scalar variable once, as a hoisted global, using its explicit
  // Scratch type. Repeated set/change blocks then become plain assignments.
  const ensureVariable = (generator: ArduinoGenerator, block: Block): string => {
    const id = String(block.getFieldValue('VARIABLE'))
    const name = generator.getVariableName(id)
    const cppType = generator.variableCppType(block, id)
    const init = cppType === 'String' ? '""' : '0'
    generator.globals.set(`var_${name}`, `${cppType} ${name} = ${init};`)
    return name
  }

  const listName = (generator: ArduinoGenerator, block: Block) =>
    generator.getVariableName(String(block.getFieldValue('LIST')))

  // A `set` value matching the variable's type. The set block's literal shadow is
  // a text field; for a numeric variable, unwrap a numeric literal to a bare
  // number rather than a quoted string.
  const typedSetValue = (generator: ArduinoGenerator, block: Block, cppType: string): string => {
    if (cppType !== 'String') {
      const valueBlock = block.getInputTargetBlock('VALUE')
      if (valueBlock?.type === 'text') {
        const raw = String(valueBlock.getFieldValue('TEXT') ?? '0').trim()
        return raw !== '' && Number.isFinite(Number(raw)) ? raw : '0'
      }
    }
    return generator.valueToCode(block, 'VALUE', Order.NONE) || (cppType === 'String' ? '""' : '0')
  }

  gen.forBlock.data_variable = (block, generator) => [ensureVariable(generator, block), Order.ATOMIC]

  gen.forBlock.data_setvariableto = (block, generator) => {
    const id = String(block.getFieldValue('VARIABLE'))
    const name = ensureVariable(generator, block)
    return `${name} = ${typedSetValue(generator, block, generator.variableCppType(block, id))};`
  }

  gen.forBlock.data_changevariableby = (block, generator) => {
    const name = ensureVariable(generator, block)
    const value = generator.valueToCode(block, 'VALUE', Order.NONE) || '0'
    return `${name} += ${value};`
  }

  // Lists keep an array-style preview (full C++ array support is a follow-up).
  gen.forBlock.data_listcontents = (block, generator) => [listName(generator, block), Order.ATOMIC]

  gen.forBlock.data_addtolist = (block, generator) =>
    `${listName(generator, block)}.push(${generator.valueToCode(block, 'ITEM', Order.NONE) || '0'});`

  gen.forBlock.data_deleteoflist = (block, generator) =>
    `${listName(generator, block)}.splice(${generator.valueToCode(block, 'INDEX', Order.ADDITIVE) || '1'} - 1, 1);`

  gen.forBlock.data_deletealloflist = (block, generator) => `${listName(generator, block)}.length = 0;`

  gen.forBlock.data_insertatlist = (block, generator) => {
    const list = listName(generator, block)
    const index = generator.valueToCode(block, 'INDEX', Order.ADDITIVE) || '1'
    const item = generator.valueToCode(block, 'ITEM', Order.NONE) || '0'
    return `${list}.splice(${index} - 1, 0, ${item});`
  }

  gen.forBlock.data_replaceitemoflist = (block, generator) => {
    const list = listName(generator, block)
    const index = generator.valueToCode(block, 'INDEX', Order.ADDITIVE) || '1'
    const item = generator.valueToCode(block, 'ITEM', Order.NONE) || '0'
    return `${list}[${index} - 1] = ${item};`
  }

  gen.forBlock.data_itemoflist = (block, generator) => [
    `${listName(generator, block)}[${generator.valueToCode(block, 'INDEX', Order.ADDITIVE) || '1'} - 1]`,
    Order.ATOMIC,
  ]

  gen.forBlock.data_itemnumoflist = (block, generator) => [
    `${listName(generator, block)}.indexOf(${generator.valueToCode(block, 'ITEM', Order.NONE) || '0'}) + 1`,
    Order.ADDITIVE,
  ]

  gen.forBlock.data_lengthoflist = (block, generator) => [`${listName(generator, block)}.length`, Order.ATOMIC]

  gen.forBlock.data_listcontainsitem = (block, generator) => [
    `${listName(generator, block)}.includes(${generator.valueToCode(block, 'ITEM', Order.NONE) || '0'})`,
    Order.ATOMIC,
  ]

  // Monitor visibility has no firmware meaning.
  gen.forBlock.data_showvariable = () => '/* show variable monitor */'
  gen.forBlock.data_hidevariable = () => '/* hide variable monitor */'
  gen.forBlock.data_showlist = () => '/* show list monitor */'
  gen.forBlock.data_hidelist = () => '/* hide list monitor */'
}
