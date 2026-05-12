import { describe, it, expect, beforeEach } from 'vitest';
import {
    NavigateRouteEvent,
    Route,
    RouteTarget,
    RouteLink,
    canGoBack,
    canGoForward,
    clearPendingNavigations,
    defineRoutes,
    internalRoutes,
    navigate,
    navigateBack,
    navigateForward,
} from '../../src/routing';

if (!customElements.get('r-route-target')) {
    customElements.define('r-route-target', RouteTarget);
}
if (!customElements.get('r-link')) {
    customElements.define('r-link', RouteLink);
}

class SimpleHistoryPage extends HTMLElement {}
if (!customElements.get('history-simple-page')) {
    customElements.define('history-simple-page', SimpleHistoryPage);
}

async function flush() {
    await new Promise((r) => setTimeout(r, 0));
}

const routes: Route[] = [
    { name: 'home', path: '/', componentTagName: 'history-simple-page' },
    { name: 'about', path: '/about', componentTagName: 'history-simple-page' },
    { name: 'user', path: '/users/:id', componentTagName: 'history-simple-page' },
    { name: 'detail', path: '/detail/:id', target: 'modal', componentTagName: 'history-simple-page' },
];

function captureEvents(): NavigateRouteEvent[] {
    const captured: NavigateRouteEvent[] = [];
    document.addEventListener('rlx.navigateRoute', (e) => captured.push(e));
    return captured;
}

describe('NavigationHistory integration', () => {
    let mainTarget: HTMLElement;
    let modalTarget: HTMLElement;

    beforeEach(() => {
        clearPendingNavigations();
        internalRoutes.length = 0;
        defineRoutes(routes);
        document.body.replaceChildren();

        mainTarget = document.createElement('r-route-target');
        modalTarget = document.createElement('r-route-target');
        modalTarget.setAttribute('name', 'modal');
        document.body.appendChild(mainTarget);
        document.body.appendChild(modalTarget);
    });

    it('navigate_then_navigateBack_dispatches_previous_route_as_replay', async () => {
        navigate('home');
        navigate('about');
        await flush();

        const captured = captureEvents();
        navigateBack();
        await flush();

        expect(captured.length).toBe(1);
        expect(captured[0].route.name).toBe('home');
        expect(captured[0].isReplay).toBe(true);
    });

    it('canGoBack_returns_false_when_only_one_entry_in_target', () => {
        navigate('home');
        expect(canGoBack()).toBe(false);
        expect(canGoForward()).toBe(false);

        navigate('about');
        expect(canGoBack()).toBe(true);
        expect(canGoForward()).toBe(false);
    });

    it('back_then_navigate_truncates_forward_history', async () => {
        navigate('home');
        navigate('about');
        navigate('user', { params: { id: '1' } });
        await flush();

        navigateBack();
        navigateBack();
        await flush();
        expect(canGoForward()).toBe(true);

        navigate('user', { params: { id: '99' } });
        expect(canGoForward()).toBe(false);
    });

    it('navigateForward_after_navigateBack_replays_the_next_entry', async () => {
        navigate('home');
        navigate('about');
        await flush();

        navigateBack();
        await flush();

        const captured = captureEvents();
        navigateForward();
        await flush();

        expect(captured.length).toBe(1);
        expect(captured[0].route.name).toBe('about');
        expect(captured[0].isReplay).toBe(true);
    });

    it('per_target_history_is_independent_between_two_targets', async () => {
        navigate('home');
        navigate('about');
        navigate('detail', { params: { id: '7' } });
        await flush();

        expect(canGoBack()).toBe(true);
        expect(canGoBack('modal')).toBe(false);

        navigate('detail', { params: { id: '8' } });
        await flush();

        expect(canGoBack('modal')).toBe(true);

        const captured = captureEvents();
        navigateBack('modal');
        await flush();

        expect(captured.length).toBe(1);
        expect(captured[0].routeTarget).toBe('modal');
        expect(captured[0].routeData).toEqual({ id: '7' });
    });

    it('popstate_replays_for_correct_target_using_state_entryId', async () => {
        navigate('home');
        navigate('about');
        await flush();

        const captured = captureEvents();
        const homeState = {
            target: undefined,
            routeName: 'home',
            params: {},
            urlSegments: [''],
            entryId: 1,
        };
        window.dispatchEvent(new PopStateEvent('popstate', { state: homeState }));
        await flush();

        expect(captured.length).toBe(1);
        expect(captured[0].route.name).toBe('home');
        expect(captured[0].isReplay).toBe(true);
    });

    it('r_link_direction_back_invokes_navigateBack_for_named_target', async () => {
        navigate('detail', { params: { id: '1' } });
        navigate('detail', { params: { id: '2' } });
        await flush();

        const link = document.createElement('r-link') as RouteLink;
        link.setAttribute('direction', 'back');
        link.setAttribute('target', 'modal');
        document.body.appendChild(link);

        const captured = captureEvents();
        link.click();
        await flush();

        expect(captured.length).toBe(1);
        expect(captured[0].routeTarget).toBe('modal');
        expect(captured[0].routeData).toEqual({ id: '1' });
        expect(captured[0].isReplay).toBe(true);
    });

    it('r_link_direction_back_sets_aria_disabled_when_no_history', () => {
        const link = document.createElement('r-link') as RouteLink;
        link.setAttribute('direction', 'back');
        document.body.appendChild(link);

        expect(link.getAttribute('aria-disabled')).toBe('true');
    });
});
