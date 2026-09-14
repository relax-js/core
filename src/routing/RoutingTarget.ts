import { registerRouteTarget, unregisterRouteTarget } from './routeTargetRegistry';
import type { NavigateRouteEvent } from './NavigateRouteEvent';
import type { RouteData, LoadRoute } from './types';
import { RelaxError, reportError } from '../errors';

/**
 * How long a route waits for its component to appear in `customElements`
 * before saying so.
 *
 * A component behind a dynamic import may legitimately take a moment, so the
 * route keeps waiting after the warning rather than failing the navigation.
 */
const COMPONENT_REGISTRATION_WARNING_MS = 5000;

/**
 * WebComponent that listens on the `NavigateRouteEvent` event to be able to switch route.
 *
 * Use the "name" attribute to make this non-default target.
 * Use the "dialog" attribute to render routes inside a native `<dialog>` element
 * with built-in focus trapping, backdrop, and Escape-to-close.
 *
 * @example
 * <r-route-target></r-route-target>
 * <r-route-target name="modal" dialog></r-route-target>
 */
export class RouteTarget extends HTMLElement {
    name?: string = undefined;
    private dialog?: HTMLDialogElement;

    connectedCallback() {
        this.name = this.getAttribute('name') ?? undefined;

        if (this.hasAttribute('dialog')) {
            this.dialog = document.createElement('dialog');
            this.dialog.addEventListener('close', () => {
                this.dialog!.replaceChildren();
            });
            this.appendChild(this.dialog);
        }

        registerRouteTarget(this.name, (evt) => this.onNavigate(evt));
    }

    disconnectedCallback() {
        unregisterRouteTarget(this.name);
    }

    private onNavigate(evt: NavigateRouteEvent) {
        this.loadComponent(evt).catch((error) => {
            if (!(error instanceof RelaxError)) {
                error = reportError('Route navigation failed', {
                    route: evt.route.name,
                    routeTarget: evt.routeTarget,
                    cause: error,
                });
            }
            if (error) {
                console.error(error);
            }
        });
    }

    private async loadComponent(evt: NavigateRouteEvent) {
        const tagName = evt.route.componentTagName
            ?? (evt.route.component ? customElements.getName(evt.route.component) : null);

        if (!tagName) {
            const error = reportError('Failed to find component for route', {
                route: evt.route.name,
                componentTagName: evt.route.componentTagName,
                component: evt.route.component?.name,
                routeData: evt.routeData,
            });
            if (error) throw error;
            return;
        }

        await this.whenComponentRegistered(tagName, evt);
        const element = document.createElement(tagName);

        await this.applyRouteData(element, evt.routeData);

        if (this.dialog) {
            this.dialog.replaceChildren(element);
            if (!this.dialog.open) {
                this.dialog.showModal();
            }
            return;
        }

        await this.showPage(element);
    }

    /**
     * Waits for the route's component to be registered.
     *
     * `customElements.whenDefined` never rejects, so a tag name that is never
     * registered leaves the route waiting with nothing on screen and nothing in
     * the console. The warning breaks that silence without giving up on a
     * component that is merely slow to arrive.
     */
    private async whenComponentRegistered(tagName: string, evt: NavigateRouteEvent) {
        if (customElements.get(tagName)) {
            return;
        }

        const stillWaiting = setTimeout(() => {
            reportError(
                `Route '${evt.route.name}' is waiting for <${tagName}> to be registered with customElements, and cannot render until it is. Check the tag name for typos, and that the module defining the component is imported.`,
                { route: evt.route.name, componentTagName: tagName },
            );
        }, COMPONENT_REGISTRATION_WARNING_MS);

        try {
            await customElements.whenDefined(tagName);
        } finally {
            clearTimeout(stillWaiting);
        }
    }

    /**
     * Puts the page on screen, animated with a view transition when the browser supports one.
     *
     * The browser drops the animation when the tab is hidden or when the visitor navigates again
     * before it has finished. That is normal browsing, not a failed navigation, so the dropped
     * animation is not reported. The visitor must still get the new page, so the swap is done
     * directly when the browser gave up before running it.
     */
    private async showPage(element: Element) {
        if (!document.startViewTransition) {
            this.replaceChildren(element);
            return;
        }

        const transition = document.startViewTransition(() => this.replaceChildren(element));
        transition.ready.catch(() => undefined);
        transition.finished.catch(() => undefined);

        try {
            await transition.updateCallbackDone;
        } catch {
            this.replaceChildren(element);
        }
    }

    /** Closes the dialog (only applies to dialog targets). */
    close() {
        this.dialog?.close();
    }

    private async applyRouteData(element: Element, data?: RouteData) {
        if ('loadRoute' in element) {
            if (!data) {
                console.warn(
                    `[relaxjs:routing] <${element.tagName.toLowerCase()}> has loadRoute(), but the route carries no parameters to hand it. Add parameters to the route path, or drop loadRoute() from the component.`
                );
            }
            const routeData = data
                ?? { r_error: 'loadRoute function without mapped route data in the routes' };
            await (element as unknown as LoadRoute).loadRoute(routeData);
        }

        if (data) {
            (element as any).routeData = data;
        }
    }
}
