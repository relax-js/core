export {
    GuardResult,
    RouteGuard,
    Route,
    RouteParamType,
    RouteData,
    Routable,
    LoadRoute,
    RouteError,
    RouteGuardError,
    NavigateOptions,
    RouteMatchResult,
    RouteSegmentType,
    RouteValue,
} from './types';

export { NavigateRouteEvent } from './NavigateRouteEvent';

export {
    registerRouteTarget,
    unregisterRouteTarget,
    clearPendingNavigations,
    getTargetHistory,
} from './routeTargetRegistry';

export {
    matchRoute,
    findRouteByName,
    findRouteByUrl,
} from './routeMatching';

export {
    internalRoutes,
    defineRoutes,
    startRouting,
    navigate,
    navigateBack,
    navigateForward,
    canGoBack,
    canGoForward,
    printRoutes,
} from './navigation';

export { NavigationHistory, type NavigationEntry } from './NavigationHistory';

export { RouteLink, type RouteLinkDirection } from './RouteLink';
export { RouteTarget } from './RoutingTarget';
