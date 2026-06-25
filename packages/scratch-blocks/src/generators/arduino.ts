/**
 * Copyright 2026 Scratch Foundation
 * SPDX-License-Identifier: Apache-2.0
 */
import * as Blockly from 'blockly/core'
import type { Block, Workspace } from 'blockly/core'
import { registerArduinoApi } from './arduino/arduino-api'
import { registerControl } from './arduino/control'
import { registerData } from './arduino/data'
import { registerOperators } from './arduino/operators'
import { registerProcedures } from './arduino/procedures'
import { registerSensing } from './arduino/sensing'
import { registerValues } from './arduino/values'

/** Name-database category for custom-block argument reporters. */
const ARGUMENT_NAME_TYPE = 'ARGUMENT'

/**
 * C++/Arduino identifiers a generated variable, list, or procedure name must
 * never collide with. `nameDB_` appends a suffix when a sanitized Scratch name
 * lands on one of these.
 */
const RESERVED_WORDS = [
  // C++ keywords (subset relevant to generated code).
  'auto,bool,break,case,char,class,const,continue,default,delete,do,double,else,enum,extern,false,',
  'float,for,goto,if,inline,int,long,namespace,new,operator,private,protected,public,register,return,',
  'short,signed,sizeof,static,struct,switch,template,this,true,typedef,union,unsigned,void,volatile,while,',
  // Arduino core API and constants.
  'setup,loop,pinMode,digitalWrite,digitalRead,analogWrite,analogRead,delay,delayMicroseconds,millis,',
  'micros,map,constrain,random,randomSeed,Serial,String,HIGH,LOW,INPUT,OUTPUT,INPUT_PULLUP,LED_BUILTIN,',
  // Identifiers this generator emits itself.
  '__scratchCounter',
].join('')

/** A variable model carrying Scratch's optional explicit value type. */
interface ScratchVariable {
  dataType?: string
}

/**
 * Arduino (C++) code generator for Scratch firmware blocks. It is the standard
 * Blockly `CodeGenerator` engine — recursion (`valueToCode`/`statementToCode`),
 * precedence (the `Order` constants), statement chaining (`scrub_`), and the
 * `nameDB_` identifier database — with an Arduino backend on top: one function
 * per block on `forBlock`, plus three keyed buckets that collect the
 * cross-cutting fragments a block needs once (`#include`s, file-scope
 * declarations, and `setup()` statements). Keying the buckets means N blocks
 * asking for the same include or object collapse to one entry.
 *
 * A firmware program is anchored by hat blocks: the stack under
 * `event_whenarduinobegin` becomes `setup()`; the stacks under
 * `event_whenarduinoloop` and `event_whenflagclicked` become `loop()`; each
 * `procedures_definition` becomes a file-scope function. Loose blocks under no
 * hat are ignored, matching the Arduino model where all code lives in one of
 * these.
 */
export class ArduinoGenerator extends Blockly.CodeGenerator {
  /** `#include` directives, keyed so duplicates collapse to one line. */
  readonly includes = new Map<string, string>()
  /** File-scope declarations (objects, globals, functions), keyed so duplicates collapse. */
  readonly globals = new Map<string, string>()
  /** Statements to run once in `setup()`, keyed so duplicates collapse. */
  readonly setups = new Map<string, string>()
  /** Source of unique loop-counter names within a single generation pass. */
  private repeatCount = 0

  constructor() {
    super('Arduino')
    this.addReservedWords(RESERVED_WORDS)
    registerValues(this)
    registerOperators(this)
    registerControl(this)
    registerData(this)
    registerProcedures(this)
    registerArduinoApi(this)
    registerSensing(this)
  }

  /**
   * A distinct loop-variable name, so nested counted loops don't collide.
   * @returns The next unique counter name.
   */
  nextLoopVar(): string {
    return `i${this.repeatCount++}`
  }

  /**
   * A C++ double-quoted, escaped string literal. `JSON.stringify` produces
   * exactly that for a string.
   * @param value The value to quote.
   * @returns The C++ string literal.
   */
  quote_(value: string): string {
    return JSON.stringify(String(value))
  }

  /**
   * The sanitized, collision-free identifier for a custom-block argument
   * reporter, drawn from the same name database as variables.
   * @param name The raw argument name.
   * @returns The C++ identifier.
   */
  getArgumentName(name: string): string {
    if (!this.nameDB_) throw new Error('ArduinoGenerator.getArgumentName called outside a generation pass')
    return this.nameDB_.getName(name, ARGUMENT_NAME_TYPE)
  }

  /**
   * The C++ type to declare a variable with, from its Scratch data type.
   * @param block A block referencing the variable (for its workspace).
   * @param variableId The variable's id (from a `field_variable`).
   * @returns 'int' | 'float' | 'String'.
   */
  variableCppType(block: Block, variableId: string): string {
    // dataType is a Scratch extension on the variable model; default to int.
    const model = block.workspace.getVariableMap().getVariableById(variableId) as ScratchVariable | null
    if (model?.dataType === 'string') return 'String'
    if (model?.dataType === 'float') return 'float'
    return 'int'
  }

  /**
   * Reset per-pass state so a generator reused across runs never leaks fragments
   * or names from a previous sketch, and rebuild the name database from the
   * workspace's variables.
   * @param workspace The workspace about to be generated.
   */
  init(workspace: Workspace): void {
    super.init(workspace)
    this.includes.clear()
    this.globals.clear()
    this.setups.clear()
    this.repeatCount = 0

    if (!this.nameDB_) this.nameDB_ = new Blockly.Names(this.RESERVED_WORDS_)
    else this.nameDB_.reset()
    this.nameDB_.setVariableMap(workspace.getVariableMap())
    this.nameDB_.populateVariables(workspace)
  }

  /**
   * Generate a complete `.ino` from a workspace: route the hat stacks into
   * `setup()` / `loop()` / file-scope functions, then assemble the buckets and
   * bodies into a sketch.
   * @param workspace The workspace to generate from.
   * @returns The generated Arduino source.
   */
  workspaceToCode(workspace?: Workspace): string {
    if (!workspace) throw new Error('ArduinoGenerator.workspaceToCode requires a workspace')
    this.init(workspace)

    let setupCode = ''
    let loopCode = ''
    for (const hat of workspace.getTopBlocks(true)) {
      if (hat.type === 'procedures_definition') {
        this.emitProcedureDefinition(hat)
        continue
      }
      const stack = hat.getNextBlock()
      if (!stack) continue
      if (hat.type === 'event_whenarduinobegin') {
        setupCode += this.blockToCodeString(stack)
      } else if (hat.type === 'event_whenarduinoloop' || hat.type === 'event_whenflagclicked') {
        loopCode += this.blockToCodeString(stack)
      }
    }
    return this.assemble(setupCode, loopCode)
  }

  /**
   * Emit a `procedures_definition` hat as a file-scope `void` function in the
   * `globals` bucket. Scratch custom blocks are parameterless in firmware, so
   * only the name and body are generated.
   * @param hat The `procedures_definition` top block.
   */
  private emitProcedureDefinition(hat: Block): void {
    const prototype = hat.getInputTargetBlock('custom_block') as { getProcCode?: () => string } | null
    const procCode = prototype?.getProcCode?.() ?? 'custom_block'
    const name = this.getProcedureName(procCode)
    const next = hat.getNextBlock()
    const body = next ? this.blockToCodeString(next) : ''
    const indented = body ? `${this.prefixLines(body, this.INDENT)}\n` : ''
    this.globals.set(`proc_${name}`, `void ${name}() {\n${indented}}`)
  }

  /**
   * Append the following block's code to a statement's own code; this is what
   * turns a connected stack into sequential lines.
   * @param block The current block.
   * @param code The code generated for `block`.
   * @param thisOnly When true, do not append the next block.
   * @returns The block's code, followed by the rest of its stack.
   */
  scrub_(block: Block, code: string, thisOnly = false): string {
    const next = block.nextConnection?.targetBlock()
    if (next && !thisOnly) return `${code}\n${this.blockToCodeString(next)}`
    return code
  }

  /**
   * `blockToCode` narrowed to a string (drops a reporter's precedence).
   * @param block The block to generate code for.
   * @returns The block's generated code.
   */
  blockToCodeString(block: Block): string {
    const code = this.blockToCode(block)
    return typeof code === 'string' ? code : code[0]
  }

  /**
   * Compose the include/global buckets and the two bodies into one sketch.
   * @param setupCode The generated body of the begin-hat stack.
   * @param loopCode The generated body of the loop/flag-hat stacks.
   * @returns The complete Arduino source.
   */
  private assemble(setupCode: string, loopCode: string): string {
    const sections: string[] = []
    if (this.includes.size) sections.push([...this.includes.values()].join('\n'))
    if (this.globals.size) sections.push([...this.globals.values()].join('\n\n'))

    // Bucketed setup statements and the begin-hat stack both start at column 0,
    // so the whole body is indented one level here. Nested substacks were
    // already indented by `statementToCode`, so per-line prefixing composes.
    const setupBody = [...this.setups.values(), setupCode].filter((line) => line.length > 0).join('\n')
    sections.push(`void setup() {\n${setupBody ? `${this.prefixLines(setupBody, this.INDENT)}\n` : ''}}`)
    sections.push(`void loop() {\n${loopCode ? `${this.prefixLines(loopCode, this.INDENT)}\n` : ''}}`)

    return `${sections.join('\n\n')}\n`
  }
}

/** The shared Arduino generator, with all built-in block generators registered. */
export const arduinoGenerator = new ArduinoGenerator()
