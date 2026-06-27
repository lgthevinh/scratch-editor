import {xmlEscape} from './make-toolbox-xml';

/**
 * Build the `<value>` XML that plugs a shadow block into a named value input, so the palette block
 * carries an editable default field instead of an empty socket.
 * @param {string} name - the value-input name (matches the block's `input_value` name).
 * @param {{type: string, fields?: object}} shadow - the shadow block type and its field values.
 * @returns {string} the `<value>` element wrapping the shadow.
 */
const shadowXML = function (name, shadow) {
    const fields = Object.entries(shadow.fields || {})
        .map(([fieldName, value]) =>
            `<field name="${xmlEscape(fieldName)}">${xmlEscape(String(value))}</field>`)
        .join('');
    return `<value name="${xmlEscape(name)}">` +
        `<shadow type="${xmlEscape(shadow.type)}">${fields}</shadow></value>`;
};

/**
 * Build the `<block>` XML for one toolbox block entry, nesting any shadow-filled value inputs.
 * @param {{type: string, inputs?: object}} item - the pack's block entry.
 * @returns {string} the `<block>` element.
 */
const blockXML = function (item) {
    const inputs = item.inputs ?
        Object.entries(item.inputs)
            .map(([name, shadow]) => shadowXML(name, shadow))
            .join('') :
        '';
    return inputs ?
        `<block type="${xmlEscape(item.type)}">${inputs}</block>` :
        `<block type="${xmlEscape(item.type)}"/>`;
};

/**
 * Convert a resource-pack `ToolboxCategory` — the plain data a peripheral
 * contributes (`{kind:'category', name, colour?, contents:[{kind:'block', type}]}`) — into the
 * `{id, xml}` shape the toolbox builder appends. The pack describes its palette as data; Blockly's
 * toolbox is XML, so this is where the two meet. The id is namespaced by `idPrefix` so pack categories
 * never collide with each other or with the core category ids the toolbox builder reorders.
 * @param {object} category - the pack's toolbox category.
 * @param {string} idPrefix - id namespace, e.g. `peripheral`.
 * @returns {{id: string, xml: string}} the category id and its `<category>` XML.
 */
const packCategoryToToolboxXML = function (category, idPrefix) {
    const id = `${idPrefix}_${category.name.toLowerCase().replace(/\s+/g, '_')}`;
    const colour = category.colour || '#0FBD8C';
    const blocks = category.contents
        .filter(item => item.kind === 'block')
        .map(blockXML)
        .join('');
    const xml =
        `<category name="${xmlEscape(category.name)}" toolboxitemid="${id}" colour="${colour}">` +
        `${blocks}</category>`;
    return {id, xml};
};

export {
    packCategoryToToolboxXML
};
