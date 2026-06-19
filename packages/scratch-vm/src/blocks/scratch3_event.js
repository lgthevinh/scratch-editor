class Scratch3EventBlocks {
    constructor (runtime) {
        /**
         * The runtime instantiating this block package.
         * @type {Runtime}
         */
        this.runtime = runtime;

        this.runtime.on('KEY_PRESSED', key => {
            this.runtime.startHats('event_whenkeypressed', {
                KEY_OPTION: key
            });
            this.runtime.startHats('event_whenkeypressed', {
                KEY_OPTION: 'any'
            });
        });
    }

    /**
     * Retrieve the block primitives implemented by this package.
     * @returns {object.<string, Function>} Mapping of opcode to Function.
     */
    getPrimitives () {
        return {};
    }

    getHats () {
        return {
            event_whenflagclicked: {
                restartExistingThreads: true
            },
            event_whenkeypressed: {
                restartExistingThreads: false
            },
            event_whenarduinobegin: {
                restartExistingThreads: true
            },
            event_whenarduinoloop: {
                restartExistingThreads: true
            }
        };
    }
}

module.exports = Scratch3EventBlocks;
