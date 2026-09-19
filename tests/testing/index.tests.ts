import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { flush, mount, captureRelaxErrors, mountRouting, fakeServer } from '../../src/testing';
import type { RoutingHarness, FakeServer } from '../../src/testing';
import { onError, reportError } from '../../src/errors';
import { compileTemplate } from '../../src/html/template';
import { configure, get, post, del } from '../../src/http/http';
import { GuardResult, RouteGuardError, type LoadRoute, type Routable } from '../../src/routing';

class SlowRoutedPage extends HTMLElement implements LoadRoute<{ id: string }> {
    routeData?: { id: string };
    loadedId?: string;

    async loadRoute(data: { id: string }) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        this.loadedId = data.id;
    }
}
customElements.define('test-slow-routed-page', SlowRoutedPage);

class PlainRoutedPage extends HTMLElement implements Routable<{ id: string }> {
    routeData?: { id: string };
}
customElements.define('test-plain-routed-page', PlainRoutedPage);

class ExplodingRoutedPage extends HTMLElement implements LoadRoute {
    async loadRoute() {
        throw new Error('database is on fire');
    }
}
customElements.define('test-exploding-routed-page', ExplodingRoutedPage);

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

    describe('mountRouting', () => {
        let routing: RoutingHarness | undefined;

        afterEach(() => {
            routing?.unmount();
            routing = undefined;
        });

        it('navigate_resolves_with_the_component_after_its_loadRoute_finished', async () => {
            routing = mountRouting([
                { name: 'slow', path: '/slow/:id', componentTagName: 'test-slow-routed-page' },
            ]);

            const page = await routing.navigate<SlowRoutedPage>('slow', { params: { id: '42' } });

            expect(page.loadedId).toBe('42');
            expect(page.routeData).toEqual({ id: '42' });
            expect(page.isConnected).toBe(true);
        });

        it('navigate_accepts_a_url_like_the_application_does', async () => {
            routing = mountRouting([
                { name: 'plain', path: '/plain/:id', componentTagName: 'test-plain-routed-page' },
            ]);

            const page = await routing.navigate<PlainRoutedPage>('/plain/7');

            expect(page.routeData).toEqual({ id: '7' });
        });

        it('navigating_twice_to_the_same_component_resolves_with_the_new_instance', async () => {
            routing = mountRouting([
                { name: 'plain', path: '/plain/:id', componentTagName: 'test-plain-routed-page' },
            ]);

            const first = await routing.navigate<PlainRoutedPage>('/plain/1');
            const second = await routing.navigate<PlainRoutedPage>('/plain/2');

            expect(second).not.toBe(first);
            expect(second.routeData).toEqual({ id: '2' });
            expect(routing.target.children).toHaveLength(1);
        });

        it('routes_render_into_the_named_target_they_ask_for', async () => {
            routing = mountRouting(
                [{ name: 'side', path: '/side', target: 'sidebar', componentTagName: 'test-plain-routed-page' }],
                { targets: ['sidebar'] }
            );

            const page = await routing.navigate('side');

            expect(page.parentElement?.getAttribute('name')).toBe('sidebar');
            expect(routing.target.children).toHaveLength(0);
        });

        it('a_guard_that_stops_navigation_rejects_instead_of_timing_out', async () => {
            routing = mountRouting([
                {
                    name: 'locked',
                    path: '/locked',
                    componentTagName: 'test-plain-routed-page',
                    guards: [{ check: () => GuardResult.Stop }],
                },
            ]);

            await expect(routing.navigate('locked')).rejects.toBeInstanceOf(RouteGuardError);
        });

        it('a_component_that_never_renders_fails_with_the_errors_reported_meanwhile', async () => {
            const captured = captureRelaxErrors();
            routing = mountRouting(
                [{ name: 'boom', path: '/boom/:id', componentTagName: 'test-exploding-routed-page' }],
                { timeout: 50 }
            );

            try {
                await expect(routing.navigate('boom', { params: { id: '1' } })).rejects.toThrow(
                    /did not render <test-exploding-routed-page>[\s\S]*Route navigation failed/
                );
            } finally {
                captured.restore();
            }
        });

        it('unmount_leaves_nothing_behind_for_the_next_test', async () => {
            routing = mountRouting([
                { name: 'plain', path: '/plain/:id', componentTagName: 'test-plain-routed-page' },
            ]);
            await routing.navigate('/plain/1');
            routing.unmount();
            routing = undefined;

            expect(document.querySelectorAll('r-route-target')).toHaveLength(0);

            const captured = captureRelaxErrors();
            try {
                routing = mountRouting([
                    { name: 'plain', path: '/plain/:id', componentTagName: 'test-plain-routed-page' },
                ]);
                expect(captured.messages()).toEqual([]);
            } finally {
                captured.restore();
            }
        });
    });

    describe('fakeServer', () => {
        let server: FakeServer;

        beforeEach(() => {
            configure({ baseUrl: '/api', bearerTokenName: null });
            server = fakeServer();
        });

        afterEach(() => {
            server.restore();
            configure({ baseUrl: undefined, bearerTokenName: undefined });
        });

        it('answers_a_registered_path_with_the_body_as_json', async () => {
            server.on('GET', '/api/users/42', { id: 42, name: 'Alice' });

            const response = await get('/users/42');

            expect(response.success).toBe(true);
            expect(response.as<{ name: string }>().name).toBe('Alice');
        });

        it('matches_on_the_path_without_the_query_string_and_records_the_query', async () => {
            server.on('GET', '/api/users', []);

            await get('/users', { status: 'active' });

            expect(server.requests[0].path).toBe('/api/users');
            expect(server.requests[0].query.get('status')).toBe('active');
        });

        it('records_what_was_posted_so_the_test_can_assert_on_it', async () => {
            server.on('POST', '/api/users', (request) => ({ id: 1, ...request.json<object>() }), 201);

            const response = await post('/users', JSON.stringify({ name: 'Bob' }));

            expect(response.statusCode).toBe(201);
            expect(response.as<{ id: number; name: string }>()).toEqual({ id: 1, name: 'Bob' });
            expect(server.requests[0].method).toBe('POST');
            expect(server.requests[0].json()).toEqual({ name: 'Bob' });
        });

        it('an_error_status_reaches_the_caller_as_a_failed_response_with_the_text', async () => {
            server.on('GET', '/api/users/9', 'no such user', 404);

            const response = await get('/users/9');

            expect(response.success).toBe(false);
            expect(response.statusCode).toBe(404);
            expect(response.body).toBe('no such user');
        });

        it('an_unregistered_request_is_recorded_and_answered_with_what_is_registered', async () => {
            server.on('GET', '/api/users', []);

            const response = await get('/orders');

            expect(response.statusCode).toBe(404);
            expect(response.body).toContain('GET /api/orders');
            expect(response.body).toContain('GET /api/users');
            expect(server.requests.map((r) => r.path)).toEqual(['/api/orders']);
        });

        it('a_204_has_no_body_to_parse', async () => {
            server.on('DELETE', '/api/users/1', undefined, 204);

            const response = await del('/users/1');

            expect(response.success).toBe(true);
            expect(response.body).toBeNull();
        });
    });
});
