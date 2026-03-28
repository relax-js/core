import { reportError } from '../errors';
import { NavigateRouteEvent } from './NavigateRouteEvent';

type RouteTargetHandler = (evt: NavigateRouteEvent) => void;
const targetHandlers = new Map<string | undefined, RouteTargetHandler>();
const pendingEvents = new Map<string | undefined, NavigateRouteEvent>();

/**
 * Registers a route target handler.
 * When a navigation event targets this name, the handler is called directly.
 * If a pending event exists for this target, it is replayed immediately.
 *
 * @param name - Target name, or `undefined` for the default (unnamed) target
 * @param handler - Callback that receives the `NavigateRouteEvent`
 *
 * @example
 * registerRouteTarget('sidebar', (evt) => renderComponent(evt));
 */
export function registerRouteTarget(
    name: string | undefined,
    handler: RouteTargetHandler,
) {
    initRouteTargetListener();
    if (targetHandlers.has(name)) {
        const error = reportError('Duplicate route target', {
            target: name ?? 'default',
        });
        if (error) throw error;
        return;
    }
    targetHandlers.set(name, handler);

    const pending = pendingEvents.get(name);
    if (pending) {
        pendingEvents.delete(name);
        handler(pending);
    }
}

/**
 * Unregisters a previously registered route target handler.
 *
 * @param name - Target name that was passed to `registerRouteTarget`
 */
export function unregisterRouteTarget(name: string | undefined) {
    targetHandlers.delete(name);
}

export function clearPendingNavigations() {
    pendingEvents.clear();
    targetHandlers.clear();
}

function dispatchToTarget(evt: NavigateRouteEvent) {
    const handler = targetHandlers.get(evt.routeTarget);
    if (handler) {
        handler(evt);
    } else {
        pendingEvents.set(evt.routeTarget, evt);
    }
}

let listenerAttached = false;

export function initRouteTargetListener() {
    if (listenerAttached) return;
    listenerAttached = true;
    document.addEventListener(NavigateRouteEvent.NAME, (evt) => {
        dispatchToTarget(evt as NavigateRouteEvent);
    });
}
