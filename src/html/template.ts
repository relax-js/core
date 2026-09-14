/**
 * @module template
 * DOM-based template engine with reactive rendering capabilities.
 *
 * Compiles HTML templates with mustache-style expressions into efficient
 * render functions that update the DOM when data changes.
 *
 * **Features:**
 * - Text interpolation: `{{name}}`, `{{user.profile.email}}`
 * - Attribute binding: `<div class="{{className}}">`
 * - Pipes: `{{price | currency}}`, `{{name | uppercase | shorten:20}}`
 * - Function calls: `{{formatDate(createdAt)}}`, `{{add(5, 3)}}`
 * - Array indexing: `{{items[0]}}`, `{{users[1].name}}`
 * - Conditionals: `<div if="isVisible">`, `<div unless="isHidden">`
 * - Loops: `<li loop="item in items">{{item.name}}</li>`
 *
 * @example
 * // Basic usage
 * import { compileTemplate } from './m';
 *
 * const { content, render } = compileTemplate(`
 *     <div class="card">
 *         <h2>{{title}}</h2>
 *         <p>{{description}}</p>
 *     </div>
 * `);
 *
 * render({ title: 'Hello', description: 'World' });
 * document.body.appendChild(content);
 *
 * @example
 * // With pipes and functions
 * import { createPipeRegistry } from '../pipes';
 *
 * const pipeRegistry = createPipeRegistry();
 * const { content, render } = compileTemplate(`
 *     <span>{{user.name | uppercase}}</span>
 *     <span>{{formatDate(user.createdAt)}}</span>
 * `, { strict: false, pipeRegistry });
 *
 * render(
 *     { user: { name: 'john', createdAt: new Date() } },
 *     { formatDate: (d) => d.toLocaleDateString() }
 * );
 *
 * @example
 * // With loops and conditionals
 * const { content, render } = compileTemplate(`
 *     <ul>
 *         <li loop="item in items" if="item.visible">
 *             {{item.name}}: {{item.price | currency}}
 *         </li>
 *     </ul>
 * `);
 *
 * render({ items: [
 *     { name: 'Apple', price: 1.5, visible: true },
 *     { name: 'Hidden', price: 0, visible: false }
 * ]});
 */

import { PipeRegistry, defaultPipes, applyPipes } from '../pipes';
import { reportError } from '../errors';

/**
 * Configuration options for the template engine.
 *
 * @example
 * const config: EngineConfig = {
 *     strict: true,
 *     onError: (msg) => console.error(msg),
 *     pipeRegistry: createPipeRegistry()
 * };
 */
export interface EngineConfig {
    /** When true, throws errors for missing paths/functions. When false, returns empty string. */
    strict: boolean;
    /** Optional callback invoked when errors occur, receives formatted error message. */
    onError?: (msg: string) => void;
    /** Custom pipe registry for transformations. Defaults to built-in pipes. */
    pipeRegistry?: PipeRegistry;
}

export type Path = string;
export type TemplateValue = string | number | boolean | null | undefined;

/**
 * Data context object passed to render function.
 * Contains the data values that expressions resolve against.
 *
 * @example
 * const ctx: Context = {
 *     user: { name: 'John', age: 30 },
 *     items: ['a', 'b', 'c'],
 *     isActive: true
 * };
 *
 * @internal
 */
export interface Context {
    [key: string]: ContextValue;
}

/**
 * Functions context object passed as second argument to render.
 * Contains callable functions that can be invoked from templates.
 *
 * @example
 * const fns: FunctionsContext = {
 *     formatDate: (d) => d.toLocaleDateString(),
 *     add: (a, b) => a + b,
 *     greet: (name) => `Hello, ${name}!`
 * };
 *
 * @internal
 */
export interface FunctionsContext {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: (...args: any[]) => any;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ContextValue = TemplateValue | any[] | Context | ((...args: any[]) => any);

export type Getter = (ctx: Context, path: Path, debugInfo?: string) => TemplateValue;
export type Setter = (ctx: Context, fns?: FunctionsContext) => void;
export type Patcher = (node: Node, get: Getter, config: EngineConfig) => Setter | void;
export type ExpressionFn = (ctx: Context, fns?: FunctionsContext) => TemplateValue;

interface ParsedExpression {
    type: 'path' | 'function';
    path?: string;
    fnName?: string;
    fnArgs?: string[];
    pipes: string[];
}

function parseExpression(expr: string): ParsedExpression {
    const pipesSplit = expr.split('|').map(s => s.trim());
    const mainExpr = pipesSplit[0];
    const pipes = pipesSplit.slice(1);

    // Check if it's a function call: functionName(args)
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

// Resolve a path with support for array indexing: items[0].name
function resolvePath(ctx: ContextValue, path: string): ContextValue {
    // Handle array indexing by converting items[0] to items.0
    const normalizedPath = path.replace(/\[(\d+)\]/g, '.$1');
    const segments = normalizedPath.split('.');
    let current = ctx;

    for (const key of segments) {
        if (current && typeof current === 'object' && key in current) {
            current = (current as Record<string, ContextValue>)[key];
        } else {
            return undefined;
        }
    }

    return current;
}
  
  function handleError(
      config: EngineConfig,
      message: string,
      context: string,
      expression: string,
      shouldThrow = false,
  ): void {
    const formattedMessage = `[template error] ${message} (at ${context})`;

    if (window.relaxDebug?.templates) console.warn(formattedMessage);
    if (config.onError) config.onError(formattedMessage);

    const error = reportError(formattedMessage, { expression, location: context });
    if (error && (config.strict || shouldThrow)) throw error;
  }
  
function createGetter(config: EngineConfig): Getter {
    return function get(ctx: ContextValue, path: Path, debugInfo = ''): TemplateValue {
        try {
            const current = resolvePath(ctx, path);

            if (current === undefined) {
                handleError(config, `Cannot resolve "${path}"`, debugInfo, path);
                return '';
            }

            // Return primitive values as-is for conditional checks
            if (current === null) {
                return '';
            } else if (Array.isArray(current)) {
                return current.length > 0 ? JSON.stringify(current) : '';
            } else if (typeof current === 'object') {
                return JSON.stringify(current);
            } else {
                return current as TemplateValue;
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            handleError(config, `Exception resolving "${path}": ${errorMessage}`, debugInfo, path, true);
            return '';
        }
    };
}

function evaluateExpression(
    parsed: ParsedExpression,
    ctx: Context,
    fns: FunctionsContext | undefined,
    config: EngineConfig,
    debugInfo: string
): TemplateValue {
    let value: TemplateValue;
    const registry = config.pipeRegistry ?? defaultPipes;

    if (parsed.type === 'function') {
        const fn = fns?.[parsed.fnName!];
        if (typeof fn !== 'function') {
            handleError(config, `Function "${parsed.fnName}" not found`, debugInfo, parsed.fnName!);
            return '';
        }

        // Resolve function arguments - could be literals or paths
        const resolvedArgs = (parsed.fnArgs ?? []).map(arg => {
            // String literal
            if ((arg.startsWith('"') && arg.endsWith('"')) ||
                (arg.startsWith("'") && arg.endsWith("'"))) {
                return arg.slice(1, -1);
            }
            // Number literal
            if (!isNaN(Number(arg))) {
                return Number(arg);
            }
            // Path reference - resolve from context
            const resolved = resolvePath(ctx, arg);
            return resolved;
        });

        try {
            value = fn(...resolvedArgs) as TemplateValue;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            handleError(config, `Error calling "${parsed.fnName}": ${errorMessage}`, debugInfo, parsed.fnName!);
            return '';
        }
    } else {
        // Path resolution
        const resolved = resolvePath(ctx, parsed.path!);
        if (resolved === undefined) {
            handleError(config, `Cannot resolve "${parsed.path}"`, debugInfo, parsed.path!);
            return '';
        }
        if (resolved === null) {
            value = '';
        } else if (typeof resolved === 'object') {
            value = JSON.stringify(resolved);
        } else {
            value = resolved as TemplateValue;
        }
    }

    // Apply pipes if any
    if (parsed.pipes.length > 0) {
        value = applyPipes(value, parsed.pipes, registry);
    }

    return value;
}
  
interface InterpolationPart {
    /** Set for a `{{expr}}` segment, null for surrounding literal text. */
    parsed: ParsedExpression | null;
    literal: string;
}

const expressionCache = new Map<string, InterpolationPart[]>();

/**
 * Splits interpolated text into the literal and `{{expr}}` segments it is made
 * of, so both can be re-joined on every render. Text and attributes share the
 * parse result, which is memoized because loops recompile a clone per item.
 */
function splitInterpolation(raw: string): InterpolationPart[] {
    let parts = expressionCache.get(raw);
    if (!parts) {
        parts = raw
            .split(/(\{\{.*?\}\})/)
            .filter(part => part !== '')
            .map(part => part.startsWith('{{') && part.endsWith('}}')
                ? { parsed: parseExpression(part.slice(2, -2).trim()), literal: '' }
                : { parsed: null, literal: part });
        expressionCache.set(raw, parts);
    }
    return parts;
}

function composeParts(
    parts: InterpolationPart[],
    ctx: Context,
    fns: FunctionsContext | undefined,
    config: EngineConfig,
    debugInfo: string
): string {
    return parts
        .map(({ parsed, literal }) => parsed
            ? String(evaluateExpression(parsed, ctx, fns, config, debugInfo))
            : literal)
        .join('');
}

function textNodePatcher(node: Node, _get: Getter, config: EngineConfig): Setter | void {
    if (node.nodeType !== Node.TEXT_NODE || !node.textContent?.includes('{{')) return;

    const raw = node.textContent;
    const parts = splitInterpolation(raw);
    const debugInfo = `TextNode: "${raw}"`;

    return (ctx: Context, fns?: FunctionsContext) => {
        (node as Text).textContent = composeParts(parts, ctx, fns, config, debugInfo);
    };
}
  
/**
 * Attributes whose content attribute does not stay in sync with the live
 * property the user actually sees. Setting `value`/`checked`/`selected` via
 * `setAttribute` only writes the *default* (`defaultValue`/`defaultChecked`),
 * so a form control that is cleared and repopulated programmatically would
 * keep showing stale data. For these we write the property directly.
 */
const liveValueAttributes = ['value', 'checked', 'selected'];

/**
 * Resolves `{{expr}}` inside element attributes and keeps them updated on
 * every render. An attribute may mix literal text with any number of
 * expressions, as in `class="finding {{severity}}"`.
 *
 * Three binding modes, chosen by the attribute and the resolved value:
 * - `value`/`checked`/`selected` are written to the matching DOM *property*,
 *   because the content attribute only seeds the default and would not
 *   reflect a programmatic clear-and-repopulate.
 * - A boolean value is applied with `toggleAttribute`, so `disabled="{{busy}}"`
 *   adds the attribute when `true` and removes it when `false` (a plain
 *   `setAttribute` would leave `disabled="false"`, which is still disabled).
 * - Everything else is a normal string `setAttribute`.
 *
 * @example
 * // Property binding keeps the input in sync after a reset
 * compileTemplate('<input value="{{name}}">');
 *
 * @example
 * // Boolean binding toggles the attribute on and off. Only a whole-value
 * // expression can do this; "busy {{flag}}" is always a string.
 * compileTemplate('<button disabled="{{busy}}">Save</button>');
 *
 * @example
 * // Literals and expressions compose into one string
 * compileTemplate('<img src="/avatars/{{user.id}}.png">');
 */
function attributeInterpolationPatcher(node: Node, _get: Getter, config: EngineConfig): Setter | void {
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const element = node as Element;
    const setters: Setter[] = [];

    // Use Array.from to safely iterate over NamedNodeMap
    const attributes = Array.from(element.attributes);
    for (const attr of attributes) {
        if (!attr.value.includes('{{')) continue;

        const parts = splitInterpolation(attr.value);
        if (!parts.some(part => part.parsed)) continue;

        const name = attr.name;
        const wholeValue = parts.length === 1 ? parts[0].parsed : null;
        const debugInfo = `Attribute: ${name} on <${element.tagName.toLowerCase()}>`;

        setters.push((ctx: Context, fns?: FunctionsContext) => {
            const value = wholeValue
                ? evaluateExpression(wholeValue, ctx, fns, config, debugInfo)
                : composeParts(parts, ctx, fns, config, debugInfo);

            if (liveValueAttributes.includes(name) && name in element) {
                const live = element as unknown as Record<string, unknown>;
                if (element === document.activeElement && live[name] !== value) {
                    handleError(
                        config,
                        `render() replaced "${name}" on the <${element.tagName.toLowerCase()}> ` +
                            'that currently has focus, discarding what was being typed and moving ' +
                            'the caret. Render an edited field once, or keep it out of the region ' +
                            'that re-renders',
                        debugInfo,
                        name,
                    );
                }
                live[name] = value;
            } else if (typeof value === 'boolean') {
                element.toggleAttribute(name, value);
            } else {
                element.setAttribute(name, String(value));
            }
        });
    }

    if (setters.length > 0) {
        return (ctx: Context, fns?: FunctionsContext) => setters.forEach(fn => fn(ctx, fns));
    }
}

/**
 * Binds event handlers declared with `r-<event>="handler(args)"`, for example
 * `r-click`, `r-change`, or `r-keypress`. Every `r-` attribute is claimed and
 * removed from the output, valid or not. The part after `r-` is treated as a
 * DOM event name and checked via the matching `on<event>` property, which
 * confirms the event exists rather than that this element fires it; an
 * unrecognised name is reported as an error. Custom events have no `on<event>`
 * property and so cannot be bound this way.
 *
 * The handler name is resolved from the functions context passed to `render`.
 * Arguments are resolved against the current data context, so inside a loop
 * the iteration alias (`row`) and its nested values can be passed straight to
 * the handler. The literal `event` resolves to the native DOM event.
 *
 * Listeners are attached once per element. Each render only refreshes the data
 * the listeners close over, so handlers keep working as loops reuse, add, or
 * remove rows.
 */
function eventPatcher(node: Node, _get: Getter, config: EngineConfig): Setter | void {
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const element = node as Element;
    const tag = element.tagName.toLowerCase();
    const rAttributes = Array.from(element.attributes).filter(attr => attr.name.startsWith('r-'));
    if (rAttributes.length === 0) return;

    const updaters: Setter[] = [];

    for (const attr of rAttributes) {
        const eventName = attr.name.slice(2);
        const expr = attr.value;
        const debugInfo = `${attr.name}="${expr}" on <${tag}>`;
        element.removeAttribute(attr.name);

        if (!(`on${eventName}` in element)) {
            handleError(config, `"${attr.name}" is not a known event for <${tag}>`, debugInfo, attr.name);
            continue;
        }

        const parsed = parseExpression(expr);
        if (parsed.type !== 'function') {
            handleError(config, `${attr.name} must be a function call, got "${expr}"`, debugInfo, attr.name);
            continue;
        }

        let currentCtx: Context | null = null;
        let currentFns: FunctionsContext | undefined = undefined;

        element.addEventListener(eventName, (event) => {
            if (!currentCtx) return;
            const ctxWithEvent = { ...currentCtx, event } as unknown as Context;
            const result = evaluateExpression(
                parsed,
                ctxWithEvent,
                currentFns,
                config,
                debugInfo
            );
            if (result === false) {
                event.preventDefault();
            }
        });

        updaters.push((ctx: Context, fns?: FunctionsContext) => {
            currentCtx = ctx;
            currentFns = fns;
        });
    }

    if (updaters.length > 0) {
        return (ctx: Context, fns?: FunctionsContext) => updaters.forEach(fn => fn(ctx, fns));
    }
}

const structuralAttributes = ['loop', 'if', 'unless'];

/** One rendered copy of a structural element, kept so the next render can re-use it. */
interface Instance {
    element: Element;
    render: (ctx: Context, fns?: FunctionsContext) => void;
}

/**
 * Takes full ownership of any element carrying `loop`, `if` or `unless`,
 * including an element carrying several of them at once. The element is
 * replaced by a comment placeholder, and every render decides which copies
 * belong after that placeholder. Content patchers and child traversal are
 * skipped for such an element; its copies are compiled on their own.
 *
 * `if` and `unless` combine: the element renders when the `if` holds and the
 * `unless` does not. On a looping element the condition is evaluated per item
 * against that item's context, so an item that fails it produces no element.
 *
 * Rendering order for a new copy:
 *
 * 1. Clone from template (detached, attributes still contain mustache)
 * 2. Compile the clone, creating setters for mustache in attributes/text
 * 3. Render, resolving mustache against the iteration context
 * 4. Insert into DOM. Custom elements upgrade with final attribute values
 *
 * Steps 2-3 MUST happen before step 4. If we insert first, the browser
 * upgrades custom elements immediately (connectedCallback fires) while
 * attributes still contain raw "{{expr}}" strings.
 *
 * Copies already in the DOM are re-rendered in place. The most recently
 * removed copy is kept, so hiding and re-showing an element, or a list that
 * shrinks and grows again, skips the clone + compile.
 */
function structuralPatcher(node: Node, get: Getter, config: EngineConfig): Setter | void {
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const element = node as Element;
    const loopDef = element.getAttribute('loop');
    const ifExpr = element.getAttribute('if');
    const unlessExpr = element.getAttribute('unless');
    if (loopDef === null && ifExpr === null && unlessExpr === null) return;

    const tag = element.tagName.toLowerCase();
    let alias = '';
    let source = '';

    if (loopDef !== null) {
        const match = loopDef.match(/(\w+)\s+in\s+(.+)/);
        if (!match) {
            handleError(config, `Invalid loop syntax: "${loopDef}"`, `Element: <${tag}>`, loopDef);
            return;
        }
        [, alias, source] = match;
    }

    const template = element.cloneNode(true) as Element;
    structuralAttributes.forEach(name => template.removeAttribute(name));

    const placeholder = document.createComment(
        loopDef !== null
            ? `loop: ${loopDef}`
            : ifExpr !== null
                ? `if: ${ifExpr}`
                : `unless: ${unlessExpr}`
    );
    const parent = element.parentNode!;
    parent.insertBefore(placeholder, element);
    element.remove();

    const isVisible = (candidate: Context): boolean => {
        if (ifExpr !== null && !get(candidate, ifExpr, `if="${ifExpr}"`)) return false;
        if (unlessExpr !== null && get(candidate, unlessExpr, `unless="${unlessExpr}"`)) return false;
        return true;
    };

    /** The contexts to render one copy for, or null when the loop source is unusable. */
    const contextsToRender = (ctx: Context): Context[] | null => {
        if (loopDef === null) return isVisible(ctx) ? [ctx] : [];

        const items = resolvePath(ctx, source);

        if (items === undefined) {
            handleError(config, `Cannot resolve "${source}"`, `Loop source: "${loopDef}"`, source);
            return null;
        }

        if (!Array.isArray(items)) {
            handleError(config, `"${source}" is not an array in loop: "${loopDef}"`, `Element: <${tag}>`, source);
            return null;
        }

        return items
            .map(item => ({ ...ctx, [alias]: item }) as Context)
            .filter(isVisible);
    };

    let instances: Instance[] = [];
    let spare: Instance | null = null;

    return (ctx: Context, fns?: FunctionsContext) => {
        const contexts = contextsToRender(ctx);
        if (!contexts) return;

        const reuseCount = Math.min(instances.length, contexts.length);

        // Re-render copies that are already in the DOM
        for (let i = 0; i < reuseCount; i++) {
            instances[i].render(contexts[i], fns);
        }

        // Remove excess copies, keeping the last one for re-use
        for (let i = instances.length - 1; i >= contexts.length; i--) {
            instances[i].element.remove();
            spare = instances[i];
        }

        // Create missing copies via DocumentFragment for batch insertion
        if (contexts.length > reuseCount) {
            const fragment = document.createDocumentFragment();
            const added: Instance[] = [];

            for (let i = reuseCount; i < contexts.length; i++) {
                let instance = spare;
                spare = null;
                if (!instance) {
                    // 1-2. Clone (detached, no connectedCallback yet) and compile
                    const clone = template.cloneNode(true) as Element;
                    instance = { element: clone, render: compileDOM(clone, config) };
                }

                // 3. Render while detached; resolves mustache
                instance.render(contexts[i], fns);

                fragment.appendChild(instance.element);
                added.push(instance);
            }

            // 4. Batch-insert into live DOM. Custom elements upgrade with final values
            const insertAfter = reuseCount > 0 ? instances[reuseCount - 1].element : placeholder;
            parent.insertBefore(fragment, insertAfter.nextSibling);

            instances = instances.slice(0, reuseCount).concat(added);
        } else {
            instances.length = contexts.length;
        }
    };
}

/** Content patchers resolve mustache expressions and bind `r-<event>` handlers. */
const contentPatchers: Patcher[] = [
    textNodePatcher,
    attributeInterpolationPatcher,
    eventPatcher,
];

/**
 * Walks the DOM tree and collects setters from patchers.
 *
 * Processing order per node:
 * 1. Try the structural patcher. If it matches, it owns the node (skip steps 2-3)
 * 2. Run content patchers (text interpolation, attribute interpolation)
 * 3. Recurse into child nodes
 */
function compileDOM(
    root: Node,
    config: EngineConfig
): (ctx: Context, fns?: FunctionsContext | null) => boolean {
    const setters: Setter[] = [];
    const get = createGetter(config);

    function processNode(node: Node) {
        // Structural directives own the node; they clone + compileDOM internally
        const structural = structuralPatcher(node, get, config);
        if (structural) {
            setters.push(structural);
            return;
        }

        // Content patchers: resolve {{expr}} in text and attributes
        for (const patch of contentPatchers) {
            const setter = patch(node, get, config);
            if (setter) setters.push(setter);
        }

        for (const child of Array.from(node.childNodes)) {
            processNode(child);
        }
    }

    processNode(root);

    // Return memoized render function
    let lastCtx: Context | null = null;
    let lastFns: FunctionsContext | undefined = undefined;
    let retainedFns: FunctionsContext | undefined = undefined;
    return (ctx: Context, fns?: FunctionsContext | null) => {
        if (fns !== undefined) {
            retainedFns = fns ?? undefined;
        }

        // Only re-render if context has changed
        if (lastCtx === ctx && lastFns === retainedFns) {
            return false;
        }

        setters.forEach(fn => fn(ctx, retainedFns));
        lastCtx = ctx;
        lastFns = retainedFns;
        return true;
    };
}

/**
 * Result of compiling a template.
 * Contains the DOM content and a render function for updating it with data.
 */
export interface CompiledTemplate<T extends object = Context> {
    /** The compiled DOM element containing the template structure. */
    content: DocumentFragment | HTMLElement;
    /**
     * Updates the DOM with the provided data context.
     *
     * Memoized on the identity of `ctx`: passing the same object again renders
     * nothing and is reported as an error, because a mutated object is
     * indistinguishable from an unchanged one. Pass a new object when the data
     * has changed.
     *
     * @param ctx - Data context with values for template expressions
     * @param fns - Functions context for callable expressions. Omit it to keep the
     * one from the previous render, so a data-only update leaves handlers wired.
     * Pass `null` to deliberately drop it.
     */
    render: (ctx: T, fns?: FunctionsContext | null) => void;
}

/**
 * Compiles an HTML template string into a reusable render function.
 *
 * The template supports mustache-style expressions `{{expression}}` for:
 * - Path resolution: `{{user.name}}`, `{{items[0].title}}`
 * - Pipes: `{{value | uppercase}}`, `{{price | currency}}`
 * - Function calls: `{{formatDate(createdAt)}}`, `{{add(a, b)}}`
 *
 * Directive attributes for control flow:
 * - `if="condition"` - Renders element only when condition is truthy
 * - `unless="condition"` - Renders element only when condition is falsy
 * - `loop="item in items"` - Repeats element for each array item
 * - `r-<event>="handler(args)"` - Calls a function from the functions context
 *   on the named DOM event (`r-click`, `r-change`, `r-keypress`, ...);
 *   arguments resolve against the current data context
 *
 * @param templateStr - HTML template string with mustache expressions
 * @param config - Optional engine configuration
 * @returns Compiled template with content and render function
 *
 * @example
 * // Simple data binding
 * const { content, render } = compileTemplate('<h1>{{title}}</h1>');
 * render({ title: 'Hello World' });
 * document.body.appendChild(content);
 *
 * @example
 * // Re-rendering with new data
 * const { content, render } = compileTemplate('<span>Count: {{count}}</span>');
 * render({ count: 0 });
 * render({ count: 1 }); // DOM updates automatically
 *
 * @example
 * // With strict mode and error handling
 * const { render } = compileTemplate('{{missing}}', {
 *     strict: true,
 *     onError: (msg) => console.error(msg)
 * });
 * render({}); // Throws error for missing path
 *
 * @example
 * // Event handling in loops with r-<event>
 * const tpl = compileTemplate(`
 *     <ul>
 *         <li loop="row in rows">
 *             {{row.name}}
 *             <button r-click="removeRow(row)">x</button>
 *         </li>
 *     </ul>
 * `);
 *
 * // The handler is looked up in the functions context passed to render.
 * tpl.render(
 *     { rows: [{ id: 1, name: 'Apple' }] },
 *     { removeRow: (row) => console.log('remove', row.id) }
 * );
 * document.body.appendChild(tpl.content);
 */
export function compileTemplate<T extends object = Context>(
    templateStr: string,
    config: EngineConfig = { strict: false },
): CompiledTemplate<T> {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<template><div>${templateStr}</div></template>`, 'text/html');
    const content = doc.querySelector('template')!.content.firstElementChild as HTMLElement;
    const render = compileDOM(content, config);

    return {
        content,
        render(ctx: T, fns?: FunctionsContext | null) {
            const rendered = render(ctx as unknown as Context, fns);
            if (!rendered) {
                handleError(
                    config,
                    'render() was given the same context object as last time, so nothing was ' +
                        'updated. Mutating an object and rendering it again is not seen. Pass a ' +
                        'new object, such as { ...state }, when the data has changed',
                    `Template: "${templateStr.trim().slice(0, 120)}"`,
                    'render(ctx)',
                );
            }
        },
    };
}