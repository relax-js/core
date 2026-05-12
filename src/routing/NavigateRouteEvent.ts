import type { Route, RouteData } from './types';

/**
 * Event sent to routing targets when a new route should be displayed.
 */
export class NavigateRouteEvent extends Event {
    static NAME: string = 'rlx.navigateRoute';

    /**
     * Identifies the entry in the target's NavigationHistory and in
     * `history.state.entryId`. Set by `navigate()` for every navigation.
     * Optional only so old call-sites that constructed events manually keep
     * compiling.
     */
    entryId?: number;

    /**
     * `true` when the event is a replay of a previously recorded navigation
     * (e.g. triggered by browser back/forward or `navigateBack`/`navigateForward`).
     * Tells the target registry to move its index instead of recording a new entry.
     */
    isReplay: boolean = false;

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
