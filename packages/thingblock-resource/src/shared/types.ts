/**
 * The contract a resource pack implements. These types are authored against `@scratch/scratch-blocks`
 * for build-time checking only; at runtime the editor injects its live Blockly and `arduinoGenerator`
 * instances, and the pack registers against them. Nothing here is bundled into the served output.
 */
import type * as ScratchBlocks from '@scratch/scratch-blocks'

/** The injected Blockly/scratch-blocks module (the editor's live instance). */
export type Blockly = typeof ScratchBlocks

/** The injected Arduino code generator (the editor's shared `arduinoGenerator` singleton). */
export type ArduinoGenerator = ScratchBlocks.ArduinoGenerator

/** The injected Arduino operator-precedence enum (`Order`), passed in because a served pack cannot import it. */
export type ArduinoOrder = typeof ScratchBlocks.ArduinoOrder

/** A pack's `blocks.js` export: define the pack's palette/block shapes on the injected Blockly. */
export type RegisterBlocks = (blockly: Blockly) => void

/** A pack's `generator.js` export: register `forBlock` codegen and cross-cutting fragments. */
export type RegisterGenerators = (generator: ArduinoGenerator, order: ArduinoOrder) => void

/**
 * A localizable string carried as data: the editor's `format-message` singleton resolves it to the
 * active locale (falling back to `default`). The pack ships descriptors, not resolved strings, because
 * a served module cannot share the editor's translation store — it would only ever yield `default`.
 */
export interface LocalizedMessage {
  /** format-message id, e.g. `device.thingbot.description`. */
  id: string
  /** English source string, used as the fallback when no translation is loaded. */
  default: string
  /** Optional note for translators. */
  description?: string
}

/** How a device connects to the host; mirrors the VM's `ConnectionType` enum as data. */
export type ConnectionType = 'serial' | 'ble' | 'usb'

/** A published Arduino library installed by the helper via `arduino-cli lib install`; never vendored. */
export interface RegistryLib {
  name: string
  version: string
}

/** A vendored library under the pack's `libs/` (a path to the library directory or a single source file), resolved from the helper's resource root at compile time. */
export interface LibFile {
  path: string
}

/** Fields shared by every pack manifest. */
interface BaseManifest {
  /** Logical id (e.g. `servo`, `arduinoUno`); the served path is the pack folder name. */
  id: string
  /** Human-readable name. */
  name: string
}

/** A peripheral pack: optional blocks/codegen plus libraries for a component wired to any board. */
export interface PeripheralManifest extends BaseManifest {
  kind: 'peripheral'
  /**
   * Hidden from the peripheral library: the pack is reachable only when a device references it by id. A
   * device-exclusive programming surface is published as a hidden peripheral. Reusable components ("add a
   * servo") omit this flag.
   */
  hidden?: boolean
  /** Relative path to the library-card icon. Optional; the card falls back to a blank thumbnail. */
  icon?: string
  /** Localized blurb for the library card; the VM resolves it via `format-message`. Optional. */
  description?: LocalizedMessage
  /** Relative path to the `registerBlocks` module, when the peripheral exposes palette blocks. */
  blocks?: string
  /** Relative path to the `registerGenerators` module, when the peripheral exposes block codegen. */
  generator?: string
  /** Relative path to the toolbox-category module, when the peripheral exposes palette blocks. */
  toolbox?: string
  /** Published libraries the helper installs via arduino-cli. */
  registryLibs?: RegistryLib[]
  /** Vendored `libs/` sources the helper resolves from its resource root. */
  libs?: LibFile[]
}

/** A device pack: board selection data plus the peripherals (hidden and reusable) it activates. */
export interface DeviceManifest extends BaseManifest {
  kind: 'device'
  /** Fully-qualified board name for arduino-cli (e.g. `arduino:avr:uno`). */
  fqbn: string
  /** Relative path to the board icon. */
  icon: string
  /** Localized blurb for the device-selection card; the VM resolves it via `format-message`. */
  description: LocalizedMessage
  /** Maker/vendor shown on the card (e.g. `thingedu.com`); not localized. */
  manufacturer: string
  /** Connection the card's "Requires" badge reflects. */
  requires: ConnectionType
  /** Optional "learn more" URL for the card. */
  learnMore?: string
  /** Optional help/docs URL for the card. */
  help?: string
  /**
   * Ids of the peripheral packs activated when this device is selected: its own hidden pack plus any
   * reusable components. Order is the board-mode palette order, so the device's own pack comes first.
   */
  extensions?: string[]
  /** arduino-cli compile options. */
  compile?: { options?: Record<string, string> }
  /** Upload/flash configuration. */
  upload?: {
    pnpid?: string[]
    uploadSpeed?: number
  }
}

export type PackManifest = PeripheralManifest | DeviceManifest

/** A shadow block pre-filling a value input in the palette (e.g. an editable number field). */
export interface ShadowSpec {
  /** Shadow block type, e.g. `math_number`. */
  type: string
  /** Field values keyed by field name, e.g. `{ NUM: 0 }`. */
  fields?: Record<string, string | number>
}

/** A block entry in a toolbox category, optionally pre-filling value inputs with shadows. */
export interface ToolboxBlock {
  kind: 'block'
  type: string
  /** Value-input name → shadow block. Keys match the `input_value` names in the block definition. */
  inputs?: Record<string, ShadowSpec>
}

/** A Blockly toolbox category referencing a pack's block types. */
export interface ToolboxCategory {
  kind: 'category'
  name: string
  colour?: string
  contents: ToolboxBlock[]
}
