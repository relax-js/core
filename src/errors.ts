/**
 * Global error handling for Relaxjs.
 * Register a handler with `onError()` to intercept errors before they throw.
 * Call `ctx.suppress()` in the handler to prevent the error from being thrown.
 *
 * @example
 * import { onError } from 'relaxjs';
 *
 * onError((error, ctx) => {
 *     logToService(error.message, error.context);
 *     showToast(error.message);
 *     ctx.suppress();
 * });
 */

/**
 * Passed to error handlers to control error behavior.
 * Call `suppress()` to prevent the error from being thrown.
 */
export interface ErrorContext {
    suppress(): void;
}

/**
 * Error with structured context for debugging.
 * The `context` record contains details like route name, component tag, route data.
 *
 * @example
 * onError((error, ctx) => {
 *     console.log(error.context.route);
 *     console.log(error.context.componentTagName);
 * });
 */
export class RelaxError extends Error {
    constructor(
        message: string,
        public context: Record<string, unknown>,
    ) {
        super(message);
    }
}

/** @internal */
type ErrorHandler = (error: RelaxError, ctx: ErrorContext) => void;

let handler: ErrorHandler | null = null;

/**
 * Registers a global error handler for Relaxjs errors.
 * The handler receives the error and an `ErrorContext`.
 * Call `ctx.suppress()` to prevent the error from being thrown.
 * Only one handler can be active at a time; subsequent calls replace the previous handler.
 *
 * @example
 * onError((error, ctx) => {
 *     if (error.context.route === 'optional-panel') {
 *         ctx.suppress();
 *         return;
 *     }
 *     showErrorDialog(error.message);
 * });
 */
export function onError(fn: ErrorHandler) {
    handler = fn;
}

/**
 * Reports an error through the global handler.
 * Returns the `RelaxError` if it should be thrown, or `null` if the handler suppressed it.
 * The caller is responsible for throwing the returned error.
 *
 * @param message - Human-readable error description
 * @param context - Structured data for debugging (route, component, params, cause, etc.)
 * @returns The error to throw, or `null` if suppressed
 *
 * @example
 * const error = reportError('Failed to load route component', {
 *     route: 'user',
 *     componentTagName: 'user-profile',
 *     routeData: { id: 123 },
 * });
 * if (error) throw error;
 */
export function reportError(message: string, context: Record<string, unknown>): RelaxError | null {
    const error = new RelaxError(message, context);
    if (handler) {
        let suppressed = false;
        const ctx: ErrorContext = {
            suppress() { suppressed = true; },
        };
        handler(error, ctx);
        if (suppressed) {
            return null;
        }
    }
    return error;
}
