const Cast = require('../util/cast');
const Timer = require('../util/timer');
const getMonitorIdForBlockWithArgs = require('../util/get-monitor-id');

class Scratch3SensingBlocks {
    constructor (runtime) {
        /**
         * The runtime instantiating this block package.
         * @type {Runtime}
         */
        this.runtime = runtime;

        /**
         * The "answer" block value.
         * @type {string}
         */
        this._answer = '';

        /**
         * The timer utility.
         * @type {Timer}
         */
        this._timer = new Timer();

        /**
         * The list of queued questions and respective `resolve` callbacks.
         * @type {!Array}
         */
        this._questionList = [];

        this.runtime.on('ANSWER', this._onAnswer.bind(this));
        this.runtime.on('PROJECT_START', this._resetAnswer.bind(this));
        this.runtime.on('PROJECT_STOP_ALL', this._clearAllQuestions.bind(this));
        this.runtime.on('STOP_FOR_TARGET', this._clearTargetQuestions.bind(this));
        this.runtime.on('RUNTIME_DISPOSED', this._resetAnswer.bind(this));
    }

    /**
     * Retrieve the block primitives implemented by this package.
     * @returns {object.<string, Function>} Mapping of opcode to Function.
     */
    getPrimitives () {
        return {
            sensing_timer: this.getTimer,
            sensing_resettimer: this.resetTimer,
            sensing_mousex: this.getMouseX,
            sensing_mousey: this.getMouseY,
            sensing_mousedown: this.getMouseDown,
            sensing_keypressed: this.getKeyPressed,
            sensing_current: this.current,
            sensing_dayssince2000: this.daysSince2000,
            sensing_askandwait: this.askAndWait,
            sensing_answer: this.getAnswer,
            sensing_online: this.getOnline
        };
    }

    getMonitored () {
        return {
            sensing_answer: {
                getId: () => 'answer'
            },
            sensing_online: {
                getId: () => 'online'
            },
            sensing_timer: {
                getId: () => 'timer'
            },
            sensing_current: {
                // This is different from the default toolbox xml id in order to support
                // importing multiple monitors from the same opcode from sb2 files,
                // something that is not currently supported in scratch 3.
                getId: (_, fields) => getMonitorIdForBlockWithArgs('current', fields) // _${param}`
            }
        };
    }

    _onAnswer (answer) {
        this._answer = answer;
        const questionObj = this._questionList.shift();
        if (questionObj) {
            const [_question, resolve, target, wasVisible, wasStage] = questionObj;
            // If the target was visible when asked, hide the say bubble unless the target was the stage.
            if (wasVisible && !wasStage) {
                this.runtime.emit('SAY', target, 'say', '');
            }
            resolve();
            this._askNextQuestion();
        }
    }

    _resetAnswer () {
        this._answer = '';
    }

    _enqueueAsk (question, resolve, target, wasVisible, wasStage) {
        this._questionList.push([question, resolve, target, wasVisible, wasStage]);
    }

    _askNextQuestion () {
        if (this._questionList.length > 0) {
            const [question, _resolve, target, wasVisible, wasStage] = this._questionList[0];
            // If the target is visible, emit a blank question and use the
            // say event to trigger a bubble unless the target was the stage.
            if (wasVisible && !wasStage) {
                this.runtime.emit('SAY', target, 'say', question);
                this.runtime.emit('QUESTION', '');
            } else {
                this.runtime.emit('QUESTION', question);
            }
        }
    }

    _clearAllQuestions () {
        this._questionList = [];
        this.runtime.emit('QUESTION', null);
    }

    _clearTargetQuestions (stopTarget) {
        const currentlyAsking = this._questionList.length > 0 && this._questionList[0][2] === stopTarget;
        this._questionList = this._questionList.filter(question => (
            question[2] !== stopTarget
        ));

        if (currentlyAsking) {
            this.runtime.emit('SAY', stopTarget, 'say', '');
            if (this._questionList.length > 0) {
                this._askNextQuestion();
            } else {
                this.runtime.emit('QUESTION', null);
            }
        }
    }

    askAndWait (args, util) {
        const _target = util.target;
        return new Promise(resolve => {
            const isQuestionAsked = this._questionList.length > 0;
            this._enqueueAsk(String(args.QUESTION), resolve, _target, _target.visible, _target.isStage);
            if (!isQuestionAsked) {
                this._askNextQuestion();
            }
        });
    }

    getAnswer () {
        return this._answer;
    }

    getTimer (args, util) {
        return util.ioQuery('clock', 'projectTimer');
    }

    resetTimer (args, util) {
        util.ioQuery('clock', 'resetProjectTimer');
    }

    getMouseX (args, util) {
        return util.ioQuery('mouse', 'getScratchX');
    }

    getMouseY (args, util) {
        return util.ioQuery('mouse', 'getScratchY');
    }

    getMouseDown (args, util) {
        return util.ioQuery('mouse', 'getIsDown');
    }

    current (args) {
        const menuOption = Cast.toString(args.CURRENTMENU).toLowerCase();
        const date = new Date();
        switch (menuOption) {
        case 'year': return date.getFullYear();
        case 'month': return date.getMonth() + 1; // getMonth is zero-based
        case 'date': return date.getDate();
        case 'dayofweek': return date.getDay() + 1; // getDay is zero-based, Sun=0
        case 'hour': return date.getHours();
        case 'minute': return date.getMinutes();
        case 'second': return date.getSeconds();
        }
        return 0;
    }

    getKeyPressed (args, util) {
        return util.ioQuery('keyboard', 'getKeyIsDown', [args.KEY_OPTION]);
    }

    daysSince2000 () {
        const msPerDay = 24 * 60 * 60 * 1000;
        const start = new Date(2000, 0, 1); // Months are 0-indexed.
        const today = new Date();
        const dstAdjust = today.getTimezoneOffset() - start.getTimezoneOffset();
        let mSecsSinceStart = today.valueOf() - start.valueOf();
        mSecsSinceStart += ((today.getTimezoneOffset() - dstAdjust) * 60 * 1000);
        return mSecsSinceStart / msPerDay;
    }

    getOnline (args, util) {
        const status = window.navigator.onLine;
        if (typeof status === 'boolean') {
            return status;
        }
        // an empty string will evaluate as false in a Boolean context,
        // but it allows distinguishing between "false" and "unknown" if needed
        return '';
    }

}

module.exports = Scratch3SensingBlocks;
