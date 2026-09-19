import type { LoadRoute, Routable } from '../../../src/routing';

interface Params {
    userId: string;
}

export class Page extends HTMLElement implements LoadRoute<Params>, Routable<Params> {
    routeData?: Params;

    loadRoute(data: Params) {
        this.routeData = data;
    }
}
