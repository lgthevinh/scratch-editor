/**
 * @file
 * Object representing a Scratch variable.
 */

const uid = require('../util/uid');
const xmlEscape = require('../util/xml-escape');

class Variable {
    /**
     * @param {string} id Id of the variable.
     * @param {string} name Name of the variable.
     * @param {string} type Type of the variable, one of '' or 'list'
     * @param {boolean} isCloud Whether the variable is stored in the cloud.
     * @param {string} [dataType] Explicit value type for code generation, one of 'int', 'float', or 'string'.
     * Empty when the type should be inferred from the variable's assignments.
     * @class
     */
    constructor (id, name, type, isCloud, dataType) {
        this.id = id || uid();
        this.name = name;
        this.type = type;
        this.isCloud = isCloud;
        this.dataType = Variable.normalizeDataType(dataType);
        switch (this.type) {
        case Variable.SCALAR_TYPE:
            this.value = 0;
            break;
        case Variable.LIST_TYPE:
            this.value = [];
            break;
        case Variable.BROADCAST_MESSAGE_TYPE:
            this.value = this.name;
            break;
        default:
            throw new Error(`Invalid variable type: ${this.type}`);
        }
    }

    toXML (isLocal) {
        isLocal = (isLocal === true);
        return `<variable type="${this.type}" id="${this.id}" islocal="${isLocal
        }" iscloud="${this.isCloud}">${xmlEscape(this.name)}</variable>`;
    }

    /**
     * Type representation for scalar variables.
     * This is currently represented as ''
     * for compatibility with blockly.
     * @constant {string}
     */
    static get SCALAR_TYPE () {
        return '';
    }

    /**
     * Type representation for list variables.
     * @constant {string}
     */
    static get LIST_TYPE () {
        return 'list';
    }

    /**
     * Type representation for list variables.
     * @constant {string}
     */
    static get BROADCAST_MESSAGE_TYPE () {
        return 'broadcast_msg';
    }

    /**
     * Allowed explicit value types for code generation.
     * @constant {Array.<string>}
     */
    static get DATA_TYPES () {
        return ['int', 'float', 'string'];
    }

    /**
     * Validate an explicit value type, returning '' (infer from assignments) for any value
     * that is not a recognized data type. Used at trust boundaries (deserialize, variable
     * creation) so codegen never receives an arbitrary type string.
     * @param {*} dataType Candidate explicit value type.
     * @returns {string} A valid data type, or '' when unrecognized.
     */
    static normalizeDataType (dataType) {
        return Variable.DATA_TYPES.includes(dataType) ? dataType : '';
    }
}

module.exports = Variable;
