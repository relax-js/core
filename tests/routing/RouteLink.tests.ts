import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RouteLink } from '../../src/routing/RouteLink';
import {
    NavigateRouteEvent,
    Route,
    defineRoutes,
    internalRoutes,
} from '../../src/routing';


describe('RouteLink', () => {
    let element: RouteLink;
    const routes: Route[] = [
        { name: 'home', path: '/' },
        { name: 'user', path: '/users/:id' },
        { name: 'about', path: '/about' },
        { name: 'search', path: '/search' },
        { name: 'product', path: '/products/:id' },
        { name: 'test', path: '/test' },
        { name: 'program', path: '/programs/:programId' },
    ];

    beforeEach(() => {
        internalRoutes.length = 0;
        defineRoutes(routes);

        element = document.createElement('r-link') as RouteLink;
        document.body.appendChild(element);
    });

    afterEach(() => {
        element.remove();
    });

    it('should set tabindex and cursor on connect', () => {
        expect(element.getAttribute('tabindex')).toBe('0');
        expect(element.style.cursor).toBe('pointer');
        expect(element.getAttribute('role')).toBe('link');
    });

    it('should navigate with route name on click', () => {
        let capturedEvent: NavigateRouteEvent | null = null;
        document.addEventListener('rlx.navigateRoute', (e: any) => {
            capturedEvent = e;
        });

        element.setAttribute('name', 'home');
        element.click();

        expect(capturedEvent).not.toBeNull();
        expect(capturedEvent!.route.name).toBe('home');
    });

    it('should not navigate without name attribute', () => {
        let capturedEvent: NavigateRouteEvent | null = null;
        document.addEventListener('rlx.navigateRoute', (e: any) => {
            capturedEvent = e;
        });

        element.click();

        expect(capturedEvent).toBeNull();
    });

    it('should collect param-* attributes', () => {
        let capturedEvent: NavigateRouteEvent | null = null;
        document.addEventListener('rlx.navigateRoute', (e: any) => {
            capturedEvent = e;
        });

        element.setAttribute('name', 'user');
        element.setAttribute('param-id', '123');
        element.click();

        expect(capturedEvent).not.toBeNull();
        expect(capturedEvent!.route.name).toBe('user');
        expect(capturedEvent!.routeData).toEqual(
            expect.objectContaining({ id: '123' })
        );
    });

    it('should convert kebab_case_param_attribute_to_camelCase', () => {
        let capturedEvent: NavigateRouteEvent | null = null;
        document.addEventListener('rlx.navigateRoute', (e: any) => {
            capturedEvent = e;
        });

        element.setAttribute('name', 'program');
        element.setAttribute('param-program-id', '42');
        element.click();

        expect(capturedEvent).not.toBeNull();
        expect(capturedEvent!.routeData).toEqual(
            expect.objectContaining({ programId: '42' })
        );
    });

    it('should resolve_camelCase_param_attribute_lowercased_by_DOM', () => {
        let capturedEvent: NavigateRouteEvent | null = null;
        document.addEventListener('rlx.navigateRoute', (e: any) => {
            capturedEvent = e;
        });

        element.setAttribute('name', 'program');
        element.setAttribute('param-programId', '42');
        element.click();

        expect(capturedEvent).not.toBeNull();
        expect(capturedEvent!.routeData).toEqual(
            expect.objectContaining({ programId: '42' })
        );
    });

    it('should pass target attribute', () => {
        let capturedEvent: NavigateRouteEvent | null = null;
        document.addEventListener('rlx.navigateRoute', (e: any) => {
            capturedEvent = e;
        });

        element.setAttribute('name', 'about');
        element.setAttribute('target', 'main-outlet');
        element.click();

        expect(capturedEvent).not.toBeNull();
        expect(capturedEvent!.routeTarget).toBe('main-outlet');
    });

    it('should prevent default click behavior', () => {
        element.setAttribute('name', 'home');
        const event = new MouseEvent('click', { bubbles: true, cancelable: true });
        const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

        element.dispatchEvent(event);

        expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should call printRoutes on click', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        element.setAttribute('name', 'test');
        element.click();

        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('printRoutes'),
        );

        consoleSpy.mockRestore();
    });
});
