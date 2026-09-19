/**
 * @module expressions
 * The expression grammar of `compileTemplate`, shared by the runtime and the
 * static checker so both read `{{expr}}`, `loop` and `r-<event>` the same way.
 */

export interface ParsedExpression {
    type: 'path' | 'function';
    path?: string;
    fnName?: string;
    fnArgs?: string[];
    pipes: string[];
}

/**
 * Splits `{{...}}` content into its main expression and pipes. The main
 * expression is either a function call `name(arg, arg)` or a context path.
 *
 * @example
 * parseExpression('user.name | uppercase');
 * // { type: 'path', path: 'user.name', pipes: ['uppercase'] }
 *
 * @example
 * parseExpression('formatDate(createdAt)');
 * // { type: 'function', fnName: 'formatDate', fnArgs: ['createdAt'], pipes: [] }
 */
export function parseExpression(expr: string): ParsedExpression {
    const pipesSplit = expr.split('|').map(s => s.trim());
    const mainExpr = pipesSplit[0];
    const pipes = pipesSplit.slice(1);

    const fnMatch = mainExpr.match(/^(\w+)\s*\((.*)\)$/);
    if (fnMatch) {
        const [, fnName, argsStr] = fnMatch;
        const fnArgs = argsStr
            ? argsStr.split(',').map(a => a.trim())
            : [];
        return { type: 'function', fnName, fnArgs, pipes };
    }

    return { type: 'path', path: mainExpr, pipes };
}

/** Matches the `{{expr}}` segments of interpolated text; an expression never spans lines. */
export const INTERPOLATION = /(\{\{.*?\}\})/;

/** A context path: identifiers separated by dots, with numeric indexes. */
export const PATH = /^\w+(\.\w+|\[\d+\])*$/;

export interface LoopDefinition {
    alias: string;
    source: string;
}

/**
 * Reads a `loop="item in items"` definition.
 *
 * @example
 * parseLoop('row in data.rows'); // { alias: 'row', source: 'data.rows' }
 * parseLoop('rows');             // null
 */
export function parseLoop(definition: string): LoopDefinition | null {
    const match = definition.match(/(\w+)\s+in\s+(.+)/);
    return match ? { alias: match[1], source: match[2] } : null;
}

export const structuralAttributes = ['loop', 'if', 'unless'];

/**
 * The `html` tag's mustache: `{{name}}` or `{{name|arg, arg}}`. Group 1 is the
 * property name, group 2 the argument list when the property is a function.
 */
export const HTML_MUSTACHE = /\{\{\s*([^|}]+?)\s*(?:\|([^}]+?))?\s*\}\}/;

export interface HtmlExpression {
    name: string;
    args: string[];
}

/**
 * Reads the inside of an `html` mustache.
 *
 * @example
 * parseHtmlExpression('{{format|name, title}}'); // { name: 'format', args: ['name', 'title'] }
 * parseHtmlExpression('{{name}}');               // { name: 'name', args: [] }
 */
export function parseHtmlExpression(mustache: string): HtmlExpression | null {
    const match = HTML_MUSTACHE.exec(mustache);
    if (!match) return null;
    const [, name, args] = match;
    return { name, args: args ? args.split(',').map(a => a.trim()) : [] };
}
