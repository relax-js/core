/**
 * @module testing
 * Test helpers for applications built on Relaxjs.
 *
 * These exist because the interesting failures in a component are asynchronous or silent:
 * a custom element upgrades on the next task, and a template that cannot resolve an
 * expression reports the problem rather than throwing. Without helpers, every project
 * reinvents the same waiting and the same error capture, usually slightly differently.
 *
 * Import from `@relax.js/core/testing` in test files only.
 */

import { ErrorHandler, RelaxError, onError } from '../errors';
import { setFetch } from '../http/http';
import {
    NavigateRouteEvent,
    clearPendingNavigations,
    defineRoutes,
    navigate,
    type NavigateOptions,
    type Route,
} from '../routing';

/**
 * Waits for pending microtasks and the next macrotask so DOM work started by a
 * lifecycle callback has finished.
 *
 * Custom element callbacks are synchronous, but anything they kick off with `await`
 * is not, so asserting straight after `mount()` sees the element before its data arrived.
 *
 * @example
 * const { element } = mount('user-profile');
 * await flush();
 * expect(element.querySelector('h1')?.textContent).toBe('Alice');
 */
export function flush(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * An element attached to the document, with the means to detach it again.
 */
export interface MountedElement<T extends HTMLElement> {
    element: T;
    /** Removes the element from the document so `disconnectedCallback` runs. */
    unmount(): void;
}

/**
 * Attaches an element to `document.body` so its lifecycle callbacks run.
 *
 * A custom element only upgrades and connects once it is in the document, so a component
 * created with `document.createElement` alone never runs `connectedCallback`.
 *
 * @param target - Tag name to create, or an element to attach
 *
 * @example
 * const { element, unmount } = mount<UserProfile>('user-profile');
 * element.setAttribute('user-id', '42');
 * await flush();
 * unmount();
 */
export function mount<T extends HTMLElement>(target: string | T): MountedElement<T> {
    const element = (typeof target === 'string' ? document.createElement(target) : target) as T;
    document.body.appendChild(element);

    return {
        element,
        unmount() {
            element.remove();
        },
    };
}

/**
 * Errors collected while a capture is installed.
 */
export interface CapturedErrors {
    /** Every `RelaxError` reported since the capture was installed, in order. */
    errors: RelaxError[];
    /** Messages of the collected errors, for readable assertions. */
    messages(): string[];
    /** Puts the previously registered handler back. */
    restore(): void;
}

/**
 * Collects Relaxjs errors instead of letting them throw, so a test can assert on failures
 * that would otherwise only be visible in a browser console.
 *
 * This is what turns a template typo into a test failure. A mistyped expression such as
 * `{{user.naem}}` renders an empty string and reports the problem; without capturing it,
 * the test sees an empty element and no reason for it.
 *
 * Errors are suppressed while the capture is installed, so rendering continues and the
 * assertion is reached.
 *
 * @example
 * const captured = captureRelaxErrors();
 * try {
 *     render({ user: { name: 'Alice' } });
 *     expect(captured.messages()).toEqual([]);
 * } finally {
 *     captured.restore();
 * }
 */
export function captureRelaxErrors(): CapturedErrors {
    const errors: RelaxError[] = [];
    let previous: ErrorHandler | null = null;

    previous = onError((error, ctx) => {
        errors.push(error);
        ctx.suppress();
    });

    return {
        errors,
        messages() {
            return errors.map((error) => error.message);
        },
        restore() {
            onError(previous as ErrorHandler);
        },
    };
}

/**
 * How the routing harness is set up.
 */
export interface RoutingOptions {
    /** Names of `<r-route-target name="...">` elements to add besides the default one. */
    targets?: string[];
    /** How long `navigate()` waits for the component to appear, in milliseconds. Default 1000. */
    timeout?: number;
}

/**
 * Routes registered and targets in the document, with a `navigate()` that resolves
 * once the component is on the page.
 */
export interface RoutingHarness {
    /** The unnamed `<r-route-target>`, where routes without a `target` render. */
    target: HTMLElement;
    /**
     * Navigates like the application does and resolves with the routed component once it is
     * inside its target, which is after `loadRoute()` finished. Rejects when no route matched,
     * when a guard stopped the navigation, or when nothing rendered within the timeout.
     */
    navigate<T extends HTMLElement>(routeNameOrUrl: string, options?: NavigateOptions): Promise<T>;
    /** Removes the targets from the document and forgets any parked navigation. */
    unmount(): void;
}

/**
 * Registers routes and puts route targets in the document, so a test can navigate the way
 * the application does and get the rendered component back.
 *
 * Navigation is asynchronous in several steps (the target may connect later, the component
 * may be registered later, `loadRoute()` may await a request), and each step reports rather
 * than throws when it cannot complete. The harness waits for the component to actually be in
 * the target, and when it never arrives the error says which Relaxjs errors were reported
 * meanwhile.
 *
 * Routes are matched against the layout the document is in, so a route with a `layout`
 * other than the current one cannot be navigated to here; the router would reload the page.
 *
 * @example
 * const routing = mountRouting([
 *     { name: 'user', path: '/users/:id', componentTagName: 'user-profile' },
 * ]);
 * try {
 *     const page = await routing.navigate<UserProfile>('user', { params: { id: '42' } });
 *     expect(page.routeData).toEqual({ id: '42' });
 * } finally {
 *     routing.unmount();
 * }
 */
export function mountRouting(routes: Route[], options?: RoutingOptions): RoutingHarness {
    const timeout = options?.timeout ?? 1000;

    clearPendingNavigations();
    defineRoutes(routes);

    const target = document.createElement('r-route-target');
    const named = (options?.targets ?? []).map((name) => {
        const element = document.createElement('r-route-target');
        element.setAttribute('name', name);
        return element;
    });
    document.body.append(target, ...named);

    return {
        target,
        navigate<T extends HTMLElement>(routeNameOrUrl: string, navigateOptions?: NavigateOptions) {
            return navigateAndWait<T>(routeNameOrUrl, navigateOptions, timeout);
        },
        unmount() {
            target.remove();
            named.forEach((element) => element.remove());
            clearPendingNavigations();
        },
    };
}

async function navigateAndWait<T extends HTMLElement>(
    routeNameOrUrl: string,
    options: NavigateOptions | undefined,
    timeout: number
): Promise<T> {
    let dispatched: NavigateRouteEvent | undefined;
    const remember = (evt: Event) => {
        dispatched = evt as NavigateRouteEvent;
    };
    document.addEventListener(NavigateRouteEvent.NAME, remember);
    const errorsBefore = window.relaxErrors?.length ?? 0;
    try {
        navigate(routeNameOrUrl, options);
    } finally {
        document.removeEventListener(NavigateRouteEvent.NAME, remember);
    }
    if (!dispatched) {
        throw new Error(`navigate('${routeNameOrUrl}') dispatched no navigation event.`);
    }

    const targetName = dispatched.routeTarget;
    const targetElement = document.querySelector(
        targetName ? `r-route-target[name="${targetName}"]` : 'r-route-target:not([name])'
    );
    if (!targetElement) {
        throw new Error(
            `Route '${dispatched.route.name}' renders into the route target '${targetName ?? 'default'}', which is not in the document. Pass it in the targets option of mountRouting().`
        );
    }

    const route = dispatched.route;
    const tagName =
        route.componentTagName ?? (route.component ? customElements.getName(route.component) : null);
    if (!tagName) {
        throw new Error(`Route '${route.name}' has neither componentTagName nor component.`);
    }

    const previous = targetElement.querySelector(tagName);
    return new Promise<T>((resolve, reject) => {
        const rendered = () => {
            const element = targetElement.querySelector(tagName);
            return element && element !== previous ? (element as T) : null;
        };

        const observer = new MutationObserver(() => {
            const element = rendered();
            if (element) {
                observer.disconnect();
                clearTimeout(timer);
                resolve(element);
            }
        });
        observer.observe(targetElement, { childList: true, subtree: true });

        const timer = setTimeout(() => {
            observer.disconnect();
            const reported = (window.relaxErrors ?? [])
                .slice(errorsBefore)
                .map((error) => `\n - ${error.message}`)
                .join('');
            reject(
                new Error(
                    `Navigation to '${route.name}' did not render <${tagName}> into the '${targetName ?? 'default'}' route target within ${timeout} ms.` +
                        (reported ? ` Errors reported meanwhile:${reported}` : ' No errors were reported.')
                )
            );
        }, timeout);

        const already = rendered();
        if (already) {
            observer.disconnect();
            clearTimeout(timer);
            resolve(already);
        }
    });
}

/**
 * One request the fake server received, as the http module sent it.
 */
export interface ReceivedRequest {
    method: string;
    /** URL as fetch received it, including the configured base URL and any query string. */
    url: string;
    /** `url` without the query string. */
    path: string;
    query: URLSearchParams;
    headers: Headers;
    /** The request body as sent, normally a JSON string. */
    body: unknown;
    /** The request body parsed as JSON. */
    json<T = unknown>(): T;
}

/**
 * A response body, or a function computing one from the request. Spelled without `unknown`,
 * which would absorb the function member and leave the callback's parameter untyped.
 */
export type FakeResponseBody = ((request: ReceivedRequest) => unknown) | object | string | number | boolean | null;

/**
 * Canned responses for requests made through `@relax.js/core/http`, and a record of what was asked.
 */
export interface FakeServer {
    /** Every request received, in order, including those no response was registered for. */
    requests: ReceivedRequest[];
    /**
     * Responds to `method` and `path` with `body` serialized as JSON. `path` is compared
     * without the query string and includes the configured base URL, since that is what a
     * server sees. A function body is called with each request.
     */
    on(method: string, path: string, body?: FakeResponseBody, status?: number): FakeServer;
    /** Puts the real fetch back. */
    restore(): void;
}

/**
 * Replaces the network for `@relax.js/core/http` with canned responses, so a component that
 * loads data can be tested without a server and the test can assert on what was sent.
 *
 * A request nothing was registered for gets a 404 whose body names the registered routes, and
 * is recorded like any other, so an unexpected call shows up in `requests` instead of hanging
 * or hitting the network.
 *
 * Only requests made through the http module are intercepted. A component calling `fetch`
 * directly is outside this seam.
 *
 * @example
 * const server = fakeServer()
 *     .on('GET', '/api/users/42', { id: 42, name: 'Alice' })
 *     .on('POST', '/api/users', (request) => ({ id: 43, ...request.json() }), 201);
 * try {
 *     const { element } = mount<UserProfile>('user-profile');
 *     await flush();
 *     expect(server.requests.map((r) => r.path)).toEqual(['/api/users/42']);
 * } finally {
 *     server.restore();
 * }
 */
export function fakeServer(): FakeServer {
    interface Registered {
        method: string;
        path: string;
        body: FakeResponseBody | undefined;
        status: number;
    }
    const registered: Registered[] = [];
    const requests: ReceivedRequest[] = [];

    setFetch(async (input, init) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const [path, queryString] = url.split('?', 2);
        const method = (init?.method ?? 'GET').toUpperCase();
        const body = init?.body;
        const request: ReceivedRequest = {
            method,
            url,
            path,
            query: new URLSearchParams(queryString ?? ''),
            headers: new Headers(init?.headers),
            body,
            json<T>() {
                if (typeof body !== 'string') {
                    throw new Error(`Request body of ${method} ${path} is not a string, it cannot be parsed as JSON.`);
                }
                return JSON.parse(body) as T;
            },
        };
        requests.push(request);

        const match = registered.find((r) => r.method === method && r.path === path);
        if (!match) {
            const known = registered.map((r) => `\n - ${r.method} ${r.path}`).join('');
            return new Response(
                `No fake response registered for ${method} ${path}.` +
                    (known ? ` Registered:${known}` : ' Nothing is registered.'),
                { status: 404, statusText: 'Not Found' }
            );
        }

        const responseBody = typeof match.body === 'function' ? match.body(request) : match.body;
        const ok = match.status >= 200 && match.status < 300;
        const text =
            responseBody === undefined
                ? null
                : !ok && typeof responseBody === 'string'
                  ? responseBody
                  : JSON.stringify(responseBody);
        return new Response(text, {
            status: match.status,
            headers: { 'content-type': 'application/json' },
        });
    });

    const server: FakeServer = {
        requests,
        on(method, path, body, status = 200) {
            registered.push({ method: method.toUpperCase(), path, body, status });
            return server;
        },
        restore() {
            setFetch();
        },
    };
    return server;
}
