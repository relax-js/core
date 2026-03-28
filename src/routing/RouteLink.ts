import { navigate, printRoutes } from './navigation';
import { RelaxError, reportError } from '../errors';

export class RouteLink extends HTMLElement {
    static get observedAttributes() {
        return ['name', 'target', 'params'];
    }

    constructor() {
        super();
        this.addEventListener('click', e => this.handleClick(e));
    }

    private handleClick(e: MouseEvent)  {
        e.preventDefault();
        
        const name = this.getAttribute('name');
        if (!name) return;

        console.log('Calling printRoutes from RouteLink in relaxjs/components');
        printRoutes();
        
        const params: Record<string, string> = {};
        for (const attr of Array.from(this.attributes)) {
            if (attr.name.startsWith('param-')) {
                const paramName = attr.name.substring(6);
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

    connectedCallback() {
        if (!this.hasAttribute('tabindex')) {
            this.setAttribute('tabindex', '0');
        }
        
        this.style.cursor = 'pointer';
        this.role = 'link';
    }

    disconnectedCallback() {
        this.removeEventListener('click', this.handleClick);
    }
}