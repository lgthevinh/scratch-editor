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

/** Programming surface loaded with a selected device and hidden from the public extension library. */
export interface DeviceExtensionManifest extends BaseManifest {
  kind: 'deviceExtension'
  /** Device-owned extensions are auto-loaded by device selection, not shown as library entries. */
  hidden: true
  /** Relative path to the `registerBlocks` module. */
  blocks: string
  /** Relative path to the `registerGenerators` module. */
  generator: string
  /** Relative path to the toolbox-category module shown while the owning device is selected. */
  toolbox: string
  /** Published libraries the helper installs via arduino-cli. */
  registryLibs?: RegistryLib[]
  /** Vendored `libs/` sources the helper resolves from its resource root. */
  libs?: LibFile[]
}

/** A peripheral pack: optional blocks/codegen plus libraries for a component wired to any board. */
export interface PeripheralManifest extends BaseManifest {
  kind: 'peripheral'
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

/** A device's hidden extension or reused peripheral reference. */
export type DeviceExtensionRef =
  | {
      kind: 'deviceExtension'
      /** Relative path to a hidden extension manifest inside the device pack. */
      path: string
    }
  | {
      kind: 'peripheral'
      /** Id of a reusable peripheral pack loaded from the resource index. */
      id: string
    }

/** A device pack: board selection data plus the hidden extension exclusive to that device. */
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
  /** Hidden device extensions and reusable peripheral packs associated with this device. */
  extensions?: DeviceExtensionRef[]
  /** arduino-cli compile options. */
  compile?: { options?: Record<string, string> }
  /** Upload/flash configuration. */
  upload?: {
    pnpid?: string[]
    uploadSpeed?: number
  }
}

export type PackManifest = PeripheralManifest | DeviceManifest | DeviceExtensionManifest

/** A Blockly toolbox category referencing a pack's block types. */
export interface ToolboxCategory {
  kind: 'category'
  name: string
  colour?: string
  contents: { kind: 'block'; type: string }[]
}
