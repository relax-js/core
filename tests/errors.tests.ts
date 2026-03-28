import { describe, it, expect, beforeEach } from 'vitest';
import { RelaxError, onError, reportError } from '../src/errors';

describe('Error Handling', () => {
    beforeEach(() => {
        onError(null as any);
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
});
