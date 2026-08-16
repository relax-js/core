/**
 * @module ServerSentEvents
 * SSE client that dispatches received events as DOM events.
 *
 * By default it uses the browser's built-in EventSource, which reconnects on its own.
 * Set a request option like `method`, `body`, `headers` or `signal`, or `autoReconnect: false`,
 * and it switches to a fetch based transport that can send data to the server and can tell you
 * why the stream ended.
 *
 * @example
 * const sse = new SSEClient('/api/events', {
 *     eventTypes: ['user-updated', 'order-created']
 * });
 * sse.connect();
 *
 * document.addEventListener('user-updated', (e: SSEDataEvent) => {
 *     console.log('User updated:', e.data);
 * });
 */

import { reportError } from '../errors';
import { HttpError, HttpResponse, bearerToken, currentFetch, resolveUrl } from './http';
import { SseFrameParser } from './SseFrameParser';

/**
 * Event dispatched when an SSE message is received.
 * The event name matches the SSE event type.
 */
export class SSEDataEvent extends Event {
    constructor(
        eventName: string,
        public data: unknown,
        eventInit?: EventInit
    ) {
        super(eventName, { bubbles: true, ...eventInit });
    }
}

/**
 * Factory function for creating custom event instances.
 *
 * @example
 * const factory: SSEEventFactory = (eventName, data) => {
 *     switch (eventName) {
 *         case 'user-updated':
 *             return new UserUpdatedEvent(data as User);
 *         default:
 *             return new SSEDataEvent(eventName, data);
 *     }
 * };
 */
export type SSEEventFactory = (eventName: string, data: unknown) => Event;

/**
 * Why a stream stopped.
 *
 * `completed` = the server sent one of your `terminalEvents` and then closed.
 * `truncated` = the server closed cleanly but never sent a terminal event, so the result is
 * incomplete and you may want to offer a retry.
 * `aborted` = you stopped it yourself, through `disconnect()` or an `AbortSignal`.
 * `failed` = the request never started or died. `error` and `response` say why.
 */
export type SSECloseReason = 'completed' | 'truncated' | 'aborted' | 'failed';

/**
 * Details about a stream that has stopped.
 */
export interface SSECloseResult {
    /**
     * Why the stream stopped.
     */
    reason: SSECloseReason;

    /**
     * Name of the last event received before the stream stopped.
     */
    lastEventName?: string;

    /**
     * Set when the reason is `failed`.
     */
    error?: Error;

    /**
     * Set when the server answered with a non 2xx status. `body` holds the raw response text.
     */
    response?: HttpResponse;
}

/**
 * Passed to `onError` when the fetch transport fails.
 *
 * It extends Event so that the `onError` signature is the same for both transports.
 */
export class SSEErrorEvent extends Event {
    constructor(
        public error: Error,
        public response?: HttpResponse
    ) {
        super('error');
    }
}

/**
 * Configuration options for SSEClient.
 */
export interface SSEOptions {
    /**
     * Target element or CSS selector for event dispatching.
     * Defaults to document.
     */
    target?: string | Element;

    /**
     * Whether to send credentials with the request (default: false).
     */
    withCredentials?: boolean;

    /**
     * Specific SSE event types to listen for.
     * If not specified, listens to the default 'message' event.
     *
     * @example
     * eventTypes: ['user-updated', 'order-created']
     */
    eventTypes?: string[];

    /**
     * Factory function for creating custom event instances.
     * If not provided, SSEDataEvent is used.
     *
     * @example
     * eventFactory: (name, data) => new MyCustomEvent(name, data)
     */
    eventFactory?: SSEEventFactory;

    /**
     * HTTP method for the request (default: 'GET').
     * Setting it selects the fetch transport.
     */
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';

    /**
     * Data to send to the server.
     * Setting it selects the fetch transport, since EventSource cannot send a body.
     *
     * @example
     * body: JSON.stringify({ matchId: 42 })
     */
    body?: BodyInit;

    /**
     * Extra request headers.
     * Setting them selects the fetch transport, since EventSource cannot send headers.
     */
    headers?: Record<string, string>;

    /**
     * Signal used to cancel the stream. Closes with reason `aborted`.
     * Setting it selects the fetch transport.
     */
    signal?: AbortSignal;

    /**
     * Whether the browser should reconnect when the stream drops (default: true).
     *
     * Set to false to select the fetch transport, which never reconnects. A request that sends
     * data is not always safe to repeat, so reconnection is not available there.
     */
    autoReconnect?: boolean;

    /**
     * Names of the events the server sends last. Receiving one of them means the result is
     * complete, so the stream closes with reason `completed` instead of `truncated`.
     *
     * @example
     * terminalEvents: ['verdict']
     */
    terminalEvents?: string[];

    /**
     * Callback when the stream stops, for any reason. Called once per `connect()`.
     *
     * On the EventSource transport it is only called for `disconnect()`, because EventSource
     * cannot tell a finished server from a broken one.
     */
    onClose?: (client: SSEClient, result: SSECloseResult) => void;

    /**
     * Callback when connection is established.
     */
    onConnect?: (client: SSEClient) => void;

    /**
     * Callback when an error occurs.
     * On the EventSource transport the browser reconnects afterwards.
     * On the fetch transport the argument is an SSEErrorEvent and there is no reconnect.
     */
    onError?: (client: SSEClient, error: Event) => void;
}

/**
 * Server-Sent Events client that dispatches received events as DOM events.
 *
 * @example
 * const sse = new SSEClient('/api/events', {
 *     target: '#notifications',
 *     eventTypes: ['notification', 'alert']
 * });
 *
 * sse.connect();
 *
 * document.querySelector('#notifications')
 *     .addEventListener('notification', (e: SSEDataEvent) => {
 *         showNotification(e.data);
 *     });
 *
 * sse.disconnect();
 *
 * @example
 * const sse = new SSEClient('/api/verdict', {
 *     method: 'POST',
 *     body: JSON.stringify({ matchId: 42 }),
 *     eventTypes: ['token', 'verdict'],
 *     terminalEvents: ['verdict'],
 *     onClose: (client, result) => {
 *         if (result.reason === 'truncated') {
 *             showRetryButton();
 *         }
 *     }
 * });
 *
 * sse.connect();
 */
export class SSEClient {
    private eventSource?: EventSource;
    private abortController?: AbortController;
    private streaming = false;
    private target: Element | Document;

    /**
     * Whether the client is currently connected.
     */
    get connected(): boolean {
        if (this.eventSource) {
            return this.eventSource.readyState === EventSource.OPEN;
        }

        return this.streaming;
    }

    constructor(
        private url: string,
        private options?: SSEOptions
    ) {
        this.target = this.resolveTarget(options?.target);
    }

    /**
     * Establish connection to the SSE endpoint.
     *
     * Can be called again after the stream has closed, which is how you retry a truncated result.
     */
    connect(): void {
        if (this.eventSource || this.abortController) {
            return;
        }

        if (!this.usesFetchTransport()) {
            this.connectViaEventSource();
            return;
        }

        if (this.options?.autoReconnect === true) {
            const error = reportError(
                'SSEClient: autoReconnect is not available when you set method, body, headers or signal, because a request that sends data is not always safe to repeat.',
                { url: this.url }
            );
            if (error) {
                throw error;
            }
        }

        this.connectViaFetch();
    }

    /**
     * Close the connection. Closes with reason `aborted`.
     */
    disconnect(): void {
        if (this.abortController) {
            this.abortController.abort();
            return;
        }

        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = undefined;
            this.options?.onClose?.(this, { reason: 'aborted' });
        }
    }

    private usesFetchTransport(): boolean {
        const options = this.options;
        if (!options) {
            return false;
        }

        return (
            options.method !== undefined ||
            options.body !== undefined ||
            options.headers !== undefined ||
            options.signal !== undefined ||
            options.autoReconnect === false
        );
    }

    private connectViaEventSource(): void {
        const eventSource = new EventSource(this.url, {
            withCredentials: this.options?.withCredentials ?? false
        });

        this.eventSource = eventSource;

        eventSource.onopen = () => {
            this.options?.onConnect?.(this);
        };

        eventSource.onerror = (error) => {
            this.options?.onError?.(this, error);
        };

        if (this.options?.eventTypes && this.options.eventTypes.length > 0) {
            for (const eventType of this.options.eventTypes) {
                eventSource.addEventListener(eventType, (e: MessageEvent) => {
                    this.dispatchEvent(eventType, e.data);
                });
            }
        } else {
            eventSource.onmessage = (e: MessageEvent) => {
                this.dispatchEvent('message', e.data);
            };
        }
    }

    private connectViaFetch(): void {
        const controller = new AbortController();
        this.abortController = controller;

        this.streamResponse(controller).catch((error) => {
            this.streaming = false;
            this.abortController = undefined;
            reportError('SSEClient: unhandled failure while reading the event stream.', {
                url: this.url,
                error
            });
        });
    }

    private async streamResponse(controller: AbortController): Promise<void> {
        const options = this.options ?? {};
        this.bridgeSignal(options.signal, controller);

        let response: Response;
        try {
            response = await currentFetch()(resolveUrl(this.url), {
                method: options.method ?? 'GET',
                body: options.body,
                headers: this.buildHeaders(options.headers),
                signal: controller.signal,
                credentials: options.withCredentials ? 'include' : 'same-origin'
            });
        } catch (error) {
            this.reportFailure(error, controller);
            return;
        }

        if (!response.ok) {
            const httpResponse = await this.readErrorResponse(response);
            const error = new HttpError(httpResponse);
            options.onError?.(this, new SSEErrorEvent(error, httpResponse));
            this.finish({ reason: 'failed', error, response: httpResponse });
            return;
        }

        this.streaming = true;
        options.onConnect?.(this);

        let lastEventName: string | undefined;
        let sawTerminalEvent = false;

        try {
            const parser = new SseFrameParser();
            const decoder = new TextDecoder();
            const reader = response.body?.getReader();

            while (reader) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }

                for (const frame of parser.push(decoder.decode(value, { stream: true }))) {
                    lastEventName = frame.event;

                    if (options.terminalEvents?.includes(frame.event)) {
                        sawTerminalEvent = true;
                    }

                    if (this.acceptsEvent(frame.event)) {
                        this.dispatchEvent(frame.event, frame.data);
                    }
                }
            }
        } catch (error) {
            this.reportFailure(error, controller, lastEventName);
            return;
        }

        if (controller.signal.aborted) {
            this.finish({ reason: 'aborted', lastEventName });
            return;
        }

        const expectsTerminalEvent = (options.terminalEvents?.length ?? 0) > 0;
        this.finish({
            reason: expectsTerminalEvent && !sawTerminalEvent ? 'truncated' : 'completed',
            lastEventName
        });
    }

    private bridgeSignal(signal: AbortSignal | undefined, controller: AbortController): void {
        if (!signal) {
            return;
        }

        if (signal.aborted) {
            controller.abort();
            return;
        }

        signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    private buildHeaders(custom?: Record<string, string>): Headers {
        const headers = new Headers({ Accept: 'text/event-stream' });

        for (const name in custom) {
            headers.set(name, custom[name]);
        }

        const token = bearerToken();
        if (token && !headers.get('Authorization')) {
            headers.set('Authorization', 'Bearer ' + token);
        }

        return headers;
    }

    private async readErrorResponse(response: Response): Promise<HttpResponse> {
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

    private reportFailure(
        error: unknown,
        controller: AbortController,
        lastEventName?: string
    ): void {
        if (controller.signal.aborted) {
            this.finish({ reason: 'aborted', lastEventName });
            return;
        }

        const failure = error instanceof Error ? error : new Error(String(error));
        this.options?.onError?.(this, new SSEErrorEvent(failure));
        this.finish({ reason: 'failed', error: failure, lastEventName });
    }

    private finish(result: SSECloseResult): void {
        this.streaming = false;
        this.abortController = undefined;
        this.options?.onClose?.(this, result);
    }

    private acceptsEvent(eventName: string): boolean {
        const eventTypes = this.options?.eventTypes;
        if (eventTypes && eventTypes.length > 0) {
            return eventTypes.includes(eventName);
        }

        return eventName === 'message';
    }

    private resolveTarget(target?: string | Element): Element | Document {
        if (!target) {
            return document;
        }
        if (typeof target === 'string') {
            const element = document.querySelector(target);
            if (!element) {
                throw new Error(`SSEClient: Target element not found: ${target}`);
            }
            return element;
        }
        return target;
    }

    private dispatchEvent(eventName: string, rawData: string): void {
        let data: unknown;

        if (rawData.length > 0 && (rawData[0] === '{' || rawData[0] === '[' || rawData[0] === '"')) {
            try {
                data = JSON.parse(rawData);
            } catch {
                data = rawData;
            }
        } else {
            data = rawData;
        }

        const event = this.options?.eventFactory
            ? this.options.eventFactory(eventName, data)
            : new SSEDataEvent(eventName, data);

        this.target.dispatchEvent(event);
    }
}
