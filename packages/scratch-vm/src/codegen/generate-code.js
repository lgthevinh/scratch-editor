const CodeGenerationContext = require('./context');
const createDefaultRegistry = require('./default-registry');
const Language = require('./language');

const supportedLanguages = [Language.ARDUINO_CPP];

const finalizeArduinoCpp = (scripts, context) => {
    const includes = context.includes.join('\n');
    const helpers = context.helpers.join('\n\n');
    const setupConfig = context.setup.map(line => `    ${line}`).join('\n');
    const setupBlocks = context.setupBlocks.join('\n\n');
    const setupBody = [setupConfig, setupBlocks].filter(Boolean).join('\n');
    const loopBody = scripts.filter(Boolean).join('\n\n');
    const sections = [
        includes,
        helpers,
        `void setup() {\n${setupBody}\n}`,
        `void loop() {\n${loopBody}\n}`
    ];
    return sections.filter(Boolean).join('\n\n');
};

const finalize = (language, scripts, context) => {
    if (language === Language.ARDUINO_CPP) {
        return finalizeArduinoCpp(scripts, context);
    }
    return '';
};

// Variables a target can reference: its own (local) variables plus the stage's global variables.
// Global variables (including their explicit dataType) live on the stage, not the editing target,
// so the stage must be merged in for codegen to know their types. Local variables take precedence.
const collectVariables = target => {
    const stage = target.runtime && target.runtime.getTargetForStage && target.runtime.getTargetForStage();
    const stageVariables = stage && stage !== target && stage.variables;
    if (!stageVariables) return target.variables;
    return Object.assign({}, stageVariables, target.variables);
};

const generateCode = (target, language, optRegistry) => {
    if (supportedLanguages.indexOf(language) === -1) {
        return {
            language,
            code: '',
            diagnostics: [{
                severity: 'error',
                message: `Unsupported code generation language: ${language}`
            }]
        };
    }

    if (!target || !target.blocks) {
        return {
            language,
            code: '',
            diagnostics: [{
                severity: 'error',
                message: 'generateCode: missing target blocks'
            }]
        };
    }

    const registry = optRegistry || createDefaultRegistry();
    const context = new CodeGenerationContext(target.blocks, registry, language, collectVariables(target));
    const scripts = target.blocks.getScripts().map(topBlockId => context.generateTopScript(topBlockId));

    return {
        language,
        code: finalize(language, scripts, context),
        diagnostics: context.diagnostics
    };
};

module.exports = generateCode;
