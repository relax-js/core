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
        const element = await this.createComponent(evt);
        if (!element) {
            return;
        }

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
     * Creates the route's page, or returns undefined when it cannot be created.
     *
     * A route that names its class constructs it with `new`, which needs no tag lookup. That
     * keeps such routes working in jsdom, which lacks `customElements.getName`.
     */
    private async createComponent(evt: NavigateRouteEvent): Promise<HTMLElement | undefined> {
        const tagName = evt.route.componentTagName;
        if (tagName) {
            if (evt.route.load && !customElements.get(tagName)) {
                if (!(await this.loadModule(evt.route.load, tagName, evt))) {
                    return undefined;
                }
            } else {
                await this.whenComponentRegistered(tagName, evt);
            }
            return document.createElement(tagName);
        }

        if (evt.route.component) {
            return new evt.route.component();
        }

        const error = reportError('Failed to find component for route', {
            route: evt.route.name,
            routeData: evt.routeData,
        });
        if (error) throw error;
        return undefined;
    }

    /**
     * Runs the route's `load()` and checks that it defined the tag.
     *
     * Unlike waiting on `customElements.whenDefined`, the router knows when the import is done,
     * so a module that defines another tag (or none) is reported at once instead of after a
     * timeout. Returns false when the page cannot be created.
     */
    private async loadModule(
        load: () => Promise<unknown>,
        tagName: string,
        evt: NavigateRouteEvent
    ): Promise<boolean> {
        try {
            await load();
        } catch (cause) {
            const error = reportError(
                `Route '${evt.route.name}' could not load <${tagName}>: its load() failed.`,
                { route: evt.route.name, componentTagName: tagName, cause }
            );
            if (error) throw error;
            return false;
        }

        if (customElements.get(tagName)) {
            return true;
        }

        const error = reportError(
            `Route '${evt.route.name}' ran load(), but <${tagName}> is still not defined. Check that the loaded module calls customElements.define('${tagName}', ...) with the same tag name.`,
            { route: evt.route.name, componentTagName: tagName }
        );
        if (error) throw error;
        return false;
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
