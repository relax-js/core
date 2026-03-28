import { describe, it, expect, beforeEach } from 'vitest';
import {
    findRouteByName,
    findRouteByUrl,
    matchRoute,
    navigate,
    startRouting,
    NavigateRouteEvent,
    Route,
    internalRoutes,
} from '../../src/routing';

describe('Router', () => {
    let routes: Route[];

    beforeEach(() => {
        internalRoutes.length = 0;

        routes = [
            { name: 'home', path: '/' },
            { name: 'users', path: '/users' },
            { name: 'user', path: '/users/:id' },
            { name: 'order', path: '/orders/;id' },
            { name: 'files', path: '/files/{*path}' },
            { name: 'nested', path: '/parent/:parentId/child/;childId' }
        ];
    });

    describe('matchRoute', () => {
        it('should match root path "/" to home route', () => {
            const result = matchRoute(routes, '/');
            expect(result?.route.name).toBe('home');
        });

        it('should match empty string to home route', () => {
            const result = matchRoute(routes, '');
            expect(result?.route.name).toBe('home');
        });
    });

    describe('findRouteByUrl', () => {
        it('should match exact static routes', () => {
            const result = findRouteByUrl(routes, '/users');
            expect(result?.route.name).toBe('users');
        });

        it('should handle trailing slashes', () => {
            const result = findRouteByUrl(routes, '/users/');
            expect(result?.route.name).toBe('users');
        });

        it('should match string parameters', () => {
            const result = findRouteByUrl(routes, '/users/john');
            expect(result?.route.name).toBe('user');
            expect(result?.params).toEqual({ id: 'john' });
        });

        it('should match number parameters', () => {
            const result = findRouteByUrl(routes, '/orders/123');
            expect(result?.route.name).toBe('order');
            expect(result?.params).toEqual({ id: 123 });
        });

        it('should handle empty segments correctly', () => {
            const result = findRouteByUrl(routes, '/users//john');
            expect(result).toBeNull();
        });
    });

    describe('findRouteByName', () => {
        it('should match route with correct parameters', () => {
            const result = findRouteByName(routes, 'user', { id: 'john' });
            expect(result?.params).toEqual({ id: 'john' });
        });

        it('should parse parameters correctly', () => {
            const result = findRouteByName(routes, 'order', { id: 123 });
            expect(result?.urlSegments).toEqual(['orders', '123']);
        });

        it('should handle nested routes', () => {
            const result = findRouteByName(routes, 'nested', {
                parentId: 'parent1',
                childId: 42
            });
            expect(result?.params).toEqual({
                parentId: 'parent1',
                childId: 42
            });
        });
    });

    describe('navigate', () => {
        it.skip('should update history state', () => {
            const historyLength = window.history.length;
            navigate('/users/john', { routes });
            expect(window.history.length).toBe(historyLength + 1);
            expect(window.location.pathname).toBe('/users/john');
        });

        it('should dispatch navigation event', () => {
            let capturedEvent: NavigateRouteEvent | null = null;
            document.addEventListener('rlx.navigateRoute', (e: any) => {
                capturedEvent = <NavigateRouteEvent>e;
            });

            navigate('user', { params: { id: 'john' }, routes });

            expect(capturedEvent).not.toBeNull();
            expect(capturedEvent!.routeData).toEqual(
                expect.objectContaining({
                    id: 'john'
                })
            );
        });

        it('should throw when required parameter is missing', () => {
            expect(() =>
                navigate('order', { params: {}, routes })
            ).toThrow();
        });

        it('should handle custom targets', () => {
            let capturedEvent: NavigateRouteEvent | null = null;
            document.addEventListener('rlx.navigateRoute', (e: any) => {
                capturedEvent = e;
            });

            navigate('user', {
                params: { id: 'john' },
                target: 'modal',
                routes
            });

            expect(capturedEvent!.routeTarget).toBe('modal');
        });

        it.skip('should handle consecutive navigations', () => {
            navigate('/users/john', { routes });
            navigate('/orders/123', { routes });

            expect(window.location.pathname).toBe('/orders/123');
        });

        it.skip('should maintain correct history state', () => {
            navigate('/users/john', { routes });
            navigate('/orders/123', { routes });
            window.history.back();

            expect(window.location.pathname).toBe('/users/john');
        });
    });

    describe('startRouting', () => {
        beforeEach(() => {
            sessionStorage.clear();
            internalRoutes.length = 0;
            internalRoutes.push(
                { name: 'login', path: '/login', layout: 'public' },
                { name: 'oauth-callback', path: '/oauth/callback', layout: 'public' },
                { name: 'dashboard', path: '/' },
            );
        });

        it('should_redirect_to_correct_layout_when_url_needs_different_layout', () => {
            // Simulate landing on /oauth/callback (which needs 'public' layout)
            // currentLayout is 'default' (jsdom default), so layout switch is needed
            history.pushState(null, '', '/oauth/callback');

            startRouting();

            const stored = sessionStorage.getItem('layoutNavigation');
            expect(stored).not.toBeNull();
            const parsed = JSON.parse(stored!);
            expect(parsed.routeName).toBe('oauth-callback');
        });

        it('should_preserve_query_parameters_as_route_params_during_layout_switch', () => {
            history.pushState(null, '', '/oauth/callback?code=abc123&state=xyz');

            startRouting();

            const stored = sessionStorage.getItem('layoutNavigation');
            expect(stored).not.toBeNull();
            const parsed = JSON.parse(stored!);
            expect(parsed.routeName).toBe('oauth-callback');
            expect(parsed.params.code).toBe('abc123');
            expect(parsed.params.state).toBe('xyz');
        });

        it('should_include_query_parameters_in_route_event_data', () => {
            // Use a route on the default layout so no layout switch happens
            internalRoutes.length = 0;
            internalRoutes.push(
                { name: 'search', path: '/search' },
            );
            history.pushState(null, '', '/search?q=hello&page=2');

            let capturedEvent: NavigateRouteEvent | null = null;
            const handler = (e: NavigateRouteEvent) => { capturedEvent = e; };
            document.addEventListener('rlx.navigateRoute', handler);

            startRouting();

            document.removeEventListener('rlx.navigateRoute', handler);
            expect(capturedEvent).not.toBeNull();
            expect(capturedEvent!.routeData!.q).toBe('hello');
            expect(capturedEvent!.routeData!.page).toBe('2');
        });
    });

    describe('edge cases', () => {
        it('should handle root path', () => {
            const result = findRouteByUrl(routes, '/');
            expect(result?.route.name).toBe('home');
        });

        it('should handle missing parameters', () => {
            expect(() => findRouteByName(routes, 'user', {})).toThrow();
        });

        it('should handle non-existent routes', () => {
            expect(() => navigate('non-existent', { routes })).toThrow();
        });

        it('should throw when not all required parameters are provided', () => {
            expect(() =>
                navigate('nested', {
                    params: { parentId: 'valid' },
                    routes
                })
            ).toThrow();
        });
    });
});
