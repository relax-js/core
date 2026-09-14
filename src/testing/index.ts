/**
 * @module testing
 * Test helpers for applications built on Relaxjs.
 *
 * These exist because the interesting failures in a component are asynchronous or silent:
 * a custom element upgrades on the next task, and a template that cannot resolve an
 * expression reports the problem rather than throwing. Without helpers, every project
 * reinvents the same waiting and the same error capture, usually slightly differently.
 *
 * Import from `@relax.js/core/testing` in test files only.
 */

import { ErrorHandler, RelaxError, onError } from '../errors';

/**
 * Waits for pending microtasks and the next macrotask so DOM work started by a
 * lifecycle callback has finished.
 *
 * Custom element callbacks are synchronous, but anything they kick off with `await`
 * is not, so asserting straight after `mount()` sees the element before its data arrived.
 *
 * @example
 * const { element } = mount('user-profile');
 * await flush();
 * expect(element.querySelector('h1')?.textContent).toBe('Alice');
 */
export function flush(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * An element attached to the document, with the means to detach it again.
 */
export interface MountedElement<T extends HTMLElement> {
    element: T;
    /** Removes the element from the document so `disconnectedCallback` runs. */
    unmount(): void;
}

/**
 * Attaches an element to `document.body` so its lifecycle callbacks run.
 *
 * A custom element only upgrades and connects once it is in the document, so a component
 * created with `document.createElement` alone never runs `connectedCallback`.
 *
 * @param target - Tag name to create, or an element to attach
 *
 * @example
 * const { element, unmount } = mount<UserProfile>('user-profile');
 * element.setAttribute('user-id', '42');
 * await flush();
 * unmount();
 */
export function mount<T extends HTMLElement>(target: string | T): MountedElement<T> {
    const element = (typeof target === 'string' ? document.createElement(target) : target) as T;
    document.body.appendChild(element);

    return {
        element,
        unmount() {
            element.remove();
        },
    };
}

/**
 * Errors collected while a capture is installed.
 */
export interface CapturedErrors {
    /** Every `RelaxError` reported since the capture was installed, in order. */
    errors: RelaxError[];
    /** Messages of the collected errors, for readable assertions. */
    messages(): string[];
    /** Puts the previously registered handler back. */
    restore(): void;
}

/**
 * Collects Relaxjs errors instead of letting them throw, so a test can assert on failures
 * that would otherwise only be visible in a browser console.
 *
 * This is what turns a template typo into a test failure. A mistyped expression such as
 * `{{user.naem}}` renders an empty string and reports the problem; without capturing it,
 * the test sees an empty element and no reason for it.
 *
 * Errors are suppressed while the capture is installed, so rendering continues and the
 * assertion is reached.
 *
 * @example
 * const captured = captureRelaxErrors();
 * try {
 *     render({ user: { name: 'Alice' } });
 *     expect(captured.messages()).toEqual([]);
 * } finally {
 *     captured.restore();
 * }
 */
export function captureRelaxErrors(): CapturedErrors {
    const errors: RelaxError[] = [];
    let previous: ErrorHandler | null = null;

    previous = onError((error, ctx) => {
        errors.push(error);
        ctx.suppress();
    });

    return {
        errors,
        messages() {
            return errors.map((error) => error.message);
        },
        restore() {
            onError(previous as ErrorHandler);
        },
    };
}
