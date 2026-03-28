/**
 * Finds exactly one element matching the selector. When the selector starts
 * with `#`, both `id` and `name` attributes are tried.
 *
 * @example
 *     const input = selectOne<HTMLInputElement>('#email');
 *     const btn = selectOne<HTMLButtonElement>('.submit', form);
 */
export function selectOne<T extends Element = HTMLElement>(
    selector: string,
    parent?: Element | Document,
): T {
    const root = parent ?? document;

    let el: Element | null;
    if (selector.startsWith('#')) {
        const name = selector.slice(1);
        el = root.querySelector(`#${CSS.escape(name)}`)
            ?? root.querySelector(`[name="${name}"]`);
    } else {
        el = root.querySelector(selector);
    }

    if (!el) {
        throw new Error(`No element found matching '${selector}'`);
    }

    return el as T;
}

/**
 * Sets a validation error on a form field found by selector. Supports native
 * form elements and form-associated custom elements using `ElementInternals`.
 *
 * @example
 *     formError('#email', 'Please enter a valid email');
 *     formError('#email', ''); // clears the error
 */
export function formError(
    selector: string,
    message: string,
    parent?: Element | Document,
): void {
    const el = selectOne<HTMLElement>(selector, parent);

    if (
        el instanceof HTMLInputElement
        || el instanceof HTMLSelectElement
        || el instanceof HTMLTextAreaElement
        || el instanceof HTMLButtonElement
    ) {
        el.setCustomValidity(message);
        el.reportValidity();
        return;
    }

    if (
        (el.constructor as any).formAssociated === true
        && 'setCustomValidity' in el
    ) {
        (el as any).setCustomValidity(message);
        (el as any).reportValidity();
        return;
    }

    throw new Error(
        `Element matching '${selector}' is not a form field`,
    );
}
