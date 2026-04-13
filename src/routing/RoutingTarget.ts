import { registerRouteTarget, unregisterRouteTarget } from './routeTargetRegistry';
import type { NavigateRouteEvent } from './NavigateRouteEvent';
import type { RouteData, LoadRoute } from './types';
import { RelaxError, reportError } from '../errors';

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
        console.log('registered');
    }

    disconnectedCallback() {
        unregisterRouteTarget(this.name);
    }

    private onNavigate(evt: NavigateRouteEvent) {
        console.log('got nav', evt);
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

        await customElements.whenDefined(tagName);
        const element = document.createElement(tagName);

        await this.applyRouteData(element, evt.routeData);

        if (this.dialog) {
            this.dialog.replaceChildren(element);
            if (!this.dialog.open) {
                this.dialog.showModal();
            }
        } else if (document.startViewTransition) {
            document.startViewTransition(() => this.replaceChildren(element));
        } else {
            this.replaceChildren(element);
        }
    }

    /** Closes the dialog (only applies to dialog targets). */
    close() {
        this.dialog?.close();
    }

    private async applyRouteData(element: Element, data?: RouteData) {
        if ('loadRoute' in element) {
            const routeData = data
                ?? { error: 'loadRoute function without mapped route data in the routes' };
            await (element as unknown as LoadRoute).loadRoute(routeData);
        }

        if (data) {
            (element as any).routeData = data;
        }
    }
}
