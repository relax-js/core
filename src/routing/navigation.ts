/**
 * Single Page Application routing system with multiple target support.
 * Designed for scenarios where you need:
 * - Multiple navigation targets (main content, modals, sidebars)
 * - Strongly typed route parameters
 * - History management with back/forward support
 *
 * @example
 * // Configure routes
 * const routes = [
 *   { name: 'user', path: '/users/:id' },          // String parameter
 *   { name: 'order', path: '/orders/;orderId' },   // Number parameter
 *   { name: 'modal', path: '/detail/:id', target: 'modal' }  // Custom target
 * ];
 */

import { reportError } from '../errors';
import {
    GuardResult,
    RouteError,
    RouteGuardError,
    type Route,
    type RouteData,
    type RouteParamType,
    type RouteMatchResult,
    type NavigateOptions,
} from './types';
import { NavigateRouteEvent } from './NavigateRouteEvent';
import { matchRoute, findRouteByName, findRouteByUrl } from './routeMatching';
import { initRouteTargetListener, getTargetHistory } from './routeTargetRegistry';
import { RouteLink } from './RouteLink';
import { RouteTarget } from './RoutingTarget';
import type { NavigationEntry } from './NavigationHistory';

/**
 * State stored in `history.pushState` / `history.replaceState`.
 * Contains everything the popstate handler needs to replay a navigation
 * into the correct route target.
 */
interface NavigationState {
    target?: string;
    routeName?: string;
    params: RouteData;
    urlSegments: string[];
    entryId: number;
}

let nextEntryId = 1;
let popstateAttached = false;

function allocEntryId(): number {
    return nextEntryId++;
}

/**
 * Used to keep track of current main HTML file,
 * used when different layouts are supported.
 *
 * The default page is ALWAYS loaded initially,
 * which means that we need to switch layout page
 * if someone else is configured for the route.
 */
var currentLayout: string | undefined;

function getCurrentLayout(): string {
    if (currentLayout === undefined) {
        currentLayout = getLayout() ?? 'default';
    }
    return currentLayout;
}

function getLayout() {
    const path = window.location.pathname;
    if (path == '/index.html') {
        return 'default';
    }

    return path.endsWith('.html') ? path.slice(1, -5) : null;
}

export const internalRoutes: Route[] = [];

export const MyData = {
    routes: []
};

/**
 * Debug helper to print all registered routes to console.
 */
export function printRoutes() {
    console.log(internalRoutes);
}

/**
 * Registers application routes with the router.
 * Call this at application startup before routing begins.
 *
 * @param appRoutes - Array of route configurations
 * @throws Error if referenced components are not registered
 *
 * @example
 * const routes: Route[] = [
 *     { name: 'home', path: '/', componentTagName: 'app-home' },
 *     { name: 'user', path: '/users/:id', componentTagName: 'user-profile' },
 *     { name: 'login', path: '/auth/', componentTagName: 'login-form', layout: 'noauth' }
 * ];
 * defineRoutes(routes);
 */
export function defineRoutes(appRoutes: Route[]) {
    console.log('defining routes1', appRoutes);
    initRouteTargetListener();
    if (!customElements.get('r-route-target')) {
        customElements.define('r-route-target', RouteTarget);
    }
    if (!customElements.get('r-link')) {
        customElements.define('r-link', RouteLink);
    }
    console.log('defining routes', appRoutes);
    internalRoutes.length = 0;
    internalRoutes.push(...appRoutes);

    var errs: string[] = [];
    appRoutes.forEach((route) => {
        if (
            route.componentTagName &&
            !customElements.get(route.componentTagName)
        ) {
            errs.push(
                `Component with tagName '${route.componentTagName}' is not defined in customElements.`
            );
        }
        if (route.component && !customElements.getName(route.component)) {
            errs.push(
                `Component '${route.component.name}' is not defined in customElements. Used in route '${JSON.stringify(route)}'.`
            );
        }
        if (route.layout === '') {
            console.log('should not use empty string layout.', route);
            route.layout = undefined;
        }
    });

    if (errs.length > 0) {
        throw new Error(errs.join('\n'));
    }
}

/**
 * Initializes routing and navigates to the current URL.
 * Call this after DOM is ready and routes are defined.
 *
 * @example
 * // In your main application component
 * connectedCallback() {
 *     defineRoutes(routes);
 *     startRouting();
 * }
 */
export function startRouting() {
    if (getCurrentLayout() == '') {
        const path = window.location.pathname;
        const match = path.match(/\/([^\/]+)\.html$/);
        if (match && match[1] !== '') {
            console.log('setting current layut', match[1]);
            currentLayout = match[1];
        } else {
            console.log('Setting default layout name');
            currentLayout = 'default';
        }
    }

    if (tryLoadRouteFromLayoutNavigation()) {
        return;
    }

    const currentUrl = window.location.pathname.replace(/^\/|\/$/g, '') || '/';
    const routeResult = findRoute(currentUrl, {});

    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.size > 0) {
        routeResult.params ??= {};
        searchParams.forEach((value, key) => {
            routeResult.params[key] = value;
        });
    }

    if (navigateToLayout(routeResult)) {
        return;
    }

    attachPopstateListener();

    const target = routeResult.route.target;
    const entryId = allocEntryId();
    const state: NavigationState = {
        target,
        routeName: routeResult.route.name,
        params: routeResult.params,
        urlSegments: routeResult.urlSegments,
        entryId,
    };
    history.replaceState(state, '', '/' + routeResult.urlSegments.join('/'));

    const e = new NavigateRouteEvent(
        routeResult.route,
        routeResult.urlSegments,
        routeResult.params,
        target
    );
    e.entryId = entryId;
    document.dispatchEvent(e);
}

/**
 * Navigates to a route by name or URL.
 * Updates browser history and dispatches navigation events.
 *
 * @param routeNameOrUrl - Route name or URL path to navigate to
 * @param options - Navigation options including params and target
 *
 * @example
 * // Navigate by route name
 * navigate('user', { params: { id: '123' } });
 *
 * // Navigate by URL
 * navigate('/users/123');
 *
 * // Navigate to specific target
 * navigate('detail', { params: { id: '42' }, target: 'modal' });
 */
export function navigate(routeNameOrUrl: string, options?: NavigateOptions) {
    console.log('navigating to ', routeNameOrUrl, options);
    const routeResult = findRoute(routeNameOrUrl, options);
    if (navigateToLayout(routeResult)) {
        return;
    }

    attachPopstateListener();

    const target = options?.target ?? routeResult.route.target;
    const entryId = allocEntryId();
    const ourUrl = routeResult.urlSegments.join('/');
    const currentUrl = window.location.pathname.replace(/^\/|\/$/g, '');
    const state: NavigationState = {
        target,
        routeName: routeResult.route.name,
        params: routeResult.params,
        urlSegments: routeResult.urlSegments,
        entryId,
    };
    if (currentUrl != ourUrl) {
        history.pushState(state, '', '/' + routeResult.urlSegments.join('/'));
    }
    const e = new NavigateRouteEvent(
        routeResult.route,
        routeResult.urlSegments,
        routeResult.params,
        target
    );
    e.entryId = entryId;
    document.dispatchEvent(e);
}

/**
 * Returns `true` when the named target has a previous navigation it can
 * step back to. Pass `undefined` (or omit) for the default unnamed target.
 *
 * @example
 * if (canGoBack()) navigateBack();
 */
export function canGoBack(target?: string): boolean {
    return getTargetHistory(target)?.canGoBack() ?? false;
}

/**
 * Returns `true` when the named target was stepped back and can be stepped
 * forward again. Pass `undefined` for the default unnamed target.
 */
export function canGoForward(target?: string): boolean {
    return getTargetHistory(target)?.canGoForward() ?? false;
}

/**
 * Replays the previous navigation in the named target's history.
 * Updates the browser URL bar via `pushState`. Does nothing if the target
 * has no prior entry.
 *
 * @param target - Target name. Omit for the default unnamed target.
 *
 * @example
 * navigateBack();          // step the default target back
 * navigateBack('modal');   // step the modal target back independently
 */
export function navigateBack(target?: string): void {
    const history = getTargetHistory(target);
    const entry = history?.back();
    if (entry) replayEntry(entry);
}

/**
 * Replays the next navigation in the named target's history (after a back).
 * Does nothing if the target has no forward entry.
 */
export function navigateForward(target?: string): void {
    const history = getTargetHistory(target);
    const entry = history?.forward();
    if (entry) replayEntry(entry);
}

function replayEntry(entry: NavigationEntry): void {
    const routeResult = findRouteByName(internalRoutes, entry.routeName, entry.params);
    if (!routeResult) {
        const error = reportError('Cannot replay navigation entry', {
            routeName: entry.routeName,
            target: entry.target,
        });
        if (error) throw error;
        return;
    }
    const state: NavigationState = {
        target: entry.target,
        routeName: entry.routeName,
        params: entry.params,
        urlSegments: entry.urlSegments,
        entryId: entry.entryId,
    };
    window.history.pushState(state, '', '/' + entry.urlSegments.join('/'));
    dispatchReplay(routeResult.route, entry);
}

function dispatchReplay(route: Route, entry: NavigationEntry): void {
    const evt = new NavigateRouteEvent(
        route,
        entry.urlSegments,
        entry.params,
        entry.target
    );
    evt.isReplay = true;
    evt.entryId = entry.entryId;
    document.dispatchEvent(evt);
}

function attachPopstateListener(): void {
    if (popstateAttached) return;
    popstateAttached = true;
    window.addEventListener('popstate', onPopState);
}

function onPopState(e: PopStateEvent): void {
    const state = e.state as NavigationState | null;
    if (!state || typeof state !== 'object' || !('entryId' in state)) return;

    let routeResult: RouteMatchResult | null = null;
    if (state.routeName) {
        routeResult = findRouteByName(internalRoutes, state.routeName, state.params);
    }
    if (!routeResult) {
        routeResult = findRouteByUrl(internalRoutes, '/' + state.urlSegments.join('/'));
    }
    if (!routeResult) return;

    const entry: NavigationEntry = {
        routeName: state.routeName ?? routeResult.route.name ?? '',
        params: state.params,
        target: state.target,
        urlSegments: state.urlSegments,
        entryId: state.entryId,
    };
    dispatchReplay(routeResult.route, entry);
}

function findRoute(routeNameOrUrl: string, options?: NavigateOptions) {
    const theRoutes = options?.routes ?? internalRoutes;
    const params = options?.params;

    const routeResult = matchRoute(theRoutes, routeNameOrUrl, params);
    if (!routeResult) {
        const errorMsg = generateErrorMessage(
            routeNameOrUrl,
            params,
            theRoutes
        );
        console.error(errorMsg);
        throw new RouteError(errorMsg);
    }

    if (!checkRouteGuards(routeResult)) {
        throw new RouteGuardError('Route guards stopped navigation for route ' + routeNameOrUrl);
    }

    return routeResult;
}

function navigateToLayout(routeResult: RouteMatchResult): boolean {
    if (!routeResult) {
        console.error('Route result is null, cannot navigate to layout.');
    }

    const wantedLayout = (routeResult.route.layout ?? 'default').replace(
        /\.html?$/,
        ''
    );
    if (wantedLayout === getCurrentLayout()) {
        return false;
    }

    console.log(
        'Current layout: ' + getCurrentLayout(),
        'Wanted layout: ' + wantedLayout
    );

    // The hash means that we attempted to redirect to the same layout once,
    // so if it's there and another redirect is requsted, something is wrong.
    //
    // Because the push history should remove it if everything worked out.
    if (window.location.hash) {
        throw Error(
            'A redirect failed, does the requsted layout exist? "' +
                wantedLayout +
                '"?'
        );
    }

    console.log(
        `requires layout switch from ${getCurrentLayout()} to ${wantedLayout}`
    );
    const navigationState = {
        routeName: routeResult.route.name,
        params: routeResult.params || {}
    };

    sessionStorage.setItem('layoutNavigation', JSON.stringify(navigationState));
    const layoutUrl =
        wantedLayout.indexOf('.htm') > -1
            ? `/${wantedLayout}#layout`
            : `/${wantedLayout}.html#layout`;
    console.log('redirecting to ', layoutUrl);
    window.location.href = layoutUrl;
    return true;
}
/**
 * Checks session storage for route information and initiates proper navigation
 * Should be called when page loads to handle layout transitions
 *
 * @returns Whether navigation was initiated from session storage
 *
 * @example
 * // Call on page load
 * document.addEventListener('DOMContentLoaded', () => {
 *   if (handleLayoutNavigation()) {
 *     console.log('Navigation handled from session storage');
 *   }
 * });
 */
function tryLoadRouteFromLayoutNavigation(): boolean {
    try {
        const navigationStateJson = sessionStorage.getItem('layoutNavigation');
        if (!navigationStateJson) {
            return false;
        }

        const navigationState = JSON.parse(navigationStateJson);
        sessionStorage.removeItem('layoutNavigation');
        console.log('session store navigation ', navigationState);
        navigate(navigationState.routeName, {
            params: navigationState.params
        });

        return true;
    } catch (error) {
        sessionStorage.removeItem('layoutNavigation');
        reportError('Failed to navigate from session storage', {
            cause: error,
        });
        return false;
    }
}

function generateErrorMessage(
    routeNameOrUrl: string,
    routeParams: Record<string, RouteParamType> | undefined,
    allRoutes: Route[]
): string {
    var routeData = '';
    if (routeParams) {
        routeData += Object.entries(routeParams)
            .map(([key, value]) => `${key}=${value}`)
            .join(', ');
    } else {
        routeData = '.';
    }

    var routesStr = allRoutes.map(
        (x) =>
            ` * Name: '${x.name}', path: '${x.path}', target: ${
                x.target ?? 'default'
            }\n`
    );
    return `No route matched '${routeNameOrUrl}${routeData}'. Available routes:\n${routesStr}`;
}

function checkRouteGuards(routeResult: RouteMatchResult): boolean {
    if (
        !routeResult ||
        !routeResult.route.guards ||
        routeResult.route.guards.length == 0
    ) {
        return true;
    }

    for (let index = 0; index < routeResult.route.guards.length; index++) {
        const element = routeResult.route.guards[index];
        var result = element.check(routeResult);
        if (result == GuardResult.Allow) {
            return true;
        }

        if (result == GuardResult.Stop) {
            return false;
        }

        if (result == GuardResult.Deny) {
            throw new RouteGuardError(
                `Guard ${element.constructor.name} said 'Deny' for ${routeResult.route.name}`
            );
        }
    }

    return true;
}
