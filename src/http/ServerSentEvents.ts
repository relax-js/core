/**
 * @module ServerSentEvents
 * SSE client that dispatches received events as DOM events.
 * Uses the browser's built-in EventSource reconnection.
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
     * Callback when connection is established.
     */
    onConnect?: (client: SSEClient) => void;

    /**
     * Callback when an error occurs.
     * Note: EventSource automatically reconnects on errors.
     */
    onError?: (client: SSEClient, error: Event) => void;
}

/**
 * Server-Sent Events client that dispatches received events as DOM events.
 * Uses the browser's built-in EventSource with automatic reconnection.
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
 */
export class SSEClient {
    private eventSource?: EventSource;
    private target: Element | Document;

    /**
     * Whether the client is currently connected.
     */
    get connected(): boolean {
        return this.eventSource?.readyState === EventSource.OPEN;
    }

    constructor(
        private url: string,
        private options?: SSEOptions
    ) {
        this.target = this.resolveTarget(options?.target);
    }

    /**
     * Establish connection to the SSE endpoint.
     */
    connect(): void {
        if (this.eventSource) {
            return;
        }

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

    /**
     * Close the connection.
     */
    disconnect(): void {
        this.eventSource?.close();
        this.eventSource = undefined;
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
