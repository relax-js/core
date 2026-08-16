import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    navigate,
    startRouting,
    NavigateRouteEvent,
    Route,
    internalRoutes,
} from '../../src/routing';

describe('Route fragments', () => {
    let capturedEvent: NavigateRouteEvent | null;
    let listener: (e: any) => void;

    const routes: Route[] = [
        { name: 'reclaim', path: '/reclaim' },
        { name: 'restricted', path: '/restricted', layout: 'noauth' },
    ];

    beforeEach(() => {
        internalRoutes.length = 0;
        internalRoutes.push(...routes);
        sessionStorage.clear();

        capturedEvent = null;
        listener = (e: any) => (capturedEvent = <NavigateRouteEvent>e);
        document.addEventListener('rlx.navigateRoute', listener);
    });

    afterEach(() => {
        document.removeEventListener('rlx.navigateRoute', listener);
    });

    it('fragment_is_handed_to_the_component_so_reset_tokens_stay_out_of_server_logs', () => {
        history.replaceState({}, '', '/reclaim#L081114IsqK4lYc3e90qzAXZ6QwBf');

        startRouting();

        expect(capturedEvent!.fragment).toBe('L081114IsqK4lYc3e90qzAXZ6QwBf');
    });

    it('missing_fragment_is_undefined_rather_than_an_empty_string', () => {
        history.replaceState({}, '', '/reclaim');

        startRouting();

        expect(capturedEvent!.fragment).toBeUndefined();
    });

    it('internal_layout_marker_is_never_exposed_as_an_application_fragment', () => {
        history.replaceState({}, '', '/reclaim#rlx-layout');

        startRouting();

        expect(capturedEvent!.fragment).toBeUndefined();
    });

    it('fragment_is_removed_from_the_address_bar_once_routing_settles', () => {
        history.replaceState({}, '', '/reclaim#L081114IsqK4lYc3e90qzAXZ6QwBf');

        startRouting();

        expect(window.location.hash).toBe('');
    });

    it('application_fragment_does_not_trip_the_failed_layout_redirect_guard', () => {
        history.replaceState({}, '', '/restricted#L081114IsqK4lYc3e90qzAXZ6QwBf');

        expect(() => startRouting()).not.toThrow();
    });

    it('fragment_travels_in_session_storage_so_it_survives_a_layout_switch', () => {
        history.replaceState({}, '', '/restricted#L081114IsqK4lYc3e90qzAXZ6QwBf');

        startRouting();

        const stored = JSON.parse(sessionStorage.getItem('layoutNavigation')!);
        expect(stored.fragment).toBe('L081114IsqK4lYc3e90qzAXZ6QwBf');
    });

    it('fragment_reaches_the_component_after_the_layout_page_has_loaded', () => {
        sessionStorage.setItem(
            'layoutNavigation',
            JSON.stringify({
                routeName: 'reclaim',
                params: {},
                fragment: 'L081114IsqK4lYc3e90qzAXZ6QwBf',
            })
        );
        history.replaceState({}, '', '/noauth.html#rlx-layout');

        startRouting();

        expect(capturedEvent!.fragment).toBe('L081114IsqK4lYc3e90qzAXZ6QwBf');
    });

    it('repeated_layout_redirect_still_reports_a_missing_layout_file', () => {
        history.replaceState({}, '', '/restricted#rlx-layout');

        expect(() => startRouting()).toThrow(/does the requsted layout exist/);
    });

    it('navigate_carries_an_explicit_fragment_to_the_component', () => {
        history.replaceState({}, '', '/');

        navigate('reclaim', { fragment: 'L081114IsqK4lYc3e90qzAXZ6QwBf' });

        expect(capturedEvent!.fragment).toBe('L081114IsqK4lYc3e90qzAXZ6QwBf');
    });
});
