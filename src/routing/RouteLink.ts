import {
    navigate,
    navigateBack,
    navigateForward,
    canGoBack,
    canGoForward,
    printRoutes,
} from './navigation';
import { RelaxError, reportError } from '../errors';

/**
 * Direction values accepted by the `direction` attribute on `<r-link>`.
 * When set, the link triggers back/forward in the named target's history
 * instead of navigating to a route by name.
 */
export type RouteLinkDirection = 'back' | 'forward';

export class RouteLink extends HTMLElement {
    static get observedAttributes() {
        return ['name', 'target', 'params', 'direction'];
    }

    constructor() {
        super();
        this.addEventListener('click', e => this.handleClick(e));
    }

    private handleClick(e: MouseEvent)  {
        e.preventDefault();

        const direction = this.getAttribute('direction') as RouteLinkDirection | null;
        if (direction === 'back' || direction === 'forward') {
            this.handleDirectionClick(direction);
            return;
        }

        const name = this.getAttribute('name');
        if (!name) return;

        console.log('Calling printRoutes from RouteLink in relaxjs/components');
        printRoutes();

        const params: Record<string, string> = {};
        for (const attr of Array.from(this.attributes)) {
            if (attr.name.startsWith('param-')) {
                const raw = attr.name.substring(6);
                const paramName = raw.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
                params[paramName] = attr.value;
            }
        }

        const paramsAttr = this.getAttribute('params');
        let additionalParams: Record<string, string | number> | undefined;
        if (paramsAttr) {
            try {
                const parsed = JSON.parse(paramsAttr);
                additionalParams = parsed as Record<string, string | number>;
            } catch (error) {
                const err = reportError('Failed to parse route params', {
                    element: 'r-link',
                    params: paramsAttr,
                    cause: error,
                });
                if (err) throw err;
            }
        }

        const target = this.getAttribute('target');
        if (additionalParams){
            Object.assign(params, additionalParams);
        }

        try {
            navigate(name, { params, target: target || undefined });
        } catch (error) {
            if (error instanceof RelaxError) throw error;
            const reported = reportError('Navigation failed', {
                element: 'r-link',
                route: name,
                params,
                target,
                cause: error,
            });
            if (reported) throw reported;
        }
    }

    private handleDirectionClick(direction: RouteLinkDirection) {
        const target = this.getAttribute('target') || undefined;
        if (direction === 'back') {
            if (!canGoBack(target)) return;
            navigateBack(target);
        } else {
            if (!canGoForward(target)) return;
            navigateForward(target);
        }
    }

    connectedCallback() {
        if (!this.hasAttribute('tabindex')) {
            this.setAttribute('tabindex', '0');
        }

        this.style.cursor = 'pointer';
        this.role = 'link';
        this.updateDirectionState();
    }

    attributeChangedCallback(name: string) {
        if (name === 'direction' || name === 'target') {
            this.updateDirectionState();
        }
    }

    /**
     * Keeps `aria-disabled` in sync with whether the linked target has
     * history to walk. Lets CSS react via `[aria-disabled="true"]`.
     */
    private updateDirectionState() {
        const direction = this.getAttribute('direction') as RouteLinkDirection | null;
        if (direction !== 'back' && direction !== 'forward') {
            this.removeAttribute('aria-disabled');
            return;
        }
        const target = this.getAttribute('target') || undefined;
        const available = direction === 'back' ? canGoBack(target) : canGoForward(target);
        if (available) {
            this.removeAttribute('aria-disabled');
        } else {
            this.setAttribute('aria-disabled', 'true');
        }
    }

    disconnectedCallback() {
        this.removeEventListener('click', this.handleClick);
    }
}
