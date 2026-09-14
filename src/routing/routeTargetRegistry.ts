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
const parkedReports = new Map<string | undefined, ReturnType<typeof setTimeout>>();

/**
 * Stops the pending report for a target, used when the navigation is claimed or
 * discarded. A parked navigation is only wrong once it is clear that no target
 * is coming, so the report has to be cancellable.
 */
function cancelParkedReport(name: string | undefined) {
    const timer = parkedReports.get(name);
    if (timer !== undefined) {
        clearTimeout(timer);
        parkedReports.delete(name);
    }
}

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

    const restoredHistory = detachedHistories.get(name);
    const history = restoredHistory ?? new NavigationHistory();
    detachedHistories.delete(name);
    targets.set(name, { handler, history });

    if (window.relaxDebug?.routing) {
        console.log('[relaxjs:routing] target registered', name ?? 'default', {
            historyRestored: restoredHistory !== undefined,
        });
    }

    const pending = pendingEvents.get(name);
    if (pending) {
        pendingEvents.delete(name);
        cancelParkedReport(name);
        if (window.relaxDebug?.routing) {
            console.log(
                '[relaxjs:routing] replaying parked navigation into target',
                name ?? 'default',
                pending.route.name
            );
        }
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
    parkedReports.forEach((timer) => clearTimeout(timer));
    parkedReports.clear();
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
        fragment: evt.fragment,
    };
}

/**
 * Reports a parked navigation that nobody claimed.
 *
 * Parking is correct on its own: a target can connect later, and the navigation
 * is replayed when it does. What is never correct is parking forever, which
 * renders nothing and fails nothing. One task is enough for the target to
 * upgrade and connect, so anything still waiting after that is a target that is
 * not coming.
 */
function reportIfStillParked(evt: NavigateRouteEvent) {
    cancelParkedReport(evt.routeTarget);

    const timer = setTimeout(() => {
        parkedReports.delete(evt.routeTarget);
        if (pendingEvents.get(evt.routeTarget) !== evt) return;

        reportError(
            `Navigation to "${evt.route.name}" is waiting for a route target named ` +
                `"${evt.routeTarget ?? 'default'}", which is not connected, so nothing rendered. ` +
                'Add a matching <r-route-target> to the page, or correct the route target name',
            {
                route: evt.route.name,
                target: evt.routeTarget ?? 'default',
                registeredTargets: Array.from(targets.keys(), (name) => name ?? 'default'),
            },
        );
    }, 0);

    parkedReports.set(evt.routeTarget, timer);
}

function dispatchToTarget(evt: NavigateRouteEvent) {
    const reg = targets.get(evt.routeTarget);
    if (!reg) {
        if (window.relaxDebug?.routing) {
            console.log(
                '[relaxjs:routing] no target registered, navigation parked',
                evt.routeTarget ?? 'default',
                evt.route.name,
                {
                    replacedParkedNavigation: pendingEvents.has(evt.routeTarget),
                    registeredTargets: Array.from(targets.keys(), (name) => name ?? 'default'),
                }
            );
        }
        const replaced = pendingEvents.get(evt.routeTarget);
        if (replaced) {
            reportError(
                `A navigation to "${replaced.route.name}" was still waiting for the route target ` +
                    `"${evt.routeTarget ?? 'default'}" to connect and has been replaced by ` +
                    `"${evt.route.name}". Only the last one will render`,
                {
                    target: evt.routeTarget ?? 'default',
                    discarded: replaced.route.name,
                    kept: evt.route.name,
                },
            );
        }

        pendingEvents.set(evt.routeTarget, evt);
        reportIfStillParked(evt);
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
