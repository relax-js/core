import type { Route, RouteData, RouteParamType, RouteMatchResult } from './types';

/**
 * Route segment matcher interface.
 * Each segment type (string, number, path) implements this
 * for parameter extraction and validation.
 */
interface RouteSegment {
    /**
     * Parameter name when segment is dynamic (:name or ;id)
     */
    paramName?: string;

    /**
     * Validates if URL segment matches pattern
     * @param value Segment from URL to validate
     */
    isMatch(value: string): boolean;

    /**
     * Converts URL segment to typed parameter
     * @param pathValue Raw value from URL
     */
    getValue(pathValue: string): RouteParamType;
}

/**
 * Number parameter segment matcher.
 * Used for ;id style parameters that must be numbers.
 */
class NumberRouteSegment implements RouteSegment {
    constructor(public paramName: string) {}
    isMatch(value: string): boolean {
        if (/^\d+$/.test(value)) {
            return true;
        }
        return false;
    }

    getValue(pathValue: string): RouteParamType {
        if (/^\d+$/.test(pathValue) === false) {
            throw new Error(
                `Path is not a number, parameter name '${this.paramName}', value: '${pathValue}'.`
            );
        }
        return parseInt(pathValue);
    }
}

/**
 * String parameter segment matcher.
 * Used for :name style parameters.
 */
class StringRouteSegment implements RouteSegment {
    constructor(public paramName: string) {}
    isMatch(_value: string): boolean {
        return true;
    }

    /**
     *
     * @param pathValue the route data (for route by name) or segment extracted from the url (for url routing).
     * @returns
     */
    getValue(pathValue: string): RouteParamType {
        return pathValue;
    }
}

/**
 * Static path segment matcher.
 * Used for fixed URL parts like 'users' in /users/:id
 */
class PathRouteSegment implements RouteSegment {
    constructor(public value: string) {}
    isMatch(value: string): boolean {
        return value == this.value;
    }

    getValue(_pathValue: string): RouteParamType {
        return this.value;
    }
}

/**
 * Internal route implementation that handles segment matching
 * and parameter extraction.
 */
class RouteImp {
    constructor(public route: Route, private segments: RouteSegment[]) {}

    /**
     * Attempts to match URL segments against route pattern
     * @param segments URL parts to match
     * @returns Match result with parameters if successful
     */
    match(segments: string[]): RouteMatchResult | null {
        if (segments.length != this.segments.length) {
            return null;
        }

        const generatedSegments: string[] = [];
        var params: RouteData = {};
        for (let index = 0; index < segments.length; index++) {
            const urlSegment = segments[index];
            const ourSegment = this.segments[index];

            if (!ourSegment.isMatch(urlSegment)) {
                return null;
            }

            if (ourSegment.paramName) {
                const value = ourSegment.getValue(urlSegment);
                params[ourSegment.paramName] = value;
                generatedSegments.push(value.toString());
            } else {
                generatedSegments.push(urlSegment);
            }
        }

        return { route: this.route, params, urlSegments: generatedSegments };
    }

    /**
     * Routing by name and route data, so generate the url segments.
     * @param routeData Data to use in the URL.
     * @returns Match result with parameters if successful
     */
    buildUrl(routeData: RouteData): RouteMatchResult | null {
        const urlSegments: string[] = [];
        for (let index = 0; index < this.segments.length; index++) {
            const ourSegment = this.segments[index];
            if (ourSegment.paramName) {
                var value = routeData[ourSegment.paramName];
                if (!value) {
                    throw new Error(
                        `Route "${
                            this.route.name
                        }" did not get value for parameter "${
                            ourSegment.paramName
                        } from the provided routeData: "${JSON.stringify(
                            routeData
                        )}".`
                    );
                }

                urlSegments.push(value.toString());
            } else {
                urlSegments.push(ourSegment.getValue('').toString());
            }
        }

        return { route: this.route, params: routeData, urlSegments };
    }

}

/**
 * Match route by either name or URL pattern
 * @param routes Available routes
 * @param routeNameOrUrl Route name or URL to match
 * @param routeData Optional parameters for named routes
 */
export function matchRoute(
    routes: Route[],
    routeNameOrUrl: string,
    routeData?: Record<string, string | any>
): RouteMatchResult | null {
    if (routeNameOrUrl === '' || routeNameOrUrl.indexOf('/') >= 0) {
        return findRouteByUrl(routes, routeNameOrUrl || '/');
    } else {
        return findRouteByName(routes, routeNameOrUrl, routeData!);
    }
}

/**
 * Find route by name and apply parameters
 * @param routes Available routes
 * @param name Route name to find
 * @param routeData Parameters to apply
 */
export function findRouteByName(
    routes: Route[],
    name: string,
    routeData?: Record<string, string | any>
): RouteMatchResult | null {
    var route = routes.find((x) => x.name === name);
    if (!route) {
        return null;
    }

    var imp = generateRouteImp(route);
    var result = imp.buildUrl(routeData ?? {});
    return result;
}

/**
 * Find route matching URL pattern
 * @param routes Available routes
 * @param path URL to match
 */
export function findRouteByUrl(
    routes: Route[],
    path: string
): RouteMatchResult | null {
    const urlSegments = path.replace(/^\/|\/$/g, '').split('/');
    const routeImps = generateRouteImps(routes);

    for (let index = 0; index < routeImps.length; index++) {
        const element = routeImps[index];
        const m = element.match(urlSegments);
        if (m) {
            return m;
        }
    }
    return null;
}

/**
 * Generate implementations for all routes
 */
function generateRouteImps(routes: Route[]) {
    const routeImps: RouteImp[] = [];
    routes.forEach((route) => {
        var imp = generateRouteImp(route);
        routeImps.push(imp);
    });

    return routeImps;
}

/**
 * Generate implementation for single route
 * Parses URL pattern into segment matchers
 */
function generateRouteImp(route: Route): RouteImp {
    var impSegments: RouteSegment[] = [];
    const segments = route.path.replace(/^\/|\/$/g, '').split('/');
    segments.forEach((segment) => {
        if (segment.substring(0, 1) == ':') {
            impSegments.push(new StringRouteSegment(segment.substring(1)));
        } else if (segment.substring(0, 1) === ';') {
            impSegments.push(new NumberRouteSegment(segment.substring(1)));
        } else if (segment.substring(0, 1) === '{') {
        } else {
            impSegments.push(new PathRouteSegment(segment));
        }
    });

    var imp = new RouteImp(route, impSegments);
    return imp;
}
