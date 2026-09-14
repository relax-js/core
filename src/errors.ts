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

export type ErrorHandler = (error: RelaxError, ctx: ErrorContext) => void;

declare global {
    interface Window {
        /**
         * Every error Relaxjs has reported, most recent last, capped at
         * `REPORTED_ERROR_LIMIT`. Read it from the console after something went
         * wrong instead of reproducing the problem with a trace flag on.
         */
        relaxErrors?: RelaxError[];
    }
}

const REPORTED_ERROR_LIMIT = 50;

let handler: ErrorHandler | null = null;
let hintShown = false;

function record(error: RelaxError): void {
    const reported = (window.relaxErrors ??= []);
    reported.push(error);
    if (reported.length > REPORTED_ERROR_LIMIT) {
        reported.shift();
    }
}

/**
 * Names the ways of seeing Relaxjs errors, once, the first time one is reported
 * with nobody listening and no trace flag set.
 *
 * Errors stay quiet by default because they surface in a deployed application as
 * often as in development, and a library that prints to a production console is a
 * library people learn to ignore. That leaves a discovery problem: nothing tells
 * you the errors exist. One line, once, solves it without becoming noise.
 */
function hintOnce(): void {
    if (hintShown) return;
    hintShown = true;
    console.warn(
        '[relaxjs] An error was reported and nothing is listening for it. ' +
        'Set window.relaxDebug = { errors: true } to print errors as they happen, ' +
        'read window.relaxErrors for the ones already reported, ' +
        'register onError() to handle them in the application, ' +
        'or use captureRelaxErrors() from @relax.js/core/testing to assert on them in a test.',
    );
}

/**
 * Registers a global error handler for Relaxjs errors.
 * The handler receives the error and an `ErrorContext`.
 * Call `ctx.suppress()` to prevent the error from being thrown.
 * Only one handler can be active at a time; subsequent calls replace the previous handler.
 * The replaced handler is returned so a caller that installs a temporary handler can put
 * the previous one back.
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
export function onError(fn: ErrorHandler): ErrorHandler | null {
    const previous = handler;
    handler = fn;
    return previous;
}

/**
 * Reports an error through the global handler.
 * Returns the `RelaxError` if it should be thrown, or `null` if the handler suppressed it.
 * The caller is responsible for throwing the returned error.
 *
 * Every reported error is appended to `window.relaxErrors` whether a handler is
 * registered or not, and printed to the console when
 * `window.relaxDebug = { errors: true }`.
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
    record(error);

    const printing = window.relaxDebug?.errors === true;
    if (printing) {
        console.error(`[relaxjs] ${message}`, context);
    }

    if (handler) {
        let suppressed = false;
        const ctx: ErrorContext = {
            suppress() { suppressed = true; },
        };
        handler(error, ctx);
        if (suppressed) {
            return null;
        }
    } else if (!printing) {
        hintOnce();
    }

    return error;
}

/**
 * Wraps an async function into a synchronous callback suitable for addEventListener.
 * Catches promise rejections and reports them through the global error handler.
 *
 * @param fn - Async function to wrap
 * @returns Synchronous function that can be passed to addEventListener
 *
 * @example
 * button.addEventListener('click', asyncHandler(async (e) => {
 *     await saveData();
 * }));
 *
 * @example
 * form.addEventListener('submit', asyncHandler(async (e) => {
 *     e.preventDefault();
 *     await submitForm();
 * }));
 */
export function asyncHandler<TArgs extends unknown[]>(
    fn: (...args: TArgs) => Promise<void>,
): (...args: TArgs) => void {
    return function (this: any, ...args: TArgs) {
        fn.call(this, ...args).catch((cause: unknown) => {
            const error = reportError('Async callback failed', { cause });
            if (error) throw error;
        });
    };
}
