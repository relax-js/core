import { describe, it, expect, beforeEach } from 'vitest';
import {
    clearPendingNavigations,
    defineRoutes,
    findRouteByUrl,
    internalRoutes,
    type Route,
} from '../../src/routing';

describe('Route path syntax', () => {
    beforeEach(() => {
        clearPendingNavigations();
        internalRoutes.length = 0;
    });

    it('brace_parameters_are_rejected_at_startup_rather_than_leaving_the_route_unreachable', () => {
        const routes: Route[] = [{ name: 'user', path: '/users/{id}' }];

        expect(() => defineRoutes(routes)).toThrow(/\{id\}/);
    });

    it('rejection_names_the_syntax_relaxjs_expects_instead_of_only_reporting_a_problem', () => {
        const routes: Route[] = [{ name: 'user', path: '/users/{id}' }];

        expect(() => defineRoutes(routes)).toThrow(/':name'.*';name'/);
    });

    it('supported_parameter_syntax_still_matches_a_url', () => {
        const routes: Route[] = [
            { name: 'user', path: '/users/:name' },
            { name: 'order', path: '/orders/;orderId' },
        ];
        defineRoutes(routes);

        expect(findRouteByUrl(routes, '/users/john')?.params).toEqual({ name: 'john' });
        expect(findRouteByUrl(routes, '/orders/42')?.params).toEqual({ orderId: 42 });
    });
});
