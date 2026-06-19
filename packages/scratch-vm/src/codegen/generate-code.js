const CodeGenerationContext = require('./context');
const createDefaultRegistry = require('./default-registry');
const Language = require('./language');

const supportedLanguages = [Language.JAVASCRIPT, Language.ARDUINO_CPP];

const finalizeJavaScript = (scripts, context) => {
    const helperCode = context.helpers.join('\n');
    const scriptCode = scripts.filter(Boolean).join('\n\n');
    return [helperCode, scriptCode].filter(Boolean).join('\n\n');
};

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
    if (language === Language.JAVASCRIPT) {
        return finalizeJavaScript(scripts, context);
    }
    if (language === Language.ARDUINO_CPP) {
        return finalizeArduinoCpp(scripts, context);
    }
    return '';
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
    const context = new CodeGenerationContext(target.blocks, registry, language);
    const scripts = target.blocks.getScripts().map(topBlockId => context.generateTopScript(topBlockId));

    return {
        language,
        code: finalize(language, scripts, context),
        diagnostics: context.diagnostics
    };
};

module.exports = generateCode;
