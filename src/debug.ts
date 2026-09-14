/**
 * Trace switches for diagnosing library behaviour inside a running application.
 *
 * Traces ship in the production build on purpose. A routing problem normally
 * shows up in a deployed app, and traces that were stripped at build time are
 * exactly the ones missing when that happens. They are off by default and cost
 * one property read while off, so turn them on, reproduce, and read the console.
 *
 * @example
 * // In the browser console, before reproducing the problem:
 * window.relaxDebug = { routing: true };
 *
 * @example
 * // From application code, so a reload keeps them on:
 * window.relaxDebug = { routing: true };
 * startRouting();
 */
export interface RelaxDebugFlags {
    /**
     * Route registration, layout resolution, every navigation, and the page
     * reloads performed to switch layout.
     */
    routing?: boolean;

    /**
     * Expressions that could not be resolved while rendering. Templates render
     * an empty string for these by default, so nothing else reports them.
     */
    templates?: boolean;

    /**
     * Every error reported through `reportError`, printed with its context.
     * Errors are always collected in `window.relaxErrors` whether this is on
     * or not, so turning it on is about seeing them as they happen rather than
     * about recording them.
     */
    errors?: boolean;
}

declare global {
    interface Window {
        relaxDebug?: RelaxDebugFlags;
    }
}
