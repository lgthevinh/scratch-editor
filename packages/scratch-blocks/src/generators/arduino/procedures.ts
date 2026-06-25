/**
 * Copyright 2026 Scratch Foundation
 * SPDX-License-Identifier: Apache-2.0
 */
import type { Block } from 'blockly/core'
import type { ArduinoGenerator } from '../arduino'
import { Order } from './order'

/** A procedure block exposes its Scratch proccode. */
interface ProcedureBlock {
  getProcCode(): string
}

/**
 * Register Arduino generators for custom-block calls and argument reporters. The
 * `procedures_definition` hat is emitted as a file-scope function by the engine
 * (see `ArduinoGenerator.workspaceToCode`).
 * @param gen The Arduino generator to register on.
 */
export function registerProcedures(gen: ArduinoGenerator): void {
  gen.forBlock.procedures_call = (block, generator) => {
    const procCode = (block as unknown as ProcedureBlock).getProcCode()
    return `${generator.getProcedureName(procCode)}();`
  }

  const argumentReporter = (block: Block, generator: ArduinoGenerator): [string, Order] => [
    generator.getArgumentName(String(block.getFieldValue('VALUE') ?? 'argument')),
    Order.ATOMIC,
  ]

  gen.forBlock.argument_reporter_string_number = argumentReporter
  gen.forBlock.argument_reporter_boolean = argumentReporter
}
