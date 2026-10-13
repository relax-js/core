import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mountRouting } from '../../src/testing';
import type { RoutingHarness } from '../../src/testing';
import { internalRoutes, navigate, startRouting } from '../../src/routing';

class QueryReadingPage extends HTMLElement {
    searchSeenOnConnect = '';

    connectedCallback() {
        this.searchSeenOnConnect = window.location.search;
    }
}
customElements.define('test-query-reading-page', QueryReadingPage);

describe('Route query string', () => {
    let routing: RoutingHarness | undefined;

    beforeEach(() => {
        sessionStorage.clear();
        history.replaceState(null, '', '/');
    });

    afterEach(() => {
        routing?.unmount();
        routing = undefined;
    });

    it('query_stays_in_the_address_bar_when_the_page_is_loaded_with_one', () => {
        internalRoutes.length = 0;
        internalRoutes.push({ name: 'bank-return', path: '/bank/return' });
        history.replaceState(null, '', '/bank/return?code=abc123&state=xyz');

        startRouting();

        expect(window.location.pathname).toBe('/bank/return');
        expect(window.location.search).toBe('?code=abc123&state=xyz');
    });

    it('routed_page_can_read_the_query_from_location_when_it_connects', async () => {
        routing = mountRouting([
            { name: 'bank-return', path: '/bank/return', componentTagName: 'test-query-reading-page' },
        ]);

        const page = await routing.navigate<QueryReadingPage>('/bank/return?code=abc123');

        expect(page.searchSeenOnConnect).toBe('?code=abc123');
    });

    it('navigating_to_the_same_path_with_another_query_adds_a_history_entry', () => {
        internalRoutes.length = 0;
        internalRoutes.push({ name: 'search', path: '/search' });
        navigate('/search?q=chair');
        const lengthBefore = history.length;

        navigate('/search?q=table');

        expect(window.location.search).toBe('?q=table');
        expect(history.length).toBe(lengthBefore + 1);
    });

    it('query_is_back_in_the_address_bar_after_a_layout_switch', () => {
        internalRoutes.length = 0;
        internalRoutes.push({ name: 'bank-return', path: '/bank/return' });
        sessionStorage.setItem(
            'layoutNavigation',
            JSON.stringify({ routeName: 'bank-return', params: { code: 'abc123' }, search: '?code=abc123' })
        );
        history.replaceState(null, '', '/noauth.html#rlx-layout');

        startRouting();

        expect(window.location.pathname).toBe('/bank/return');
        expect(window.location.search).toBe('?code=abc123');
    });

    it('layout_switch_carries_the_query_so_the_layout_page_can_restore_it', () => {
        internalRoutes.length = 0;
        internalRoutes.push({ name: 'bank-return', path: '/bank/return', layout: 'noauth' });
        history.replaceState(null, '', '/bank/return?code=abc123');

        startRouting();

        const stored = JSON.parse(sessionStorage.getItem('layoutNavigation')!);
        expect(stored.search).toBe('?code=abc123');
    });
});
