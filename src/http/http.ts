/**
 * @module http
 * Type-safe HTTP module built on fetch() with automatic JWT handling.
 *
 * @example
 * import { configure, get, post } from './http';
 *
 * configure({ baseUrl: '/api' });
 * const response = await get('/users');
 * const users = response.as<User[]>();
 */

/**
 * Configuration options for the http module.
 */
export interface HttpOptions {
    /**
     * Root URL to remote endpoint. Used so that each method only has to specify path in requests.
     */
    baseUrl?: string;

    /**
     * Default content type to use if none is specified in the request method.
     */
    contentType?: string;

    /**
     * Checks for a JWT token in localStorage to automatically include it in requests.
     *
     * Undefined = use "jwt", null = disable.
     */
    bearerTokenName?: string | null;

    /**
     * Default request timeout in milliseconds.
     * Uses `AbortSignal.timeout()` to automatically abort requests that take too long.
     * Can be overridden per-request by passing a `signal` in `RequestInit`.
     *
     * @example
     * configure({ baseUrl: '/api', timeout: 10000 }); // 10 second timeout
     */
    timeout?: number;
}

/**
 * Response for request methods.
 */
export interface HttpResponse {
    /**
     * Http status code.
     */
    statusCode: number;

    /**
     * Reason to why the status code was used.
     */
    statusReason: string;

    /**
     * True if this is a 2xx response.
     */
    success: boolean;

    /**
     * Content type of response body.
     */
    contentType: string | null;

    /**
     * Body returned.
     *
     * Body has been read and deserialized from json (if the request content type was 'application/json' which is the default).
     */
    body: unknown;

    /**
     * Charset used in body.
     */
    charset: string | null;

    /**
     * Cast body to a type.
     */
    as<T>(): T;
}

/**
 * Error thrown when a request fails.
 */
export class HttpError extends Error {
    message: string;
    response: HttpResponse;

    constructor(response: HttpResponse) {
        super(response.statusReason);
        this.message = response.statusReason;
        this.response = response;
    }
}

/**
 * HTTP request options.
 */
export interface RequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    mode?: 'cors' | 'no-cors' | '*cors' | 'same-origin';
    cache:
        | 'default'
        | 'no-store'
        | 'reload'
        | 'no-cache'
        | 'force-cache'
        | 'only-if-cached';
    credentials: 'omit' | 'same-origin' | 'include';
    headers: Map<string, string>;
    redirect: 'follow' | 'manual' | '*follow' | 'error';
    referrerPolicy:
        | 'no-referrer'
        | '*no-referrer-when-downgrade'
        | 'origin'
        | 'origin-when-cross-origin'
        | 'same-origin'
        | 'strict-origin'
        | 'strict-origin-when-cross-origin'
        | 'unsafe-url';

    /**
     * Will be serialized if the content type is json (and the body is an object).
     */
    body: unknown;
}

/** @internal */
declare type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

let config: HttpOptions = {
    bearerTokenName: 'jwt'
};

let fetchImpl: FetchFn = fetch;

/**
 * Replace the fetch implementation for testing purposes.
 *
 * @param fn - Custom fetch function, or undefined to restore the default.
 *
 * @example
 * setFetch(async (url, options) => {
 *     return new Response(JSON.stringify({ id: 1 }), { status: 200 });
 * });
 */
export function setFetch(fn?: FetchFn): void {
    fetchImpl = fn ?? fetch;
}

/**
 * Configure the http module.
 *
 * @example
 * configure({ baseUrl: '/api/v1', bearerTokenName: 'auth_token' });
 */
export function configure(options: HttpOptions): void {
    config = {
        ...config,
        ...options
    };
    if (options.bearerTokenName === undefined) {
        config.bearerTokenName = 'jwt';
    }
}

/**
 * Make an HTTP request.
 *
 * @param url - URL to make the request against.
 * @param options - Request options.
 * @returns Response from server.
 *
 * @example
 * const response = await request('/users', { method: 'GET' });
 */
export async function request(url: string, options?: RequestInit): Promise<HttpResponse> {
    if (config.bearerTokenName) {
        const token = localStorage.getItem(config.bearerTokenName);
        if (token && options) {
            const headers = options?.headers
                ? new Headers(options.headers)
                : new Headers();

            if (!headers.get('Authorization')) {
                headers.set('Authorization', 'Bearer ' + token);
            }

            options.headers = headers;
        }
    }

    if (config.timeout && !options?.signal) {
        options ??= {};
        options.signal = AbortSignal.timeout(config.timeout);
    }

    if (config.baseUrl) {
        if (url[0] !== '/' && config.baseUrl[config.baseUrl.length - 1] !== '/') {
            url = `${config.baseUrl}/${url}`;
        } else {
            url = config.baseUrl + url;
        }
    }

    const response = await fetchImpl(url, options);

    if (!response.ok) {
        return {
            statusCode: response.status,
            statusReason: response.statusText,
            success: false,
            contentType: response.headers.get('content-type'),
            body: await response.text(),
            charset: response.headers.get('charset'),

            as() {
                throw new Error('No response received');
            }
        };
    }

    let body: unknown | null = null;
    if (response.status !== 204) {
        body = await response.json();
    }

    return {
        success: true,
        statusCode: response.status,
        statusReason: response.statusText,
        contentType: response.headers.get('content-type'),
        body: body,
        charset: response.headers.get('charset'),
        as<T>() {
            return <T>body;
        }
    };
}

/**
 * GET a resource.
 *
 * @param url - URL to get resource from.
 * @param queryString - Optional query string parameters.
 * @param options - Request options.
 * @returns HTTP response.
 *
 * @example
 * const response = await get('/users', { page: '1', limit: '10' });
 * const users = response.as<User[]>();
 */
export async function get(
    url: string,
    queryString?: Record<string, string>,
    options?: RequestInit
): Promise<HttpResponse> {
    if (!options) {
        options = {
            method: 'GET',
            headers: {
                'content-type': config.contentType ?? 'application/json'
            }
        };
    } else {
        options.method = 'GET';
    }

    if (queryString) {
        let prefix = '&';
        if (url.indexOf('?') === -1) {
            prefix = '?';
        }

        for (const key in queryString) {
            const value = queryString[key];
            url += `${prefix}${key}=${value}`;
            prefix = '&';
        }
    }

    return request(url, options);
}

/**
 * POST a resource.
 *
 * @param url - URL to post to.
 * @param data - Data to post.
 * @param options - Request options.
 * @returns HTTP response.
 *
 * @example
 * const response = await post('/users', JSON.stringify({ name: 'John' }));
 */
export async function post(
    url: string,
    data: BodyInit,
    options?: RequestInit
): Promise<HttpResponse> {
    if (!options) {
        options = {
            method: 'POST',
            body: data,
            headers: {
                'content-type': config.contentType ?? 'application/json'
            }
        };
    } else {
        options.method = 'POST';
        options.body = data;
    }

    return request(url, options);
}

/**
 * PUT a resource.
 *
 * @param url - URL to resource.
 * @param data - Data to put.
 * @param options - Request options.
 * @returns HTTP response.
 *
 * @example
 * const response = await put('/users/1', JSON.stringify({ name: 'Jane' }));
 */
export async function put(
    url: string,
    data: BodyInit,
    options?: RequestInit
): Promise<HttpResponse> {
    if (!options) {
        options = {
            method: 'PUT',
            body: data,
            headers: {
                'content-type': config.contentType ?? 'application/json'
            }
        };
    } else {
        options.method = 'PUT';
        options.body = data;
    }

    return request(url, options);
}

/**
 * DELETE a resource.
 *
 * @param url - URL to resource.
 * @param options - Request options.
 * @returns HTTP response.
 *
 * @example
 * const response = await del('/users/1');
 */
export async function del(url: string, options?: RequestInit): Promise<HttpResponse> {
    if (!options) {
        options = {
            method: 'DELETE',
            headers: {
                'content-type': config.contentType ?? 'application/json'
            }
        };
    } else {
        options.method = 'DELETE';
    }

    return request(url, options);
}
