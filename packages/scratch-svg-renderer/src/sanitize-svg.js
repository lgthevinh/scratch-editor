/**
 * @fileOverview Sanitize the content of an SVG aggressively, to make it as safe
 * as possible
 */
const fixupSvgString = require('./fixup-svg-string');
const {generate, parse, walk} = require('css-tree');
const DOMPurify = require('isomorphic-dompurify');

const sanitizeSvg = {};

const isInternalRef = ref => ref.startsWith('#') || ref.toLowerCase().startsWith('data:');

/**
 * Decode CSS escape sequences in a string.
 * CSS escapes: \HHHHHH (1-6 hex digits, optionally followed by one whitespace) or \C (any non-hex char).
 * This is the first step of canonicalization: neither jsdom nor css-tree decodes these,
 * but real browsers do, so we must decode before parsing.
 * @param {string} str - String to decode
 * @returns {string} Decoded string
 */
const decodeCssEscapes = str => str.replace(
    /\\([0-9a-fA-F]{1,6})\s?|\\(.)/g,
    (match, hex, char) => (hex ? String.fromCodePoint(parseInt(hex, 16)) : char)
);

/**
 * Walk a css-tree AST and return true if any Url node references an external resource.
 * @param {import('css-tree').CssNode} ast - The CSS tree or subtree to walk
 * @returns {boolean} True if an external url() reference was found
 */
const astHasExternalUrls = ast => {
    let found = false;
    walk(ast, node => {
        if (node.type === 'Url') {
            const urlValue = (node.value.value || '').trim().replace(/['"]/g, '');
            if (!isInternalRef(urlValue)) {
                found = true;
            }
        }
    });
    return found;
};

/**
 * Canonicalize a CSS string and check it for external url() references.
 * Canonicalization: decode CSS escapes, then parse through css-tree so that all syntax
 * variations (quoting, whitespace, comments, escapes) are normalized into AST nodes.
 * @param {string} cssText - raw CSS text
 * @param {string} parseContext - css-tree parse context: 'value' for a single CSS value
 *   (presentation attributes like fill, stroke), or 'declarationList' for style attributes.
 * @returns {boolean} true if an external url() reference was found
 */
const cssHasExternalUrls = (cssText, parseContext) => {
    const decoded = decodeCssEscapes(cssText);
    try {
        return astHasExternalUrls(parse(decoded, {context: parseContext}));
    } catch {
        // If css-tree can't parse it, conservatively check the decoded text.
        // This handles edge cases where creative syntax breaks the parser but
        // a browser might still interpret a url() call.
        const normalized = decoded.toLowerCase().replace(/\s/g, '');
        for (const m of normalized.matchAll(/url\((.+?)\)/g)) {
            const ref = m[1].replace(/['"]/g, '');
            if (!isInternalRef(ref)) return true;
        }
        return false;
    }
};

DOMPurify.addHook(
    'beforeSanitizeAttributes',
    currentNode => {

        if (currentNode && currentNode.href && currentNode.href.baseVal) {
            const href = currentNode.href.baseVal.replace(/\s/g, '');
            // "data:" and "#" are valid hrefs
            if (!isInternalRef(href)) {
                // TODO: Those can be in different namespaces than `xlink:`
                if (currentNode.attributes.getNamedItem('xlink:href')) {
                    currentNode.attributes.removeNamedItem('xlink:href');
                    delete currentNode['xlink:href'];
                }
                if (currentNode.attributes.getNamedItem('href')) {
                    currentNode.attributes.removeNamedItem('href');
                    delete currentNode.href;
                }
            }
        }

        // Remove attributes containing url(...) with external references.
        // Uses css-tree to parse attribute values, which handles quoting,
        // whitespace, comments, and other CSS syntax that regex would miss.
        if (currentNode && currentNode.attributes) {
            for (let i = currentNode.attributes.length - 1; i >= 0; i--) {
                const attr = currentNode.attributes[i];
                if (!attr.value) continue;

                const context = attr.name === 'style' ? 'declarationList' : 'value';
                if (cssHasExternalUrls(attr.value, context)) {
                    currentNode.removeAttribute(attr.name);
                }
            }
        }

        return currentNode;
    }
);

DOMPurify.addHook(
    'uponSanitizeElement',
    (node, data) => {
        if (data.tagName === 'style') {
            // Canonicalize: decode CSS escapes then parse, so css-tree sees
            // normalized tokens (e.g. \75\72\6c becomes url).
            const decodedCss = decodeCssEscapes(node.textContent);
            const ast = parse(decodedCss);
            let isModified = decodedCss !== node.textContent;

            walk(ast, (astNode, item, list) => {
                // @import rules
                if (astNode.type === 'Atrule' && astNode.name.toLowerCase() === 'import') {
                    list.remove(item);
                    isModified = true;
                }

                // Declarations using url(...) for external resources
                if (astNode.type === 'Declaration' && astNode.value && astHasExternalUrls(astNode.value)) {
                    list.remove(item);
                    isModified = true;
                }
            });

            if (isModified) {
                node.textContent = generate(ast);
            }
        }
    }
);

// Use JS implemented TextDecoder and TextEncoder if it is not provided by the
// browser.
let _TextDecoder;
let _TextEncoder;
if (typeof TextDecoder === 'undefined' || typeof TextEncoder === 'undefined') {
    // Wait to require the text encoding polyfill until we know it's needed.

    const encoding = require('fastestsmallesttextencoderdecoder');
    _TextDecoder = encoding.TextDecoder;
    _TextEncoder = encoding.TextEncoder;
} else {
    _TextDecoder = TextDecoder;
    _TextEncoder = TextEncoder;
}

/**
 * Load an SVG Uint8Array of bytes and "sanitize" it
 * @param {!Uint8Array} rawData unsanitized SVG daata
 * @returns {Uint8Array} sanitized SVG data
 */
sanitizeSvg.sanitizeByteStream = function (rawData) {
    const decoder = new _TextDecoder();
    const encoder = new _TextEncoder();
    const sanitizedText = sanitizeSvg.sanitizeSvgText(decoder.decode(rawData));
    return encoder.encode(sanitizedText);
};

/**
 * Load an SVG string and "sanitize" it. This is more aggressive than the handling in
 * fixup-svg-string.js, and thus more risky; there are known examples of SVGs that
 * it will clobber. We use DOMPurify's svg profile, which restricts many types of tag.
 * @param {!string} rawSvgText unsanitized SVG string
 * @returns {string} sanitized SVG text
 */
sanitizeSvg.sanitizeSvgText = function (rawSvgText) {
    let sanitizedText = DOMPurify.sanitize(rawSvgText, {
        USE_PROFILES: {svg: true},
        FORBID_TAGS: ['a', 'audio', 'canvas', 'video'],
        // Allow data URI in image tags (e.g. SVGs converted from bitmap)
        ADD_DATA_URI_TAGS: ['image']
    });

    // Remove partial XML comment that is sometimes left in the HTML
    const badTag = sanitizedText.indexOf(']&gt;');
    if (badTag >= 0) {
        sanitizedText = sanitizedText.substring(5, sanitizedText.length);
    }

    // also use our custom fixup rules
    sanitizedText = fixupSvgString(sanitizedText);
    return sanitizedText;
};

module.exports = sanitizeSvg;
