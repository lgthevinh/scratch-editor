# Scratch VM Codegen

This module generates source code from the VM's current block graph. It is used by the GUI `CodeView` to show Arduino C++ firmware-style code when a board is selected.

## Supported Languages

Language IDs are defined in `language.js`:

- `arduino-cpp`: Arduino C++ mode. Used when a board is selected.

The codegen pipeline is structured around a `language` dimension so additional targets can be added later, but Arduino C++ is currently the only supported language. The GUI calls `vm.generateCode('arduino-cpp')`. In host mode (no board selected) the GUI does not generate code at all; the project runs through the VM interpreter.

A block can be intentionally left unsupported. Unsupported blocks produce a warning diagnostic and an `/* Unsupported block: ... */` statement placeholder. Requesting an unsupported language returns an error diagnostic and empty code.

## High-Level Flow

1. GUI calls `vm.generateCode(language, optTargetId)`.
2. `virtual-machine.js` selects the requested target or the current editing target.
3. `generate-code.js` validates the language and target.
4. A `GeneratorRegistry` is created by `default-registry.js`.
5. `CodeGenerationContext` walks top-level scripts from `target.blocks.getScripts()`.
6. Each block opcode is looked up by `(opcode, language)`.
7. Statement generators emit source lines; expression generators emit source fragments.
8. `generate-code.js` finalizes the result by joining includes, helpers, `setup()`, and `loop()`.

The public result shape is:

```js
{
    language: 'arduino-cpp',
    code: '...',
    diagnostics: []
}
```

Diagnostics use this shape:

```js
{
    severity: 'warning',
    message: 'No arduino-cpp generator registered for someExtension_doThing',
    blockId: 'block1',
    opcode: 'someExtension_doThing'
}
```

## Core Files

- `generate-code.js`: entry point for a target and language.
- `context.js`: block traversal, nested input generation, diagnostics, indentation, helpers/includes/setup storage.
- `generator-registry.js`: maps `(opcode, language)` to a generator.
- `default-registry.js`: registers built-in core generators and extension providers.
- `code-generator-provider.js`: helper API for extension/block-owned generator files.
- `language.js`: language IDs.

## Generator Shape

A generator is either a statement generator or an expression generator:

```js
const statementGenerator = {
    type: 'statement',
    generate: (ctx, block, indentLevel) => '    Serial.println("hello");'
};

const expressionGenerator = {
    type: 'expression',
    generate: (ctx, block) => '42'
};
```

Use `statement()` and `expression()` from `code-generator-provider.js` to create these objects:

```js
const {
    Language,
    expression,
    line,
    statement
} = require('../../codegen/code-generator-provider');

const getCodeGenerators = () => ([{
    opcode: 'myExtension_doThing',
    language: Language.ARDUINO_CPP,
    generator: statement((ctx, block, indentLevel) => (
        line(ctx, indentLevel, 'myExtension.doThing();')
    ))
}, {
    opcode: 'myExtension_value',
    language: Language.ARDUINO_CPP,
    generator: expression(() => 'myExtension.value()')
}]);

module.exports = {
    getCodeGenerators
};
```

## Provider API

Extensions or block packages can expose codegen with `getCodeGenerators()`.

`GeneratorRegistry.registerProvider(provider)` expects:

```js
{
    getCodeGenerators: () => [{
        opcode: 'arduino_digitalWrite',
        language: Language.ARDUINO_CPP,
        generator: statement(...)
    }]
}
```

Each registration has:

- `opcode`: full VM opcode. Extension block opcodes include the extension prefix, for example `arduino_digitalWrite`.
- `language`: one of the IDs from `language.js`.
- `generator`: a statement or expression generator.

The central registry should not own extension opcode behavior. Instead, put extension-specific generator logic near the extension and register the provider from `default-registry.js`.

Current example:

- `extensions/scratch3_arduino/codegen.js` owns the Arduino board codegen.
- `extensions/scratch3_arduino/index.js` exposes `getCodeGenerators()`.
- `default-registry.js` calls `registry.registerProvider(Scratch3Arduino)`.

## Context API

Generators receive a `CodeGenerationContext` instance as `ctx`.

Useful methods:

- `ctx.generateInput(block, inputName, defaultValue)`: generate an expression for an input block or return a fallback.
- `ctx.getFieldValue(block, fieldName, defaultValue)`: read a field value.
- `ctx.getInputBlockId(block, inputName)`: read the connected input/shadow block ID.
- `ctx.generateSubstack(block, inputName, indentLevel)`: generate a branch/substack.
- `ctx.indent(indentLevel)`: return spaces for an indent level.
- `ctx.branchInputName(branchNumber)`: return Scratch branch input names such as `SUBSTACK` or `SUBSTACK2`.
- `ctx.addHelper(code)`: add a unique helper section.
- `ctx.addInclude(code)`: add a unique Arduino include.
- `ctx.addSetup(code)`: add a unique Arduino setup line.
- `ctx.addDiagnostic(severity, message, block)`: add a diagnostic.

`code-generator-provider.js` wraps common operations:

- `arg(ctx, block, name, fallback)`: use connected input if present, otherwise field value.
- `input(ctx, block, name, fallback)`: generate an input expression.
- `field(ctx, block, name, fallback)`: read a field.
- `line(ctx, indentLevel, code)`: prefix code with indentation.
- `quote(value)`: JSON-stringify a value for string literals.

## Adding Codegen For A New Extension

1. Add `codegen.js` next to the extension implementation.
2. Export `getCodeGenerators()`.
3. Register the languages the extension supports.
4. Expose `getCodeGenerators()` from the extension class or constructor export.
5. Add the provider to `default-registry.js`.
6. Add or update focused tests in `test/unit/codegen.js`.

Minimal extension pattern:

```js
// src/extensions/scratch3_example/codegen.js
const {
    Language,
    line,
    statement
} = require('../../codegen/code-generator-provider');

const PREFIX = 'example_';

const getCodeGenerators = () => ([{
    opcode: `${PREFIX}doThing`,
    language: Language.ARDUINO_CPP,
    generator: statement((ctx, block, indentLevel) => (
        line(ctx, indentLevel, 'example.doThing();')
    ))
}]);

module.exports = {
    getCodeGenerators
};
```

```js
// src/extensions/scratch3_example/index.js
const codegen = require('./codegen');

class Scratch3Example {
    getCodeGenerators () {
        return codegen.getCodeGenerators();
    }
}

Scratch3Example.getCodeGenerators = codegen.getCodeGenerators;

module.exports = Scratch3Example;
```

```js
// src/codegen/default-registry.js
const Scratch3Example = require('../extensions/scratch3_example');

// inside createDefaultRegistry()
registry.registerProvider(Scratch3Example);
```

## Testing

Focused codegen tests live in `test/unit/codegen.js`.

Run them from the repo root:

```sh
node packages/scratch-vm/test/unit/codegen.js
```

Run VM lint:

```sh
npm --workspace=packages/scratch-vm run lint
```
