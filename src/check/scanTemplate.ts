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

export type TemplateEvent = OpenEvent | CloseEvent | TextEvent;

const voidElements = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

/**
 * Scans a template into open, close and text events. Close events are
 * emitted in nesting order: a close tag closes every element left open inside
 * it, and one with no matching open element is ignored, so the event stream
 * always balances the way a browser would.
 *
 * @example
 * scanTemplate('<p>Hi {{name}}</p>');
 * // [{ kind: 'open', tag: 'p', ... }, { kind: 'text', text: 'Hi {{name}}', offset: 3 }, { kind: 'close', tag: 'p' }]
 */
export function scanTemplate(text: string): TemplateEvent[] {
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

        const isVoid = voidElements.has(tag);
        events.push({ kind: 'open', tag, attributes, selfClosing: selfClosing || isVoid });
        if (!selfClosing && !isVoid) open.push(tag);
    }

    while (open.length) events.push({ kind: 'close', tag: open.pop()! });
    return events;
}
