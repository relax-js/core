import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { captureRelaxErrors, flush, mountRouting } from '../../src/testing';
import type { RoutingHarness } from '../../src/testing';
import {
    clearPendingNavigations,
    defineRoutes,
    internalRoutes,
    NavigateRouteEvent,
    type Route,
} from '../../src/routing';
import { onError } from '../../src/errors';
import type { LazyPage } from './fixtures/LazyPage';

describe('Route load', () => {
    let routing: RoutingHarness | undefined;

    beforeEach(() => {
        onError(null as any);
        clearPendingNavigations();
        internalRoutes.length = 0;
        history.replaceState(null, '', '/');
    });

    afterEach(() => {
        routing?.unmount();
        routing = undefined;
    });

    it('defineRoutes_accepts_a_tag_that_is_not_defined_yet_when_the_route_can_load_it', () => {
        const routes: Route[] = [
            {
                name: 'later',
                path: '/later',
                componentTagName: 'test-not-loaded-yet-page',
                load: () => Promise.resolve(),
            },
        ];

        expect(() => defineRoutes(routes)).not.toThrow();
    });

    it('defineRoutes_rejects_load_without_a_tag_name_because_it_cannot_tell_what_to_render', () => {
        const routes: Route[] = [{ name: 'later', path: '/later', load: () => Promise.resolve() }];

        expect(() => defineRoutes(routes)).toThrow(/later.*componentTagName/);
    });

    it('first_navigation_imports_the_component_and_later_ones_reuse_it', async () => {
        let loads = 0;
        routing = mountRouting([
            {
                name: 'lazy',
                path: '/lazy',
                componentTagName: 'test-lazy-page',
                load: () => {
                    loads++;
                    return import('./fixtures/LazyPage');
                },
            },
            { name: 'home', path: '/' },
        ]);

        const first = await routing.navigate<LazyPage>('lazy');
        const second = await routing.navigate<LazyPage>('lazy');

        expect(first.tagName.toLowerCase()).toBe('test-lazy-page');
        expect(second).not.toBe(first);
        expect(loads).toBe(1);
    });

    it('load_that_does_not_define_the_tag_names_the_route_and_the_missing_tag', async () => {
        const target = document.createElement('r-route-target');
        defineRoutes([]);
        document.body.replaceChildren(target);
        const captured = captureRelaxErrors();
        try {
            document.dispatchEvent(
                new NavigateRouteEvent(
                    {
                        name: 'typo',
                        path: '/typo',
                        componentTagName: 'test-misspelled-page',
                        load: () => Promise.resolve(),
                    },
                    []
                )
            );
            await flush();
        } finally {
            captured.restore();
            target.remove();
        }

        expect(captured.messages()).toHaveLength(1);
        expect(captured.messages()[0]).toContain("'typo'");
        expect(captured.messages()[0]).toContain('<test-misspelled-page>');
    });

    it('load_that_fails_reports_the_route_with_the_cause', async () => {
        const target = document.createElement('r-route-target');
        defineRoutes([]);
        document.body.replaceChildren(target);
        const cause = new Error('Failed to fetch dynamically imported module');
        const captured = captureRelaxErrors();
        try {
            document.dispatchEvent(
                new NavigateRouteEvent(
                    {
                        name: 'offline',
                        path: '/offline',
                        componentTagName: 'test-unreachable-page',
                        load: () => Promise.reject(cause),
                    },
                    []
                )
            );
            await flush();
        } finally {
            captured.restore();
            target.remove();
        }

        expect(captured.errors).toHaveLength(1);
        expect(captured.errors[0].message).toContain("'offline'");
        expect(captured.errors[0].context.cause).toBe(cause);
    });
});
