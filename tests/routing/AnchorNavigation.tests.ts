import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    NavigateRouteEvent,
    Route,
    defineRoutes,
    internalRoutes,
    startRouting,
} from '../../src/routing';

const routes: Route[] = [
    { name: 'home', path: '/' },
    { name: 'product', path: '/products/;id' },
    { name: 'search', path: '/search' },
];

function click(anchor: HTMLAnchorElement, init: MouseEventInit = {}): MouseEvent {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init });
    anchor.dispatchEvent(event);
    return event;
}

describe('anchor navigation', () => {
    let captured: NavigateRouteEvent[];
    let anchor: HTMLAnchorElement;
    const listener = (e: Event) => captured.push(e as NavigateRouteEvent);

    beforeEach(() => {
        history.replaceState(null, '', '/');
        internalRoutes.length = 0;
        defineRoutes(routes);
        startRouting();
        captured = [];
        document.addEventListener('rlx.navigateRoute', listener);
        anchor = document.createElement('a');
        document.body.appendChild(anchor);
    });

    afterEach(() => {
        document.removeEventListener('rlx.navigateRoute', listener);
        anchor.remove();
    });

    it('a_same_origin_href_matching_a_route_navigates_client_side', () => {
        anchor.href = '/products/5';

        const event = click(anchor);

        expect(event.defaultPrevented).toBe(true);
        expect(captured.length).toBe(1);
        expect(captured[0].route.name).toBe('product');
        expect(captured[0].routeData).toEqual({ id: 5 });
        expect(location.pathname).toBe('/products/5');
    });

    it('query_string_and_fragment_reach_the_route', () => {
        anchor.href = '/search?q=chair#results';

        click(anchor);

        expect(captured[0].route.name).toBe('search');
        expect(captured[0].routeData).toEqual({ q: 'chair' });
        expect(captured[0].fragment).toBe('results');
    });

    it('a_click_inside_the_anchor_is_handled_like_a_click_on_it', () => {
        anchor.href = '/products/7';
        const span = document.createElement('span');
        anchor.appendChild(span);

        span.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));

        expect(captured[0].routeData).toEqual({ id: 7 });
    });

    it('an_href_without_a_matching_route_is_left_to_the_browser', () => {
        anchor.href = '/api/export.csv';

        const event = click(anchor);

        expect(event.defaultPrevented).toBe(false);
        expect(captured.length).toBe(0);
    });

    it('another_origin_is_left_to_the_browser', () => {
        anchor.href = 'https://example.com/products/5';

        const event = click(anchor);

        expect(event.defaultPrevented).toBe(false);
        expect(captured.length).toBe(0);
    });

    it('modifier_keys_open_the_link_the_way_the_browser_would', () => {
        anchor.href = '/products/5';

        expect(click(anchor, { ctrlKey: true }).defaultPrevented).toBe(false);
        expect(click(anchor, { metaKey: true }).defaultPrevented).toBe(false);
        expect(click(anchor, { shiftKey: true }).defaultPrevented).toBe(false);
        expect(click(anchor, { button: 1 }).defaultPrevented).toBe(false);
        expect(captured.length).toBe(0);
    });

    it('target_blank_download_and_rel_external_are_left_to_the_browser', () => {
        anchor.href = '/products/5';

        anchor.target = '_blank';
        expect(click(anchor).defaultPrevented).toBe(false);

        anchor.target = '';
        anchor.setAttribute('download', '');
        expect(click(anchor).defaultPrevented).toBe(false);

        anchor.removeAttribute('download');
        anchor.rel = 'nofollow external';
        expect(click(anchor).defaultPrevented).toBe(false);

        expect(captured.length).toBe(0);
    });

    it('a_click_something_else_already_handled_is_ignored', () => {
        anchor.href = '/products/5';
        anchor.addEventListener('click', (e) => e.preventDefault());

        click(anchor);

        expect(captured.length).toBe(0);
    });

    it('calling_startRouting_twice_registers_the_listener_once', () => {
        startRouting();
        captured = [];
        anchor.href = '/products/5';

        click(anchor);

        expect(captured.length).toBe(1);
    });
});
