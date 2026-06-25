/**
 * Copyright 2026 Scratch Foundation
 * SPDX-License-Identifier: Apache-2.0
 */
import * as Blockly from 'blockly/core'
import { afterEach, assert, beforeEach, describe, expect, it } from 'vitest'
import { arduinoGenerator } from '../../src/generators/arduino'

// The generator only reads opcodes, inputs, and fields by name, so these minimal
// definitions stand in for the real Scratch blocks (which carry rendering and
// extension machinery the generator never touches).
const BLOCK_TYPES = [
  'event_whenarduinobegin',
  'event_whenarduinoloop',
  'event_whenflagclicked',
  'control_if',
  'control_if_else',
  'control_forever',
  'control_repeat',
  'control_wait',
  'operator_gt',
  'operator_add',
  'operator_multiply',
  'math_number',
  'arduino_digitalWrite',
  'data_setvariableto',
  'sensing_timer',
  'procedures_definition',
  'procedures_prototype',
]

let workspace: Blockly.Workspace

beforeEach(() => {
  Blockly.defineBlocksWithJsonArray([
    { type: 'event_whenarduinobegin', message0: 'when begin', nextStatement: null },
    { type: 'event_whenarduinoloop', message0: 'when loop', nextStatement: null },
    {
      type: 'control_if',
      message0: 'if %1 then %2',
      args0: [
        { type: 'input_value', name: 'CONDITION' },
        { type: 'input_statement', name: 'SUBSTACK' },
      ],
      previousStatement: null,
      nextStatement: null,
    },
    {
      type: 'control_forever',
      message0: 'forever %1',
      args0: [{ type: 'input_statement', name: 'SUBSTACK' }],
      previousStatement: null,
    },
    {
      type: 'control_repeat',
      message0: 'repeat %1 %2',
      args0: [
        { type: 'input_value', name: 'TIMES' },
        { type: 'input_statement', name: 'SUBSTACK' },
      ],
      previousStatement: null,
      nextStatement: null,
    },
    {
      type: 'control_wait',
      message0: 'wait %1',
      args0: [{ type: 'input_value', name: 'DURATION' }],
      previousStatement: null,
      nextStatement: null,
    },
    {
      type: 'operator_gt',
      message0: '%1 > %2',
      args0: [
        { type: 'input_value', name: 'OPERAND1' },
        { type: 'input_value', name: 'OPERAND2' },
      ],
      output: null,
    },
    {
      type: 'operator_add',
      message0: '%1 + %2',
      args0: [
        { type: 'input_value', name: 'NUM1' },
        { type: 'input_value', name: 'NUM2' },
      ],
      output: null,
    },
    {
      type: 'operator_multiply',
      message0: '%1 * %2',
      args0: [
        { type: 'input_value', name: 'NUM1' },
        { type: 'input_value', name: 'NUM2' },
      ],
      output: null,
    },
    {
      type: 'math_number',
      message0: '%1',
      args0: [{ type: 'field_number', name: 'NUM' }],
      output: null,
    },
    {
      type: 'event_whenflagclicked',
      message0: 'when flag clicked',
      nextStatement: null,
    },
    {
      type: 'control_if_else',
      message0: 'if %1 then %2 else %3',
      args0: [
        { type: 'input_value', name: 'CONDITION' },
        { type: 'input_statement', name: 'SUBSTACK' },
        { type: 'input_statement', name: 'SUBSTACK2' },
      ],
      previousStatement: null,
      nextStatement: null,
    },
    {
      type: 'arduino_digitalWrite',
      message0: 'digital write %1 %2',
      args0: [
        { type: 'field_input', name: 'PIN', text: '13' },
        { type: 'field_input', name: 'LEVEL', text: 'HIGH' },
      ],
      previousStatement: null,
      nextStatement: null,
    },
    {
      type: 'data_setvariableto',
      message0: 'set %1 to %2',
      args0: [
        { type: 'field_variable', name: 'VARIABLE', variable: 'temp' },
        { type: 'input_value', name: 'VALUE' },
      ],
      previousStatement: null,
      nextStatement: null,
    },
    {
      type: 'sensing_timer',
      message0: 'timer',
      output: null,
    },
  ])

  // Procedure blocks carry a `getProcCode` method that JSON defs can't express;
  // define them by hand so the generator can read the custom-block name.
  Blockly.Blocks.procedures_prototype = {
    init(this: Blockly.Block) {
      this.jsonInit({ message0: 'prototype', output: null })
    },
    getProcCode() {
      return 'blink'
    },
  }
  Blockly.Blocks.procedures_definition = {
    init(this: Blockly.Block) {
      this.jsonInit({
        message0: 'define %1',
        args0: [{ type: 'input_value', name: 'custom_block' }],
        nextStatement: null,
      })
    },
  }

  workspace = new Blockly.Workspace()
})

afterEach(() => {
  workspace.dispose()
  for (const type of BLOCK_TYPES) delete Blockly.Blocks[type]
})

/**
 * A math_number reporter carrying `value`.
 * @param value The numeric literal the block reports.
 * @returns The new reporter block.
 */
function num(value: number): Blockly.Block {
  const block = workspace.newBlock('math_number')
  block.setFieldValue(value, 'NUM')
  return block
}

/**
 * Plug a reporter's output into a named value input of `parent`.
 * @param parent The block exposing the value input.
 * @param input The value input's name.
 * @param child The reporter block to plug in.
 */
function connectValue(parent: Blockly.Block, input: string, child: Blockly.Block): void {
  const connection = parent.getInput(input)?.connection
  assert(connection, `expected value input ${input}`)
  assert(child.outputConnection, 'expected reporter output')
  connection.connect(child.outputConnection)
}

/**
 * Connect a statement block under a named statement input of `parent`.
 * @param parent The block exposing the statement input.
 * @param input The statement input's name.
 * @param child The statement block to nest.
 */
function connectStatement(parent: Blockly.Block, input: string, child: Blockly.Block): void {
  const connection = parent.getInput(input)?.connection
  assert(connection, `expected statement input ${input}`)
  assert(child.previousConnection, 'expected statement previous connection')
  connection.connect(child.previousConnection)
}

/**
 * Connect a statement block after a hat / another statement via its next connection.
 * @param parent The hat or statement block to connect below.
 * @param child The statement block to attach.
 */
function connectNext(parent: Blockly.Block, child: Blockly.Block): void {
  assert(parent.nextConnection, 'expected next connection')
  assert(child.previousConnection, 'expected previous connection')
  parent.nextConnection.connect(child.previousConnection)
}

describe('ArduinoGenerator', () => {
  it('emits empty setup() and loop() for an empty workspace', () => {
    expect(arduinoGenerator.workspaceToCode(workspace)).toBe('void setup() {\n}\n\nvoid loop() {\n}\n')
  })

  it('routes the begin hat stack into setup() and the loop hat stack into loop()', () => {
    const begin = workspace.newBlock('event_whenarduinobegin')
    const wait1 = workspace.newBlock('control_wait')
    connectValue(wait1, 'DURATION', num(1))
    connectNext(begin, wait1)

    const loop = workspace.newBlock('event_whenarduinoloop')
    const wait2 = workspace.newBlock('control_wait')
    connectValue(wait2, 'DURATION', num(0.5))
    connectNext(loop, wait2)

    expect(arduinoGenerator.workspaceToCode(workspace)).toBe(
      'void setup() {\n  delay(1 * 1000);\n}\n\nvoid loop() {\n  delay(0.5 * 1000);\n}\n',
    )
  })

  it('nests a conditional with a comparison and indents the body', () => {
    const begin = workspace.newBlock('event_whenarduinobegin')
    const ifBlock = workspace.newBlock('control_if')
    const gt = workspace.newBlock('operator_gt')
    connectValue(gt, 'OPERAND1', num(5))
    connectValue(gt, 'OPERAND2', num(3))
    connectValue(ifBlock, 'CONDITION', gt)
    const wait = workspace.newBlock('control_wait')
    connectValue(wait, 'DURATION', num(1))
    connectStatement(ifBlock, 'SUBSTACK', wait)
    connectNext(begin, ifBlock)

    expect(arduinoGenerator.workspaceToCode(workspace)).toBe(
      'void setup() {\n  if (5 > 3) {\n    delay(1 * 1000);\n  }\n}\n\nvoid loop() {\n}\n',
    )
  })

  it('maps forever to a while (true) loop', () => {
    const loop = workspace.newBlock('event_whenarduinoloop')
    const forever = workspace.newBlock('control_forever')
    const wait = workspace.newBlock('control_wait')
    connectValue(wait, 'DURATION', num(1))
    connectStatement(forever, 'SUBSTACK', wait)
    connectNext(loop, forever)

    const code = arduinoGenerator.workspaceToCode(workspace)
    expect(code).toContain('while (true) {')
    expect(code).toContain('delay(1 * 1000);')
  })

  it('gives nested repeat loops distinct counter names', () => {
    const begin = workspace.newBlock('event_whenarduinobegin')
    const outer = workspace.newBlock('control_repeat')
    connectValue(outer, 'TIMES', num(3))
    const inner = workspace.newBlock('control_repeat')
    connectValue(inner, 'TIMES', num(2))
    connectStatement(outer, 'SUBSTACK', inner)
    connectNext(begin, outer)

    const code = arduinoGenerator.workspaceToCode(workspace)
    expect(code).toContain('for (int i0 = 0; i0 < 3; i0++)')
    expect(code).toContain('for (int i1 = 0; i1 < 2; i1++)')
  })

  it('parenthesizes a lower-precedence operand inside a higher-precedence operator', () => {
    const begin = workspace.newBlock('event_whenarduinobegin')
    const wait = workspace.newBlock('control_wait')
    const mul = workspace.newBlock('operator_multiply')
    const add = workspace.newBlock('operator_add')
    connectValue(add, 'NUM1', num(1))
    connectValue(add, 'NUM2', num(2))
    connectValue(mul, 'NUM1', num(3))
    connectValue(mul, 'NUM2', add)
    connectValue(wait, 'DURATION', mul)
    connectNext(begin, wait)

    expect(arduinoGenerator.workspaceToCode(workspace)).toContain('delay((3 * (1 + 2)) * 1000);')
  })

  it('routes the green-flag hat stack into loop()', () => {
    const flag = workspace.newBlock('event_whenflagclicked')
    const wait = workspace.newBlock('control_wait')
    connectValue(wait, 'DURATION', num(1))
    connectNext(flag, wait)

    expect(arduinoGenerator.workspaceToCode(workspace)).toBe(
      'void setup() {\n}\n\nvoid loop() {\n  delay(1 * 1000);\n}\n',
    )
  })

  it('emits the standard Arduino API with unquoted pin and level menus', () => {
    const begin = workspace.newBlock('event_whenarduinobegin')
    const write = workspace.newBlock('arduino_digitalWrite')
    connectNext(begin, write)

    expect(arduinoGenerator.workspaceToCode(workspace)).toContain('digitalWrite(13, HIGH);')
  })

  it('declares a typed variable as a global and assigns it in the body', () => {
    const begin = workspace.newBlock('event_whenarduinobegin')
    const set = workspace.newBlock('data_setvariableto')
    const variableId = String(set.getFieldValue('VARIABLE'))
    // dataType is a Scratch extension; set it directly on the plain test model.
    const model = workspace.getVariableMap().getVariableById(variableId) as { dataType?: string }
    model.dataType = 'float'
    connectValue(set, 'VALUE', num(5))
    connectNext(begin, set)

    const code = arduinoGenerator.workspaceToCode(workspace)
    expect(code).toContain('float temp = 0;')
    expect(code).toContain('temp = 5;')
  })

  it('maps the timer reporter to millis()', () => {
    const loop = workspace.newBlock('event_whenarduinoloop')
    const wait = workspace.newBlock('control_wait')
    connectValue(wait, 'DURATION', workspace.newBlock('sensing_timer'))
    connectNext(loop, wait)

    expect(arduinoGenerator.workspaceToCode(workspace)).toContain('millis() / 1000.0')
  })

  it('emits a procedures_definition as a file-scope function', () => {
    const define = workspace.newBlock('procedures_definition')
    const prototype = workspace.newBlock('procedures_prototype')
    connectValue(define, 'custom_block', prototype)
    const wait = workspace.newBlock('control_wait')
    connectValue(wait, 'DURATION', num(1))
    connectNext(define, wait)

    const code = arduinoGenerator.workspaceToCode(workspace)
    expect(code).toContain('void blink() {')
    expect(code).toContain('delay(1 * 1000);')
    // The function is file-scope: it precedes setup().
    expect(code.indexOf('void blink()')).toBeLessThan(code.indexOf('void setup()'))
  })
})
