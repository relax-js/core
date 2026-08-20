import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    navigate,
    internalRoutes,
    clearPendingNavigations,
    registerRouteTarget,
    type Route,
} from '../src/routing';

describe('Debug traces', () => {
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    const routes: Route[] = [
        { name: 'home', path: '/' },
        { name: 'modal', path: '/detail', target: 'modal' },
    ];

    beforeEach(() => {
        internalRoutes.length = 0;
        internalRoutes.push(...routes);
        clearPendingNavigations();
        history.replaceState({}, '', '/');
        consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleSpy.mockRestore();
        delete window.relaxDebug;
    });

    it('library_stays_silent_when_no_debug_area_is_turned_on', () => {
        registerRouteTarget(undefined, () => {});

        navigate('home');

        expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('turning_on_one_area_does_not_produce_output_from_another', () => {
        window.relaxDebug = { templates: true };
        registerRouteTarget(undefined, () => {});

        navigate('home');

        expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('navigation_to_a_target_that_never_connected_names_the_targets_that_exist', () => {
        window.relaxDebug = { routing: true };
        registerRouteTarget('sidebar', () => {});

        navigate('modal');

        const parked = consoleSpy.mock.calls.find((args) =>
            String(args[0]).includes('no target registered')
        );
        expect(parked).toBeDefined();
        expect(parked![1]).toBe('modal');
        expect(parked![3]).toMatchObject({ registeredTargets: ['sidebar'] });
    });
});
