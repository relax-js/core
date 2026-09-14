import { describe, it, expect, beforeEach } from 'vitest';
import { flush, mount, captureRelaxErrors } from '../../src/testing';
import { onError, reportError } from '../../src/errors';
import { compileTemplate } from '../../src/html/template';

class SlowLoadingPage extends HTMLElement {
    loaded = false;

    connectedCallback() {
        this.load();
    }

    private async load() {
        await Promise.resolve();
        this.loaded = true;
        this.textContent = 'loaded';
    }
}
customElements.define('test-slow-loading-page', SlowLoadingPage);

class DisconnectRecordingPage extends HTMLElement {
    disconnectedCalled = false;

    disconnectedCallback() {
        this.disconnectedCalled = true;
    }
}
customElements.define('test-disconnect-recording-page', DisconnectRecordingPage);

describe('testing helpers', () => {
    beforeEach(() => {
        onError(null as any);
    });

    describe('flush', () => {
        it('waits_long_enough_for_async_work_started_in_connectedCallback_to_finish', async () => {
            const { element, unmount } = mount<SlowLoadingPage>('test-slow-loading-page');

            expect(element.loaded).toBe(false);
            await flush();
            expect(element.loaded).toBe(true);

            unmount();
        });
    });

    describe('mount', () => {
        it('attaches_the_element_so_lifecycle_callbacks_run', () => {
            const { element, unmount } = mount<SlowLoadingPage>('test-slow-loading-page');

            expect(element.isConnected).toBe(true);

            unmount();
        });

        it('unmount_detaches_the_element_so_disconnectedCallback_runs', () => {
            const { element, unmount } = mount<DisconnectRecordingPage>(
                'test-disconnect-recording-page'
            );

            unmount();

            expect(element.disconnectedCalled).toBe(true);
            expect(element.isConnected).toBe(false);
        });

        it('accepts_an_already_created_element', () => {
            const created = document.createElement('test-slow-loading-page') as SlowLoadingPage;

            const { element, unmount } = mount(created);

            expect(element).toBe(created);
            unmount();
        });
    });

    describe('captureRelaxErrors', () => {
        it('turns_a_mistyped_template_expression_into_something_a_test_can_assert_on', () => {
            const captured = captureRelaxErrors();

            const { content, render } = compileTemplate('<p>{{user.naem}}</p>');
            render({ user: { name: 'Alice' } });

            expect(content.textContent).toBe('');
            expect(captured.messages()).toHaveLength(1);
            expect(captured.messages()[0]).toContain('user.naem');

            captured.restore();
        });

        it('collects_nothing_when_the_template_resolves', () => {
            const captured = captureRelaxErrors();

            const { render } = compileTemplate('<p>{{user.name}}</p>');
            render({ user: { name: 'Alice' } });

            expect(captured.errors).toHaveLength(0);

            captured.restore();
        });

        it('suppresses_errors_so_rendering_continues_to_the_assertion', () => {
            const captured = captureRelaxErrors();

            expect(() => reportError('boom', {})).not.toThrow();

            captured.restore();
        });

        it('restore_puts_the_previous_handler_back', () => {
            const seenByOuter: string[] = [];
            onError((error, ctx) => {
                seenByOuter.push(error.message);
                ctx.suppress();
            });

            const captured = captureRelaxErrors();
            reportError('during capture', {});
            captured.restore();

            reportError('after restore', {});

            expect(captured.messages()).toEqual(['during capture']);
            expect(seenByOuter).toEqual(['after restore']);
        });
    });
});
