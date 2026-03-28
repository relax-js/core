import type { Route, RouteData } from './types';

/**
 * Event sent to routing targets when a new route should be displayed.
 */
export class NavigateRouteEvent extends Event {
    static NAME: string = 'rlx.navigateRoute';
    constructor(
        /**
         * Matched route.
         */
        public route: Route,

        /**
         * The generated url sements which can be used to push the url into the browser history.
         */
        public urlSegments: string[],

        /**
         * Data supplied to the route.
         */
        public routeData?: RouteData,

        /**
         * The target can differ from the default target that is defined in the route.
         *
         * undefined means that the default (unnamed) target should be used.
         */
        public routeTarget?: string,

        eventInit?: EventInit
    ) {
        super(NavigateRouteEvent.NAME, eventInit);
    }
}

declare global {
    interface HTMLElementEventMap {
        'rlx.navigateRoute': NavigateRouteEvent;
    }
    interface DocumentEventMap {
        'rlx.navigateRoute': NavigateRouteEvent;
    }
}
