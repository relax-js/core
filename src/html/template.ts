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
  
  function handleError(config: EngineConfig, message: string, context: string, shouldThrow = false): void {
    const formattedMessage = `[template error] ${message} (at ${context})`;
    
    if (config.onError) config.onError(formattedMessage);
    if (config.strict || shouldThrow) throw new Error(formattedMessage);
  }
  
function createGetter(config: EngineConfig): Getter {
    return function get(ctx: ContextValue, path: Path, debugInfo = ''): TemplateValue {
        try {
            const current = resolvePath(ctx, path);

            if (current === undefined) {
                handleError(config, `Cannot resolve "${path}"`, debugInfo);
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
            handleError(config, `Exception resolving "${path}": ${errorMessage}`, debugInfo, true);
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
            handleError(config, `Function "${parsed.fnName}" not found`, debugInfo);
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
            handleError(config, `Error calling "${parsed.fnName}": ${errorMessage}`, debugInfo);
            return '';
        }
    } else {
        // Path resolution
        const resolved = resolvePath(ctx, parsed.path!);
        if (resolved === undefined) {
            handleError(config, `Cannot resolve "${parsed.path}"`, debugInfo);
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
  
// Improved text node patcher with expression memoization
const expressionCache = new Map<string, { parsed: ParsedExpression; literal: string }[]>();

function textNodePatcher(node: Node, _get: Getter, config: EngineConfig): Setter | void {
    if (node.nodeType !== Node.TEXT_NODE || !node.textContent?.includes('{{')) return;

    const raw = node.textContent;

    // Use cached parsed expressions if available
    if (!expressionCache.has(raw)) {
        const parts = raw.split(/(\{\{.*?\}\})/);
        const parsed = parts.map(part => {
            if (part.startsWith('{{')) {
                const expr = part.slice(2, -2).trim();
                return { parsed: parseExpression(expr), literal: '' };
            } else {
                return { parsed: null as unknown as ParsedExpression, literal: part };
            }
        });
        expressionCache.set(raw, parsed);
    }

    const exprs = expressionCache.get(raw)!;
    const debugInfo = `TextNode: "${raw}"`;

    return (ctx: Context, fns?: FunctionsContext) => {
        const result = exprs.map(({ parsed, literal }) => {
            if (parsed) {
                return String(evaluateExpression(parsed, ctx, fns, config, debugInfo));
            }
            return literal;
        }).join('');
        (node as Text).textContent = result;
    };
}
  
function attributeInterpolationPatcher(node: Node, _get: Getter, config: EngineConfig): Setter | void {
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const element = node as Element;
    const setters: Setter[] = [];

    // Use Array.from to safely iterate over NamedNodeMap
    const attributes = Array.from(element.attributes);
    for (const attr of attributes) {
        const match = attr.value.match(/\{\{(.+?)\}\}/);
        if (match) {
            const expr = match[1].trim();
            const parsed = parseExpression(expr);
            const name = attr.name;
            const debugInfo = `Attribute: ${name} on <${element.tagName.toLowerCase()}>`;
            setters.push((ctx: Context, fns?: FunctionsContext) => {
                const value = evaluateExpression(parsed, ctx, fns, config, debugInfo);
                element.setAttribute(name, String(value));
            });
        }
    }

    if (setters.length > 0) {
        return (ctx: Context, fns?: FunctionsContext) => setters.forEach(fn => fn(ctx, fns));
    }
}
  
/**
 * Caches the detached element+renderer when hiding so that re-showing
 * skips the clone + compile overhead. Render-before-insert order is
 * preserved for both fresh and cached paths.
 */
function createConditionalPatcher(
    node: Node,
    get: Getter,
    config: EngineConfig,
    attrName: string,
    shouldRender: (value: TemplateValue) => boolean
): Setter | void {
    if (node.nodeType !== Node.ELEMENT_NODE || !(node as Element).hasAttribute(attrName)) return;

    const element = node as Element;
    const expr = element.getAttribute(attrName)!;
    const templateNode = element.cloneNode(true) as Element;
    const placeholder = document.createComment(`${attrName}: ${expr}`);
    const parent = element.parentNode!;

    parent.insertBefore(placeholder, element);
    element.remove();

    let currentElement: Element | null = null;
    let currentRenderer: ((ctx: Context, fns?: FunctionsContext) => void) | null = null;
    let cachedElement: Element | null = null;
    let cachedRenderer: ((ctx: Context, fns?: FunctionsContext) => void) | null = null;

    return (ctx: Context, fns?: FunctionsContext) => {
        const value = get(ctx, expr, `${attrName}="${expr}"`);
        const shouldBeVisible = shouldRender(value);

        if (shouldBeVisible && !currentElement) {
            if (cachedElement && cachedRenderer) {
                currentElement = cachedElement;
                currentRenderer = cachedRenderer;
                cachedElement = null;
                cachedRenderer = null;
            } else {
                const clone = templateNode.cloneNode(true) as Element;
                clone.removeAttribute(attrName);
                currentElement = clone;
                currentRenderer = compileDOM(clone, config);
            }
            currentRenderer(ctx, fns);
            parent.insertBefore(currentElement, placeholder.nextSibling);
        } else if (shouldBeVisible && currentRenderer) {
            currentRenderer(ctx, fns);
        }

        if (!shouldBeVisible && currentElement) {
            currentElement.remove();
            cachedElement = currentElement;
            cachedRenderer = currentRenderer;
            currentElement = null;
            currentRenderer = null;
        }
    };
}

function ifPatcher(node: Node, get: Getter, config: EngineConfig): Setter | void {
    return createConditionalPatcher(node, get, config, 'if', value => !!value);
}

function unlessPatcher(node: Node, get: Getter, config: EngineConfig): Setter | void {
    return createConditionalPatcher(node, get, config, 'unless', value => !value);
}
  
interface LoopSlot {
    element: Element;
    renderer: (ctx: Context, fns?: FunctionsContext) => void;
}

/**
 * Rendering order for loop items:
 *
 * 1. Clone from template (detached, attributes still contain mustache)
 * 2. Compile the clone — creates setters for mustache in attributes/text
 * 3. Render — resolves mustache against the iteration context
 * 4. Insert into DOM — custom elements upgrade with final attribute values
 *
 * Steps 2-3 MUST happen before step 4. If we insert first, the browser
 * upgrades custom elements immediately (connectedCallback fires) while
 * attributes still contain raw "{{expr}}" strings.
 *
 * Slot reuse: existing elements are re-rendered in place (already in DOM,
 * already compiled). Only new items go through the full clone-compile-render-
 * insert sequence. Excess items are removed.
 */
function loopPatcher(node: Node, _get: Getter, config: EngineConfig): Setter | void {
    if (node.nodeType !== Node.ELEMENT_NODE || !(node as Element).hasAttribute('loop')) return;

    const element = node as Element;
    const loopDef = element.getAttribute('loop')!;
    const match = loopDef.match(/(\w+)\s+in\s+(.+)/);
    if (!match) {
        handleError(config, `Invalid loop syntax: "${loopDef}"`, `Element: <${element.tagName.toLowerCase()}>`);
        return;
    }

    const [, alias, source] = match;
    const tpl = element.cloneNode(true) as Element;
    tpl.removeAttribute('loop');

    const parent = element.parentNode!;
    const placeholder = document.createComment(`loop: ${loopDef}`);
    parent.insertBefore(placeholder, element);
    element.remove();

    let slots: LoopSlot[] = [];

    return (ctx: Context, fns?: FunctionsContext) => {
        const items = resolvePath(ctx, source);

        if (items === undefined) {
            handleError(config, `Cannot resolve "${source}"`, `Loop source: "${loopDef}"`);
            return;
        }

        if (!Array.isArray(items)) {
            handleError(config, `"${source}" is not an array in loop: "${loopDef}"`,
                `Element: <${tpl.tagName.toLowerCase()}>`);
            return;
        }

        const reuseCount = Math.min(slots.length, items.length);

        // Re-render existing slots in place
        for (let i = 0; i < reuseCount; i++) {
            slots[i].renderer({ ...ctx, [alias]: items[i] }, fns);
        }

        // Remove excess slots
        for (let i = slots.length - 1; i >= items.length; i--) {
            slots[i].element.remove();
        }

        // Create new slots via DocumentFragment for batch insertion
        if (items.length > reuseCount) {
            const frag = document.createDocumentFragment();
            const newSlots: LoopSlot[] = [];

            for (let i = reuseCount; i < items.length; i++) {
                // 1. Clone (detached — no connectedCallback yet)
                const instance = tpl.cloneNode(true) as Element;

                // 2-3. Compile + render while detached — resolves mustache
                const childRenderer = compileDOM(instance, config);
                childRenderer({ ...ctx, [alias]: items[i] }, fns);

                frag.appendChild(instance);
                newSlots.push({ element: instance, renderer: childRenderer });
            }

            // 4. Batch-insert into live DOM — custom elements upgrade with final values
            const insertAfter = reuseCount > 0
                ? slots[reuseCount - 1].element
                : placeholder;
            parent.insertBefore(frag, insertAfter.nextSibling);

            slots = slots.slice(0, reuseCount).concat(newSlots);
        } else {
            slots.length = items.length;
        }
    };
}
  
/**
 * Structural patchers (loop, if, unless) take full ownership of a node.
 * They replace the original with a placeholder, then on each render they
 * clone, compile, and resolve the node independently. When one matches,
 * content patchers and child traversal are skipped for that node.
 */
const structuralPatchers: Patcher[] = [
    loopPatcher,
    ifPatcher,
    unlessPatcher
];

/** Content patchers resolve mustache expressions in text nodes and attributes. */
const contentPatchers: Patcher[] = [
    textNodePatcher,
    attributeInterpolationPatcher,
];

/**
 * Walks the DOM tree and collects setters from patchers.
 *
 * Processing order per node:
 * 1. Try structural patchers — if one matches, it owns the node (skip steps 2-3)
 * 2. Run content patchers (text interpolation, attribute interpolation)
 * 3. Recurse into child nodes
 */
function compileDOM(root: Node, config: EngineConfig): (ctx: Context, fns?: FunctionsContext) => void {
    const setters: Setter[] = [];
    const get = createGetter(config);

    function processNode(node: Node) {
        // Structural directives own the node — they clone + compileDOM internally
        for (const patch of structuralPatchers) {
            const setter = patch(node, get, config);
            if (setter) {
                setters.push(setter);
                return;
            }
        }

        // Content patchers — resolve {{expr}} in text and attributes
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
    return (ctx: Context, fns?: FunctionsContext) => {
        // Only re-render if context has changed
        if (lastCtx !== ctx || lastFns !== fns) {
            setters.forEach(fn => fn(ctx, fns));
            lastCtx = ctx;
            lastFns = fns;
        }
    };
}

/**
 * Result of compiling a template.
 * Contains the DOM content and a render function for updating it with data.
 */
export interface CompiledTemplate {
    /** The compiled DOM element containing the template structure. */
    content: DocumentFragment | HTMLElement;
    /**
     * Updates the DOM with the provided data context.
     * Memoized: only re-renders when context object reference changes.
     * @param ctx - Data context with values for template expressions
     * @param fns - Optional functions context for callable expressions
     */
    render: (ctx: Context, fns?: FunctionsContext) => void;
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
 */
export function compileTemplate(templateStr: string, config: EngineConfig = { strict: false }): CompiledTemplate {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<template><div>${templateStr}</div></template>`, 'text/html');
    const content = doc.querySelector('template')!.content.firstElementChild as HTMLElement;
    const render = compileDOM(content, config);

    return { content, render };
}