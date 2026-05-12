import { reportError } from '../errors';
import { NavigateRouteEvent } from './NavigateRouteEvent';
import { NavigationHistory, type NavigationEntry } from './NavigationHistory';

/** @internal */
type RouteTargetHandler = (evt: NavigateRouteEvent) => void;

/** @internal */
interface TargetRegistration {
    handler: RouteTargetHandler;
    history: NavigationHistory;
}

const targets = new Map<string | undefined, TargetRegistration>();
const pendingEvents = new Map<string | undefined, NavigateRouteEvent>();
const detachedHistories = new Map<string | undefined, NavigationHistory>();

/**
 * Registers a route target handler.
 * When a navigation event targets this name, the handler is called directly.
 * If a pending event exists for this target, it is replayed immediately.
 *
 * Each target owns a NavigationHistory that records every navigation it
 * handles. When a target reconnects after being removed (e.g. layout change),
 * its previous history is restored so back/forward keep working.
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
    if (targets.has(name)) {
        const error = reportError('Duplicate route target', {
            target: name ?? 'default',
        });
        if (error) throw error;
        return;
    }

    const history = detachedHistories.get(name) ?? new NavigationHistory();
    detachedHistories.delete(name);
    targets.set(name, { handler, history });

    const pending = pendingEvents.get(name);
    if (pending) {
        pendingEvents.delete(name);
        dispatchToTarget(pending);
    }
}

/**
 * Unregisters a previously registered route target handler.
 * The target's history is kept aside so it can be restored if a new target
 * with the same name reconnects later.
 *
 * @param name - Target name that was passed to `registerRouteTarget`
 */
export function unregisterRouteTarget(name: string | undefined) {
    const reg = targets.get(name);
    if (reg) {
        detachedHistories.set(name, reg.history);
    }
    targets.delete(name);
}

/**
 * Returns the NavigationHistory for a named target, or `undefined` if no
 * target with that name is currently registered.
 *
 * Used by `navigateBack` / `navigateForward` / `canGoBack` / `canGoForward`
 * to read or walk a target's encapsulated stack.
 */
export function getTargetHistory(name?: string): NavigationHistory | undefined {
    return targets.get(name)?.history;
}

export function clearPendingNavigations() {
    pendingEvents.clear();
    targets.clear();
    detachedHistories.clear();
}

function entryFromEvent(evt: NavigateRouteEvent): NavigationEntry | undefined {
    if (evt.entryId === undefined) return undefined;
    if (!evt.route.name) return undefined;
    return {
        routeName: evt.route.name,
        params: evt.routeData ?? {},
        target: evt.routeTarget,
        urlSegments: evt.urlSegments,
        entryId: evt.entryId,
    };
}

function dispatchToTarget(evt: NavigateRouteEvent) {
    const reg = targets.get(evt.routeTarget);
    if (!reg) {
        pendingEvents.set(evt.routeTarget, evt);
        return;
    }

    if (evt.isReplay) {
        if (evt.entryId !== undefined) {
            reg.history.setIndexById(evt.entryId);
        }
    } else {
        const entry = entryFromEvent(evt);
        if (entry) {
            reg.history.record(entry);
        }
    }

    reg.handler(evt);
}

let listenerAttached = false;

export function initRouteTargetListener() {
    if (listenerAttached) return;
    listenerAttached = true;
    document.addEventListener(NavigateRouteEvent.NAME, (evt) => {
        dispatchToTarget(evt as NavigateRouteEvent);
    });
}
