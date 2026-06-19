const Blocks = require('../engine/blocks');
const Variable = require('../engine/variable');
const {sanitizeIdentifier} = require('./code-generator-provider');
const {classifyKind, inferVariableTypes} = require('./variable-types');

const DEFAULT_EXPRESSION = '0';

// Build a map of variable name -> explicit value type for variables that carry a valid one.
// Keyed by the sanitized identifier so it matches the names code generators emit. Unrecognized
// types are dropped (falling back to inference) so codegen never emits an arbitrary type string.
const explicitVariableTypes = variables => {
    const types = Object.create(null);
    if (!variables) return types;
    for (const varId in variables) {
        const variable = variables[varId];
        if (variable && Variable.DATA_TYPES.includes(variable.dataType)) {
            types[sanitizeIdentifier(variable.name)] = variable.dataType;
        }
    }
    return types;
};

class CodeGenerationContext {
    constructor (blockContainer, registry, language, variables) {
        this.blockContainer = blockContainer;
        this.registry = registry;
        this.language = language;
        // Explicit types chosen in the variable dialog seed inference: they are locked (never
        // overwritten by assignments) and propagate through `data_variable` references.
        this.variableTypes = inferVariableTypes(blockContainer, explicitVariableTypes(variables));
        this.diagnostics = [];
        this.helpers = [];
        this.includes = [];
        this.setup = [];
        this.setupBlocks = [];
        this._helperSet = Object.create(null);
        this._includeSet = Object.create(null);
        this._setupSet = Object.create(null);
        this._setupBlockSet = Object.create(null);
    }

    addDiagnostic (severity, message, block) {
        this.diagnostics.push({
            severity,
            message,
            blockId: block && block.id,
            opcode: block && block.opcode
        });
    }

    addHelper (code) {
        this._addUnique(this.helpers, this._helperSet, code);
    }

    addInclude (code) {
        this._addUnique(this.includes, this._includeSet, code);
    }

    addSetup (code) {
        this._addUnique(this.setup, this._setupSet, code);
    }

    // Adds a pre-indented multi-line body (e.g. an Arduino "begin" hat) to the setup() function.
    // Unlike addSetup, the body is kept verbatim rather than treated as a single config line.
    addSetupBlock (code) {
        this._addUnique(this.setupBlocks, this._setupBlockSet, code);
    }

    _addUnique (list, set, code) {
        if (!code || set[code]) return;
        set[code] = true;
        list.push(code);
    }

    getBlock (blockId) {
        return blockId ? this.blockContainer.getBlock(blockId) : null;
    }

    // Inferred kind ('int' | 'float' | 'string') of the value produced by a reporter block.
    expressionKind (blockId) {
        return classifyKind(this.blockContainer, this.variableTypes, blockId);
    }

    // Inferred type of a scalar variable by sanitized name. Variables that are never `set`
    // default to 'int'.
    variableType (name) {
        return this.variableTypes[name] || 'int';
    }

    getFieldValue (block, fieldName, defaultValue) {
        if (block && block.fields && block.fields[fieldName]) {
            return block.fields[fieldName].value;
        }
        return defaultValue;
    }

    getInputBlockId (block, inputName) {
        if (!block || !block.inputs || !block.inputs[inputName]) return null;
        const input = block.inputs[inputName];
        return input.block || input.shadow || null;
    }

    generateInput (block, inputName, defaultValue) {
        const inputBlockId = this.getInputBlockId(block, inputName);
        if (!inputBlockId) return defaultValue;
        return this.generateExpression(inputBlockId, defaultValue);
    }

    generateSubstack (block, inputName, indentLevel) {
        return this.generateStack(this.getInputBlockId(block, inputName), indentLevel);
    }

    generateStack (firstBlockId, indentLevel) {
        const lines = [];
        let blockId = firstBlockId;
        while (blockId) {
            const block = this.getBlock(blockId);
            if (!block) {
                this.addDiagnostic('warning', `Missing block ${blockId}`, null);
                break;
            }

            const code = this.generateStatement(blockId, indentLevel);
            if (code) {
                lines.push(code);
            }
            blockId = block.next;
        }
        return lines.join('\n');
    }

    generateTopScript (topBlockId) {
        const block = this.getBlock(topBlockId);
        if (!block) {
            this.addDiagnostic('warning', `Missing top-level block ${topBlockId}`, null);
            return '';
        }
        if (block.opcode && block.opcode.indexOf('event_') === 0) {
            return this.generateStatement(topBlockId, 0);
        }
        return this.generateStack(topBlockId, 0);
    }

    generateStatement (blockId, indentLevel) {
        const block = this.getBlock(blockId);
        if (!block) return '';
        const generator = this.registry.get(block.opcode, this.language);
        if (!generator) {
            this.addDiagnostic(
                'warning',
                `No ${this.language} generator registered for ${block.opcode}`,
                block
            );
            return `${this.indent(indentLevel)}/* Unsupported block: ${block.opcode} */`;
        }
        if (generator.type === 'expression') {
            return `${this.indent(indentLevel)}${generator.generate(this, block)};`;
        }
        return generator.generate(this, block, indentLevel);
    }

    generateExpression (blockId, defaultValue) {
        const block = this.getBlock(blockId);
        if (!block) return defaultValue || DEFAULT_EXPRESSION;
        const generator = this.registry.get(block.opcode, this.language);
        if (!generator) {
            this.addDiagnostic(
                'warning',
                `No ${this.language} generator registered for ${block.opcode}`,
                block
            );
            return defaultValue || DEFAULT_EXPRESSION;
        }
        if (generator.type !== 'expression') {
            this.addDiagnostic(
                'warning',
                `${block.opcode} cannot be used as an expression`,
                block
            );
            return defaultValue || DEFAULT_EXPRESSION;
        }
        return generator.generate(this, block);
    }

    indent (indentLevel) {
        return '    '.repeat(indentLevel || 0);
    }

    branchInputName (branchNumber) {
        return branchNumber > 1 ?
            `${Blocks.BRANCH_INPUT_PREFIX}${branchNumber}` :
            Blocks.BRANCH_INPUT_PREFIX;
    }
}

module.exports = CodeGenerationContext;
