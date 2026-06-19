const Language = require('./language');

const statement = generate => ({type: 'statement', generate});
const expression = generate => ({type: 'expression', generate});
const quote = value => JSON.stringify(String(value));
const input = (ctx, block, name, fallback) => ctx.generateInput(block, name, fallback);
const field = (ctx, block, name, fallback) => ctx.getFieldValue(block, name, fallback);
const line = (ctx, indentLevel, code) => `${ctx.indent(indentLevel)}${code}`;

const arg = (ctx, block, name, fallback) => {
    if (ctx.getInputBlockId(block, name)) {
        return input(ctx, block, name, fallback);
    }
    return field(ctx, block, name, fallback);
};

const sanitizeIdentifier = value => {
    const identifier = String(value || 'value')
        .replace(/[^A-Za-z0-9_$]/g, '_')
        .replace(/^[^A-Za-z_$]/, '_$&');
    return identifier || 'value';
};

const variableName = (block, fieldName, fallback) => {
    const variable = block.fields && block.fields[fieldName];
    return sanitizeIdentifier((variable && (variable.value || variable.name)) || fallback);
};

module.exports = {
    Language,
    arg,
    expression,
    field,
    input,
    line,
    quote,
    sanitizeIdentifier,
    statement,
    variableName
};
