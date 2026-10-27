import { reportError } from '../errors';

/**
 * Anything that can sit between two tags: an element, text, a number, or a list of those.
 * `null`, `undefined`, `true` and `false` render nothing, so `{busy && <Spinner />}` works.
 */
export type Child = Node | string | number | boolean | null | undefined | Child[];

/** A function used as a tag. It runs once and returns the element it built. */
export type FunctionComponent<P = Record<string, unknown>> = (props: P) => HTMLElement;

type CustomElementClass = new (...args: any[]) => HTMLElement;

type IsReadonly<T, K extends keyof T> =
    (<V>() => V extends { [Q in K]: T[K] } ? 1 : 2) extends
    (<V>() => V extends { -readonly [Q in K]: T[K] } ? 1 : 2)
        ? false
        : true;

type WritableProperties<E> = {
    [K in keyof E as K extends string
        ? IsReadonly<E, K> extends true
            ? never
            : E[K] extends (...args: any[]) => any
                ? never
                : K
        : never]?: E[K];
};

/**
 * Listeners for `on={{ ... }}`. Only events registered in `GlobalEventHandlersEventMap` are
 * accepted, which is where Relaxjs event classes are registered anyway.
 */
export type EventListeners = {
    [K in keyof GlobalEventHandlersEventMap]?: (event: GlobalEventHandlersEventMap[K]) => void;
};

/**
 * The props a tag accepts: every writable DOM property of the element, typed from lib.dom, plus
 * `style` as a CSS string, `on` for listeners, and any name with a dash as an attribute.
 */
export type ElementProps<E> = Omit<WritableProperties<E>, 'style'> & {
    style?: string;
    on?: EventListeners;
    children?: Child;
};

/**
 * Builds a real DOM element. TypeScript calls it for every tag in a `.tsx` file when the project
 * sets `"jsx": "react"` and `"jsxFactory": "h"`, so `<li className="row">{name}</li>` becomes
 * `h('li', { className: 'row' }, name)` on the same line.
 *
 * A prop name with a dash is set with `setAttribute`. Every other name is assigned to the DOM
 * property of that name, so write `className`, `htmlFor` and `onclick` as the DOM spells them.
 * Text children become text nodes and are never parsed as HTML.
 *
 * Nothing is kept after the call: no virtual DOM, no re-render. To change the element later,
 * keep it in a variable and assign to it.
 *
 * @example
 * import { h } from '@relax.js/core/jsx';
 *
 * const input = <input type="email" required /> as HTMLInputElement;
 * form.append(<label htmlFor="email">Email</label>, input);
 * input.value = user.email;
 */
export function h(
    type: string | FunctionComponent<any> | CustomElementClass,
    props: Record<string, unknown> | null,
    ...children: Child[]
): HTMLElement {
    if (typeof type === 'function') {
        if (type.prototype instanceof HTMLElement) {
            return createCustomElement(type as CustomElementClass, props, children);
        }
        return (type as FunctionComponent<any>)({ ...props, children });
    }

    const element = document.createElement(type);
    applyProps(element, props, true);
    append(element, children);
    return element;
}

function createCustomElement(
    type: CustomElementClass,
    props: Record<string, unknown> | null,
    children: Child[]
): HTMLElement {
    if (customElements.getName && !customElements.getName(type)) {
        const error = reportError(
            `<${type.name} /> cannot be created because ${type.name} is not registered with customElements. Import the module that calls customElements.define() for it.`,
            { component: type.name }
        );
        if (error) throw error;
        return undefined as unknown as HTMLElement;
    }

    const element = new type();
    applyProps(element, props, false);
    append(element, children);
    return element;
}

/**
 * Built-in elements are checked with `name in element`, so a React spelling such as `onClick`
 * that slipped past the types is reported instead of becoming an expando. Custom elements are
 * not checked: a field declared without an initializer is not an own property under older
 * compile targets, and the class type already checks the names.
 */
function applyProps(
    element: HTMLElement,
    props: Record<string, unknown> | null,
    checkName: boolean
) {
    if (!props) return;

    for (const [name, value] of Object.entries(props)) {
        if (name === 'on') {
            addListeners(element, value as Record<string, EventListener>);
        } else if (name.includes('-')) {
            setAttribute(element, name, value);
        } else if (checkName && !(name in element)) {
            reportUnknownProperty(element, name);
        } else {
            (element as any)[name] = value;
        }
    }
}

function addListeners(element: HTMLElement, listeners: Record<string, EventListener>) {
    for (const [type, listener] of Object.entries(listeners)) {
        element.addEventListener(type, listener);
    }
}

function setAttribute(element: HTMLElement, name: string, value: unknown) {
    if (value === null || value === undefined || value === false) return;
    element.setAttribute(name, value === true ? '' : String(value));
}

function reportUnknownProperty(element: HTMLElement, name: string) {
    const tag = element.tagName.toLowerCase();
    const error = reportError(
        `<${tag}> has no property '${name}', so it was not set. Write the DOM property name (className, htmlFor, onclick), or a name with a dash to set an attribute.`,
        { tag, property: name }
    );
    if (error) throw error;
}

function append(parent: HTMLElement, child: Child) {
    if (Array.isArray(child)) {
        child.forEach((item) => append(parent, item));
    } else if (child === null || child === undefined || typeof child === 'boolean') {
        return;
    } else if (typeof child === 'string' || typeof child === 'number') {
        parent.append(String(child));
    } else if (child instanceof Node) {
        parent.append(child);
    } else {
        const tag = parent.tagName.toLowerCase();
        const error = reportError(
            `<${tag}> was given a ${typeof child} as a child, which cannot be rendered. Pass an element, text, a number, or an array of those.`,
            { tag, child }
        );
        if (error) throw error;
    }
}

/**
 * Types for `.tsx` files. TypeScript looks for them on the factory (`h.JSX`) before the global
 * `JSX`, so this does not clash with React types elsewhere in the same project.
 *
 * Every tag is typed `HTMLElement`; TypeScript cannot give `<ul />` a type per tag. Cast where a
 * tag-specific member is needed: `<input /> as HTMLInputElement`.
 */
export declare namespace h {
    namespace JSX {
        type Element = HTMLElement;
        type ElementClass = HTMLElement;
        interface ElementAttributesProperty {}
        interface ElementChildrenAttribute {
            children: {};
        }
        type IntrinsicElements = {
            [K in keyof HTMLElementTagNameMap]: ElementProps<HTMLElementTagNameMap[K]>;
        };
        type LibraryManagedAttributes<C, P> = C extends new (...args: any[]) => infer I
            ? ElementProps<I>
            : P;
    }
}
