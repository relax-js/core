type WebComponentConstructor = new (...args: any[]) => HTMLElement;

export enum GuardResult {
    /**
     * Handle route without checking more guards.
     */
    Allow,

    /**
     * Throw a RouteGuardError.
     */
    Deny,

    /**
     * Resume and check other guards.
     */
    Continue,

    /**
     * Do not invoke the rooute nor other guards.
     */
    Stop
}

export interface RouteGuard {
    check(route: RouteMatchResult): GuardResult;
}

export interface Route {
    name?: string;
    target?: string;
    path: string;

    /**
     * HTML file name (without extension).
     *
     * Define for instance if you have a route that requires a more limited layout. The library
     * will automatically load that HTML file and rewrite URL history so that the correct url is displayed.
     */
    layout?: string;

    /**
     * Name of the tag for your web component.
     */
    componentTagName?: string;

    /**
     * Guards used to check if this route can be visited.
     */
    guards?: RouteGuard[];

    component?: WebComponentConstructor;
}

export type RouteParamType = string | number;
export type RouteData = Record<string, RouteParamType>;

/**
 * Implement to receive typed route parameters via a `routeData` property.
 * RouteTarget assigns `routeData` after element creation but before DOM insertion.
 * Optional since it's not available at construction time.
 *
 * For convention-based usage without undefined checks, skip the interface
 * and declare `routeData` directly on your component.
 *
 * @example
 * class UserProfile extends HTMLElement implements Routable<{ userName: string }> {
 *     routeData?: { userName: string };
 * }
 */
export interface Routable<T extends RouteData = RouteData> {
    routeData?: T;
}

/**
 * Implement to run async initialization before the component is added to the DOM.
 * RouteTarget calls `loadRoute()` and awaits it before inserting the element.
 *
 * @example
 * class OrderDetail extends HTMLElement implements LoadRoute<{ orderId: number }> {
 *     async loadRoute(data: { orderId: number }) {
 *         this.order = await fetchOrder(data.orderId);
 *     }
 * }
 */
export interface LoadRoute<T extends RouteData = RouteData> {
    loadRoute(data: T): void | Promise<void>;
}

/**
 * Result from route matching operations.
 * Contains all information needed for navigation and rendering.
 */
export type RouteMatchResult = {
    /**
     * Matched route configuration
     */
    route: Route;

    /**
     * URL segments used for history state
     */
    urlSegments: string[];

    /**
     * Extracted and type-converted parameters
     */
    params: RouteData;
};

/**
 * Supported types of route segments
 */
export type RouteSegmentType = 'string' | 'number' | 'path' | 'regex';

/**
 * Strongly typed route segment value
 */
export interface RouteValue {
    /**
     * Type of parameter for validation
     */
    type: RouteSegmentType;

    /**
     * Actual parameter value
     */
    value: any;
}

export class RouteError extends Error {}
export class RouteGuardError extends RouteError {
    isGuard;
}

export interface NavigateOptions {
    /**
     * Optional parameters when using route name
     */
    params?: Record<string, string | number>;

    /**
     * override for route's default target
     */
    target?: string;

    /**
     * When you want to override routes from the globally registered ones.
     */
    routes?: Route[];
}
