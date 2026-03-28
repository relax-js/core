import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NavigateRouteEvent, Route, RouteData, clearPendingNavigations } from '../../src/routing';
import type { LoadRoute, Routable } from '../../src/routing';
import { onError, RelaxError } from '../../src/errors';
import { RouteTarget } from '../../src/routing/RoutingTarget';

if (!customElements.get('r-route-target')) {
    customElements.define('r-route-target', RouteTarget);
}

class SimplePage extends HTMLElement {}
customElements.define('test-simple-page', SimplePage);

class LoadRoutePage extends HTMLElement implements LoadRoute<{ userId: string }> {
    loaded = false;
    receivedData: RouteData | null = null;

    async loadRoute(data: { userId: string }) {
        this.receivedData = data;
        this.loaded = true;
    }
}
customElements.define('test-loadroute-page', LoadRoutePage);

class AsyncLoadRoutePage extends HTMLElement implements LoadRoute<{ id: string }> {
    receivedData: RouteData | null = null;

    async loadRoute(data: { id: string }) {
        await new Promise((r) => setTimeout(r, 10));
        this.receivedData = data;
    }
}
customElements.define('test-async-loadroute-page', AsyncLoadRoutePage);

class RoutablePage extends HTMLElement implements Routable<{ userName: string }> {
    routeData?: { userName: string };
}
customElements.define('test-routable-page', RoutablePage);

class BothPage extends HTMLElement implements LoadRoute<{ id: string }>, Routable<{ id: string }> {
    loadRouteCalled = false;
    routeData?: { id: string };

    async loadRoute(_data: { id: string }) {
        this.loadRouteCalled = true;
    }
}
customElements.define('test-both-page', BothPage);

class NoParamsLoadRoutePage extends HTMLElement implements LoadRoute {
    receivedData: RouteData | null = null;

    async loadRoute(data: RouteData) {
        this.receivedData = data;
    }
}
customElements.define('test-noparams-loadroute-page', NoParamsLoadRoutePage);

class FailingLoadRoutePage extends HTMLElement implements LoadRoute {
    async loadRoute(_data: RouteData) {
        throw new Error('loadRoute exploded');
    }
}
customElements.define('test-failing-loadroute-page', FailingLoadRoutePage);

function dispatchRoute(route: Route, routeData?: RouteData, target?: string) {
    const evt = new NavigateRouteEvent(
        route,
        [],
        routeData,
        target,
    );
    document.dispatchEvent(evt);
}

async function flush() {
    await new Promise((r) => setTimeout(r, 0));
}

describe('RouteTarget', () => {
    let routeTarget: HTMLElement;

    beforeEach(() => {
        onError(null as any);
        clearPendingNavigations();
        routeTarget = document.createElement('r-route-target');
        document.body.replaceChildren(routeTarget);
    });

    describe('component creation', () => {
        it('should create the routed component', async () => {
            dispatchRoute({ name: 'simple', path: '/simple', componentTagName: 'test-simple-page' });
            await flush();

            expect(routeTarget.children.length).toBe(1);
            expect(routeTarget.children[0].tagName.toLowerCase()).toBe('test-simple-page');
        });

        it('should replace previous component on new navigation', async () => {
            dispatchRoute({ name: 'a', path: '/a', componentTagName: 'test-simple-page' });
            await flush();

            dispatchRoute({ name: 'b', path: '/b', componentTagName: 'test-routable-page' });
            await flush();

            expect(routeTarget.children.length).toBe(1);
            expect(routeTarget.children[0].tagName.toLowerCase()).toBe('test-routable-page');
        });

        it('should ignore events for other targets', async () => {
            dispatchRoute(
                { name: 'modal', path: '/modal', componentTagName: 'test-simple-page' },
                undefined,
                'sidebar',
            );
            await flush();

            expect(routeTarget.children.length).toBe(0);
        });
    });

    describe('loadRoute', () => {
        it('should call loadRoute with route data before adding to DOM', async () => {
            dispatchRoute(
                { name: 'user', path: '/user/:userId', componentTagName: 'test-loadroute-page' },
                { userId: 'john' },
            );
            await flush();

            const page = routeTarget.children[0] as LoadRoutePage;
            expect(page.loaded).toBe(true);
            expect(page.receivedData).toEqual({ userId: 'john' });
        });

        it('should await async loadRoute before inserting element', async () => {
            dispatchRoute(
                { name: 'async', path: '/async/:id', componentTagName: 'test-async-loadroute-page' },
                { id: 'abc' },
            );

            expect(routeTarget.children.length).toBe(0);

            await new Promise((r) => setTimeout(r, 50));

            expect(routeTarget.children.length).toBe(1);
            const page = routeTarget.children[0] as AsyncLoadRoutePage;
            expect(page.receivedData).toEqual({ id: 'abc' });
        });

        it('should call loadRoute with error data when route has no params', async () => {
            dispatchRoute(
                { name: 'noparams', path: '/noparams', componentTagName: 'test-noparams-loadroute-page' },
            );
            await flush();

            const page = routeTarget.children[0] as NoParamsLoadRoutePage;
            expect(page.receivedData).toEqual({
                error: 'loadRoute function without mapped route data in the routes',
            });
        });
    });

    describe('routeData', () => {
        it('should assign routeData property', async () => {
            dispatchRoute(
                { name: 'profile', path: '/profile/:userName', componentTagName: 'test-routable-page' },
                { userName: 'alice' },
            );
            await flush();

            const page = routeTarget.children[0] as RoutablePage;
            expect(page.routeData).toEqual({ userName: 'alice' });
        });

        it('should assign routeData even on components without Routable', async () => {
            dispatchRoute(
                { name: 'simple', path: '/simple', componentTagName: 'test-simple-page' },
                { key: 'value' },
            );
            await flush();

            const page = routeTarget.children[0] as any;
            expect(page.routeData).toEqual({ key: 'value' });
        });

        it('should not assign routeData when route has no params', async () => {
            dispatchRoute(
                { name: 'simple', path: '/simple', componentTagName: 'test-simple-page' },
            );
            await flush();

            const page = routeTarget.children[0] as any;
            expect(page.routeData).toBeUndefined();
        });
    });

    describe('loadRoute + routeData combined', () => {
        it('should call loadRoute first, then assign routeData', async () => {
            dispatchRoute(
                { name: 'both', path: '/both/:id', componentTagName: 'test-both-page' },
                { id: 'xyz' },
            );
            await flush();

            const page = routeTarget.children[0] as BothPage;
            expect(page.loadRouteCalled).toBe(true);
            expect(page.routeData).toEqual({ id: 'xyz' });
        });
    });

    describe('error handling', () => {
        it('should report loadRoute errors through onError', async () => {
            const errors: RelaxError[] = [];
            onError((error) => {
                errors.push(error);
            });

            dispatchRoute(
                { name: 'fail', path: '/fail', componentTagName: 'test-failing-loadroute-page' },
                { id: '1' },
            );
            await flush();

            expect(errors.length).toBe(1);
            expect(errors[0].message).toBe('Route navigation failed');
            expect(errors[0].context.route).toBe('fail');
        });

        it('should log error to console when not suppressed', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            dispatchRoute(
                { name: 'fail', path: '/fail', componentTagName: 'test-failing-loadroute-page' },
                { id: '1' },
            );
            await flush();

            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });

        it('should not log when error is suppressed', async () => {
            onError((_error, ctx) => {
                ctx.suppress();
            });
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            dispatchRoute(
                { name: 'fail', path: '/fail', componentTagName: 'test-failing-loadroute-page' },
                { id: '1' },
            );
            await flush();

            expect(consoleSpy).not.toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });

    describe('pending events', () => {
        it('should replay pending event when target connects late', async () => {
            clearPendingNavigations();
            document.body.replaceChildren();

            dispatchRoute({ name: 'simple', path: '/simple', componentTagName: 'test-simple-page' });

            const lateTarget = document.createElement('r-route-target');
            document.body.replaceChildren(lateTarget);
            await flush();

            expect(lateTarget.children.length).toBe(1);
            expect(lateTarget.children[0].tagName.toLowerCase()).toBe('test-simple-page');
        });
    });

    describe('duplicate targets', () => {
        it('should report error for duplicate target name', () => {
            const errors: RelaxError[] = [];
            onError((error, ctx) => {
                errors.push(error);
                ctx.suppress();
            });

            const duplicate = document.createElement('r-route-target');
            document.body.appendChild(duplicate);

            expect(errors.length).toBe(1);
            expect(errors[0].message).toBe('Duplicate route target');
            expect(errors[0].context.target).toBe('default');

            duplicate.remove();
        });
    });
});
