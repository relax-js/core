/**
 * @module scanTemplate
 * Reads the tag, attribute and text structure of a template string without a
 * DOM, so the checker can run under Node. Every event carries the offset into
 * the template text where its content starts, for mapping findings back to
 * the source file. Only structure lives here; expression syntax is read with
 * the runtime's grammar in `../html/expressions`.
 */

export interface ScannedAttribute {
    name: string;
    value: string;
    /** Offset of the first character of `value` in the template text. */
    offset: number;
}

export interface OpenEvent {
    kind: 'open';
    tag: string;
    attributes: ScannedAttribute[];
    /** True for a void element or a `/>` tag: no close event follows. */
    selfClosing: boolean;
}

export interface CloseEvent {
    kind: 'close';
    tag: string;
}

export interface TextEvent {
    kind: 'text';
    text: string;
    offset: number;
}

/**
 * Markup the browser parses into a different structure than the one written,
 * reported at the `<` of the tag that triggers it.
 */
export interface ReshapeEvent {
    kind: 'reshape';
    offset: number;
    message: string;
}

export type TemplateEvent = OpenEvent | CloseEvent | TextEvent | ReshapeEvent;

/**
 * What the template text is parsed inside. `compileTemplate` wraps it in a
 * `<div>`, so a table row at its root is dropped. The `html` tag assigns it to
 * a `<template>`, which keeps one.
 */
export type TemplateParent = 'element' | 'template';

const voidElements = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

const closesParagraph = new Set([
    'address', 'article', 'aside', 'blockquote', 'center', 'details', 'dialog', 'dir', 'div',
    'dl', 'dd', 'dt', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3',
    'h4', 'h5', 'h6', 'header', 'hgroup', 'hr', 'li', 'listing', 'main', 'menu', 'nav', 'ol',
    'p', 'pre', 'search', 'section', 'summary', 'table', 'ul', 'xmp',
]);

const paragraphScopeBoundaries = new Set([
    'applet', 'button', 'caption', 'marquee', 'object', 'table', 'td', 'template', 'th',
]);

const tableParts = new Set([
    'caption', 'col', 'colgroup', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr',
]);

const tableContexts = new Set(['table', 'template', ...tableParts]);

/**
 * Scans a template into open, close and text events. Close events are
 * emitted in nesting order: a close tag closes every element left open inside
 * it, and one with no matching open element is ignored, so the event stream
 * always balances the way a browser would.
 *
 * Two content-model rules are applied the way the browser applies them, each
 * with a reshape event: a block element closes an open `<p>`, and a table part
 * outside a table is dropped while its content stays. Loop scopes then match
 * what renders.
 *
 * @example
 * scanTemplate('<p>Hi {{name}}</p>');
 * // [{ kind: 'open', tag: 'p', ... }, { kind: 'text', text: 'Hi {{name}}', offset: 3 }, { kind: 'close', tag: 'p' }]
 */
export function scanTemplate(text: string, parent: TemplateParent = 'element'): TemplateEvent[] {
    const events: TemplateEvent[] = [];
    const open: string[] = [];
    let i = 0;

    const emitText = (from: number, to: number) => {
        if (to > from) events.push({ kind: 'text', text: text.slice(from, to), offset: from });
    };

    while (i < text.length) {
        const lt = text.indexOf('<', i);
        if (lt === -1) {
            emitText(i, text.length);
            break;
        }
        emitText(i, lt);

        if (text.startsWith('<!--', lt)) {
            const end = text.indexOf('-->', lt + 4);
            i = end === -1 ? text.length : end + 3;
            continue;
        }

        if (text.startsWith('</', lt)) {
            const end = text.indexOf('>', lt);
            const tag = text.slice(lt + 2, end === -1 ? text.length : end).trim().toLowerCase();
            const depth = open.lastIndexOf(tag);
            if (depth !== -1) {
                while (open.length > depth) events.push({ kind: 'close', tag: open.pop()! });
            }
            i = end === -1 ? text.length : end + 1;
            continue;
        }

        const tagMatch = /^<([a-zA-Z][^\s/>]*)/.exec(text.slice(lt));
        if (!tagMatch) {
            emitText(lt, lt + 1);
            i = lt + 1;
            continue;
        }

        const tag = tagMatch[1].toLowerCase();
        i = lt + tagMatch[0].length;
        const attributes: ScannedAttribute[] = [];
        let selfClosing = false;

        while (i < text.length) {
            const rest = text.slice(i);
            const ws = /^\s+/.exec(rest);
            if (ws) {
                i += ws[0].length;
                continue;
            }
            if (rest.startsWith('/>')) {
                selfClosing = true;
                i += 2;
                break;
            }
            if (rest.startsWith('>')) {
                i += 1;
                break;
            }
            const attr = /^([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]*)))?/.exec(rest);
            if (!attr) {
                i += 1;
                continue;
            }
            const [whole, name, dq, sq, bare] = attr;
            const value = dq ?? sq ?? bare ?? '';
            const quoted = dq !== undefined || sq !== undefined;
            const offset = i + whole.length - value.length - (quoted ? 1 : 0);
            attributes.push({ name: name.toLowerCase(), value, offset });
            i += whole.length;
        }

        if (closesParagraph.has(tag)) {
            const paragraph = openParagraph(open);
            if (paragraph !== -1) {
                if (tag !== 'p') {
                    events.push({
                        kind: 'reshape',
                        offset: lt,
                        message:
                            `<${tag}> closes the open <p>, because a paragraph cannot contain it. ` +
                            `The browser renders the <${tag}> after the paragraph, outside any loop or if on the <p>`,
                    });
                }
                while (open.length > paragraph) events.push({ kind: 'close', tag: open.pop()! });
            }
        }

        const atTemplateRoot = parent === 'template' && open.length === 0;
        if (tableParts.has(tag) && !atTemplateRoot && !open.some(t => tableContexts.has(t))) {
            events.push({
                kind: 'reshape',
                offset: lt,
                message:
                    `<${tag}> outside a <table> is dropped by the browser, together with its attributes, ` +
                    `and its content moves into the parent element. Put it inside a <table>`,
            });
            continue;
        }

        const isVoid = voidElements.has(tag);
        events.push({ kind: 'open', tag, attributes, selfClosing: selfClosing || isVoid });
        if (!selfClosing && !isVoid) open.push(tag);
    }

    while (open.length) events.push({ kind: 'close', tag: open.pop()! });
    return events;
}

function openParagraph(open: string[]): number {
    for (let depth = open.length - 1; depth >= 0; depth--) {
        if (open[depth] === 'p') return depth;
        if (paragraphScopeBoundaries.has(open[depth])) return -1;
    }
    return -1;
}
