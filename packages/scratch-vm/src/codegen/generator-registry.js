class GeneratorRegistry {
    constructor () {
        this._generators = Object.create(null);
    }

    register (opcode, language, generator) {
        if (!opcode) {
            throw new Error('GeneratorRegistry.register: missing opcode');
        }
        if (!language) {
            throw new Error('GeneratorRegistry.register: missing language');
        }
        if (!generator || typeof generator.generate !== 'function') {
            throw new Error(`GeneratorRegistry.register: missing generator for ${opcode}`);
        }

        if (!this._generators[opcode]) {
            this._generators[opcode] = Object.create(null);
        }
        this._generators[opcode][language] = generator;
    }

    registerProvider (provider) {
        if (!provider || typeof provider.getCodeGenerators !== 'function') {
            throw new Error('GeneratorRegistry.registerProvider: provider must implement getCodeGenerators');
        }

        const registrations = provider.getCodeGenerators();
        if (!Array.isArray(registrations)) {
            throw new Error('GeneratorRegistry.registerProvider: getCodeGenerators must return an array');
        }

        for (const registration of registrations) {
            this.register(registration.opcode, registration.language, registration.generator);
        }
    }

    get (opcode, language) {
        const languageGenerators = this._generators[opcode];
        return languageGenerators && languageGenerators[language];
    }
}

module.exports = GeneratorRegistry;
