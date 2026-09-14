import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RelaxError, onError, reportError, asyncHandler } from '../src/errors';

/**
 * The hint is printed once per page load, which in a test run means once per module instance.
 * Resetting the module registry gives each test a module that has not hinted yet.
 */
async function freshErrorModule() {
    vi.resetModules();
    return await import('../src/errors');
}

describe('Error Handling', () => {
    beforeEach(() => {
        onError(null as any);
        delete window.relaxDebug;
        delete window.relaxErrors;
    });

    describe('RelaxError', () => {
        it('should store message and context', () => {
            const error = new RelaxError('test error', { key: 'value' });
            expect(error.message).toBe('test error');
            expect(error.context).toEqual({ key: 'value' });
        });

        it('should be an instance of Error', () => {
            const error = new RelaxError('test', {});
            expect(error).toBeInstanceOf(Error);
        });
    });

    describe('reportError without handler', () => {
        it('should return RelaxError', () => {
            const error = reportError('boom', { route: 'home' });
            expect(error).toBeInstanceOf(RelaxError);
        });

        it('should include message and context in returned error', () => {
            const error = reportError('something broke', { orderId: 42 });
            expect(error).toBeInstanceOf(RelaxError);
            expect(error!.message).toBe('something broke');
            expect(error!.context).toEqual({ orderId: 42 });
        });
    });

    describe('reportError with handler', () => {
        it('should call handler with error and context', () => {
            let captured: RelaxError | null = null;
            onError((error) => {
                captured = error;
            });

            const error = reportError('fail', { route: 'user' });
            expect(error).not.toBeNull();
            expect(captured).not.toBeNull();
            expect(captured!.message).toBe('fail');
            expect(captured!.context).toEqual({ route: 'user' });
        });

        it('should return error when handler does not suppress', () => {
            onError(() => {});

            const error = reportError('still returns', {});
            expect(error).toBeInstanceOf(RelaxError);
        });

        it('should return null when handler calls suppress', () => {
            onError((_error, ctx) => {
                ctx.suppress();
            });

            const error = reportError('suppressed', { route: 'optional' });
            expect(error).toBeNull();
        });

        it('should replace previous handler on subsequent onError calls', () => {
            const calls: number[] = [];

            onError(() => { calls.push(1); });
            onError(() => { calls.push(2); });

            reportError('test', {});
            expect(calls).toEqual([2]);
        });

        it('should let handler decide per-error whether to suppress', () => {
            onError((error, ctx) => {
                if (error.context.optional) {
                    ctx.suppress();
                }
            });

            const critical = reportError('critical', { optional: false });
            expect(critical).toBeInstanceOf(RelaxError);

            const skippable = reportError('skippable', { optional: true });
            expect(skippable).toBeNull();
        });
    });

    describe('discovering errors nobody is listening for', () => {
        it('reported_errors_are_kept_on_window_so_they_can_be_read_after_the_fact', () => {
            reportError('first', { step: 1 });
            reportError('second', { step: 2 });

            expect(window.relaxErrors?.map((e) => e.message)).toEqual(['first', 'second']);
        });

        it('a_suppressed_error_is_still_recorded_so_the_buffer_tells_the_truth', () => {
            onError((_error, ctx) => ctx.suppress());

            reportError('suppressed but real', {});

            expect(window.relaxErrors?.map((e) => e.message)).toEqual(['suppressed but real']);
        });

        it('the_buffer_keeps_the_most_recent_errors_so_it_cannot_grow_without_bound', () => {
            for (let i = 0; i < 60; i++) {
                reportError(`error ${i}`, {});
            }

            expect(window.relaxErrors).toHaveLength(50);
            expect(window.relaxErrors![0].message).toBe('error 10');
            expect(window.relaxErrors![49].message).toBe('error 59');
        });

        it('an_unhandled_report_prints_one_hint_naming_how_to_see_errors', async () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const errors = await freshErrorModule();

            errors.reportError('nobody is listening', {});

            expect(warn).toHaveBeenCalledTimes(1);
            const hint = warn.mock.calls[0][0] as string;
            expect(hint).toContain('relaxDebug');
            expect(hint).toContain('relaxErrors');
            expect(hint).toContain('onError');
            warn.mockRestore();
        });

        it('the_hint_is_not_repeated_once_it_has_been_shown', async () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const errors = await freshErrorModule();

            errors.reportError('first', {});
            errors.reportError('second', {});
            errors.reportError('third', {});

            expect(warn).toHaveBeenCalledTimes(1);
            warn.mockRestore();
        });

        it('a_registered_handler_means_no_hint_because_someone_is_already_listening', async () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const errors = await freshErrorModule();
            errors.onError(() => {});

            errors.reportError('handled', {});

            expect(warn).not.toHaveBeenCalled();
            warn.mockRestore();
        });

        it('the_errors_flag_prints_every_report_so_a_browser_shows_them_all', () => {
            const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
            window.relaxDebug = { errors: true };

            reportError('shown', { route: 'home' });
            reportError('also shown', {});

            expect(consoleError).toHaveBeenCalledTimes(2);
            expect(consoleError.mock.calls[0][0]).toContain('shown');
            expect(consoleError.mock.calls[0][1]).toEqual({ route: 'home' });
            consoleError.mockRestore();
        });

        it('the_errors_flag_replaces_the_hint_because_the_reader_already_found_it', async () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
            const errors = await freshErrorModule();
            window.relaxDebug = { errors: true };

            errors.reportError('shown', {});

            expect(warn).not.toHaveBeenCalled();
            warn.mockRestore();
            consoleError.mockRestore();
        });
    });

    describe('asyncHandler', () => {
        it('should_return_a_synchronous_function', () => {
            const wrapped = asyncHandler(async () => {});
            expect(typeof wrapped).toBe('function');
        });

        it('should_call_the_async_function', async () => {
            let called = false;
            const wrapped = asyncHandler(async () => {
                called = true;
            });

            wrapped();
            await new Promise(r => setTimeout(r, 0));

            expect(called).toBe(true);
        });

        it('should_forward_arguments_to_the_wrapped_function', async () => {
            let receivedArgs: unknown[] = [];
            const wrapped = asyncHandler(async (...args: unknown[]) => {
                receivedArgs = args;
            });

            wrapped('a', 42);
            await new Promise(r => setTimeout(r, 0));

            expect(receivedArgs).toEqual(['a', 42]);
        });

        it('should_report_error_when_async_function_rejects', async () => {
            let reportedError: RelaxError | null = null;
            onError((error, ctx) => {
                reportedError = error;
                ctx.suppress();
            });

            const wrapped = asyncHandler(async () => {
                throw new Error('boom');
            });

            wrapped();
            await new Promise(r => setTimeout(r, 0));

            expect(reportedError).not.toBeNull();
            expect(reportedError!.message).toBe('Async callback failed');
            expect(reportedError!.context.cause).toBeInstanceOf(Error);
        });

        it('should_not_report_error_when_async_function_succeeds', async () => {
            let reportedError: RelaxError | null = null;
            onError((error, ctx) => {
                reportedError = error;
                ctx.suppress();
            });

            const wrapped = asyncHandler(async () => {
                // success
            });

            wrapped();
            await new Promise(r => setTimeout(r, 0));

            expect(reportedError).toBeNull();
        });
    });
});
