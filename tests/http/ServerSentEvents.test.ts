import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SSEClient, SSEDataEvent, SSEErrorEvent } from '../../src/http/ServerSentEvents';
import { configure, setFetch, HttpError } from '../../src/http/http';

class MockEventSource {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSED = 2;

    onopen: ((event: Event) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;

    readyState = MockEventSource.CONNECTING;
    private eventListeners: Map<string, ((event: MessageEvent) => void)[]> = new Map();

    constructor(
        public url: string,
        public options?: { withCredentials?: boolean }
    ) {}

    addEventListener(type: string, listener: (event: MessageEvent) => void): void {
        if (!this.eventListeners.has(type)) {
            this.eventListeners.set(type, []);
        }
        this.eventListeners.get(type)!.push(listener);
    }

    close(): void {
        this.readyState = MockEventSource.CLOSED;
    }

    simulateOpen(): void {
        this.readyState = MockEventSource.OPEN;
        this.onopen?.(new Event('open'));
    }

    simulateMessage(data: string, eventType?: string): void {
        const event = new MessageEvent(eventType || 'message', { data });

        if (eventType) {
            const listeners = this.eventListeners.get(eventType);
            listeners?.forEach((listener) => listener(event));
        } else {
            this.onmessage?.(event);
        }
    }

    simulateError(): void {
        this.onerror?.(new Event('error'));
    }
}

describe('SSEClient', () => {
    let mockEventSource: MockEventSource;
    let originalEventSource: typeof EventSource;

    beforeEach(() => {
        originalEventSource = globalThis.EventSource;
        const MockEventSourceConstructor = vi.fn((url: string, options?: { withCredentials?: boolean }) => {
            mockEventSource = new MockEventSource(url, options);
            return mockEventSource;
        });
        MockEventSourceConstructor.CONNECTING = 0;
        MockEventSourceConstructor.OPEN = 1;
        MockEventSourceConstructor.CLOSED = 2;
        (globalThis as unknown as { EventSource: typeof MockEventSource }).EventSource = MockEventSourceConstructor as unknown as typeof EventSource;
    });

    afterEach(() => {
        (globalThis as unknown as { EventSource: typeof EventSource }).EventSource = originalEventSource;
    });

    describe('connection', () => {
        it('should connect and set connected to true on open', () => {
            const client = new SSEClient('/events');
            expect(client.connected).toBe(false);

            client.connect();
            mockEventSource.simulateOpen();

            expect(client.connected).toBe(true);
        });

        it('should disconnect and set connected to false', () => {
            const client = new SSEClient('/events');
            client.connect();
            mockEventSource.simulateOpen();
            expect(client.connected).toBe(true);

            client.disconnect();

            expect(client.connected).toBe(false);
        });

        it('should call onConnect callback when connected', () => {
            const onConnect = vi.fn();
            const client = new SSEClient('/events', { onConnect });

            client.connect();
            mockEventSource.simulateOpen();

            expect(onConnect).toHaveBeenCalledWith(client);
        });

        it('should call onError callback on error', () => {
            const onError = vi.fn();
            const client = new SSEClient('/events', { onError });

            client.connect();
            mockEventSource.simulateError();

            expect(onError).toHaveBeenCalled();
        });

        it('should pass withCredentials to EventSource', () => {
            const client = new SSEClient('/events', { withCredentials: true });
            client.connect();

            expect(mockEventSource.options?.withCredentials).toBe(true);
        });

        it('should not create multiple connections on repeated connect calls', () => {
            const client = new SSEClient('/events');
            client.connect();
            const firstEventSource = mockEventSource;

            client.connect();

            expect(mockEventSource).toBe(firstEventSource);
        });
    });

    describe('event dispatching', () => {
        it('should dispatch message events to document by default', () => {
            const client = new SSEClient('/events');
            const handler = vi.fn();
            document.addEventListener('message', handler);

            client.connect();
            mockEventSource.simulateOpen();
            mockEventSource.simulateMessage('test data');

            expect(handler).toHaveBeenCalled();
            const event = handler.mock.calls[0][0] as SSEDataEvent;
            expect(event.data).toBe('test data');

            document.removeEventListener('message', handler);
        });

        it('should dispatch events to specified target element', () => {
            const target = document.createElement('div');
            target.id = 'test-target';
            document.body.appendChild(target);

            const client = new SSEClient('/events', { target: '#test-target' });
            const handler = vi.fn();
            target.addEventListener('message', handler);

            client.connect();
            mockEventSource.simulateOpen();
            mockEventSource.simulateMessage('test data');

            expect(handler).toHaveBeenCalled();

            target.removeEventListener('message', handler);
            document.body.removeChild(target);
        });

        it('should dispatch events to element reference', () => {
            const target = document.createElement('div');
            const client = new SSEClient('/events', { target });
            const handler = vi.fn();
            target.addEventListener('message', handler);

            client.connect();
            mockEventSource.simulateOpen();
            mockEventSource.simulateMessage('test data');

            expect(handler).toHaveBeenCalled();

            target.removeEventListener('message', handler);
        });

        it('should throw if target selector not found', () => {
            expect(() => {
                new SSEClient('/events', { target: '#non-existent' });
            }).toThrow('SSEClient: Target element not found: #non-existent');
        });

        it('should parse JSON data automatically', () => {
            const client = new SSEClient('/events');
            const handler = vi.fn();
            document.addEventListener('message', handler);

            client.connect();
            mockEventSource.simulateOpen();
            mockEventSource.simulateMessage('{"name":"John","age":30}');

            const event = handler.mock.calls[0][0] as SSEDataEvent;
            expect(event.data).toEqual({ name: 'John', age: 30 });

            document.removeEventListener('message', handler);
        });

        it('should parse JSON arrays', () => {
            const client = new SSEClient('/events');
            const handler = vi.fn();
            document.addEventListener('message', handler);

            client.connect();
            mockEventSource.simulateOpen();
            mockEventSource.simulateMessage('[1,2,3]');

            const event = handler.mock.calls[0][0] as SSEDataEvent;
            expect(event.data).toEqual([1, 2, 3]);

            document.removeEventListener('message', handler);
        });

        it('should keep invalid JSON as string', () => {
            const client = new SSEClient('/events');
            const handler = vi.fn();
            document.addEventListener('message', handler);

            client.connect();
            mockEventSource.simulateOpen();
            mockEventSource.simulateMessage('{invalid json}');

            const event = handler.mock.calls[0][0] as SSEDataEvent;
            expect(event.data).toBe('{invalid json}');

            document.removeEventListener('message', handler);
        });
    });

    describe('event types', () => {
        it('should listen to specific event types when specified', () => {
            const client = new SSEClient('/events', {
                eventTypes: ['user-updated', 'order-created']
            });
            const userHandler = vi.fn();
            const orderHandler = vi.fn();
            document.addEventListener('user-updated', userHandler);
            document.addEventListener('order-created', orderHandler);

            client.connect();
            mockEventSource.simulateOpen();
            mockEventSource.simulateMessage('{"id":1}', 'user-updated');
            mockEventSource.simulateMessage('{"id":2}', 'order-created');

            expect(userHandler).toHaveBeenCalled();
            expect(orderHandler).toHaveBeenCalled();

            document.removeEventListener('user-updated', userHandler);
            document.removeEventListener('order-created', orderHandler);
        });

        it('should use event name from SSE as DOM event name', () => {
            const client = new SSEClient('/events', {
                eventTypes: ['custom-event']
            });
            const handler = vi.fn();
            document.addEventListener('custom-event', handler);

            client.connect();
            mockEventSource.simulateOpen();
            mockEventSource.simulateMessage('data', 'custom-event');

            expect(handler).toHaveBeenCalled();
            const event = handler.mock.calls[0][0];
            expect(event.type).toBe('custom-event');

            document.removeEventListener('custom-event', handler);
        });
    });

    describe('event factory', () => {
        it('should use custom event factory when provided', () => {
            class CustomEvent extends Event {
                constructor(public payload: unknown) {
                    super('custom', { bubbles: true });
                }
            }

            const factory = vi.fn((eventName: string, data: unknown) => {
                return new CustomEvent(data);
            });

            const client = new SSEClient('/events', { eventFactory: factory });
            const handler = vi.fn();
            document.addEventListener('custom', handler);

            client.connect();
            mockEventSource.simulateOpen();
            mockEventSource.simulateMessage('{"id":1}');

            expect(factory).toHaveBeenCalledWith('message', { id: 1 });
            expect(handler).toHaveBeenCalled();
            const event = handler.mock.calls[0][0] as CustomEvent;
            expect(event.payload).toEqual({ id: 1 });

            document.removeEventListener('custom', handler);
        });

        it('should pass event name to factory for named events', () => {
            const factory = vi.fn((eventName: string, data: unknown) => {
                return new SSEDataEvent(eventName, data);
            });

            const client = new SSEClient('/events', {
                eventTypes: ['user-updated'],
                eventFactory: factory
            });
            const handler = vi.fn();
            document.addEventListener('user-updated', handler);

            client.connect();
            mockEventSource.simulateOpen();
            mockEventSource.simulateMessage('{"id":1}', 'user-updated');

            expect(factory).toHaveBeenCalledWith('user-updated', { id: 1 });

            document.removeEventListener('user-updated', handler);
        });
    });
});

describe('SSEDataEvent', () => {
    it('should create event with correct name and data', () => {
        const event = new SSEDataEvent('test-event', { foo: 'bar' });

        expect(event.type).toBe('test-event');
        expect(event.data).toEqual({ foo: 'bar' });
        expect(event.bubbles).toBe(true);
    });

    it('should allow custom eventInit options', () => {
        const event = new SSEDataEvent('test-event', 'data', { cancelable: true });

        expect(event.cancelable).toBe(true);
    });
});

type ReadResult = { done: boolean; value?: Uint8Array };

/**
 * Stands in for the body of a streamed response so a test can decide exactly when each chunk
 * arrives, and so an aborted request fails the pending read the way a real body does.
 */
class FakeBodyStream {
    private waiting: Array<{
        resolve: (result: ReadResult) => void;
        reject: (error: unknown) => void;
    }> = [];
    private queued: Array<{ result?: ReadResult; error?: unknown }> = [];

    getReader() {
        return {
            read: (): Promise<ReadResult> => {
                const next = this.queued.shift();
                if (next) {
                    return next.error ? Promise.reject(next.error) : Promise.resolve(next.result!);
                }

                return new Promise<ReadResult>((resolve, reject) => {
                    this.waiting.push({ resolve, reject });
                });
            },
        };
    }

    bindSignal(signal: AbortSignal): void {
        signal.addEventListener(
            'abort',
            () => this.fail(new DOMException('The operation was aborted.', 'AbortError')),
            { once: true }
        );
    }

    push(text: string): void {
        this.deliver({ result: { done: false, value: new TextEncoder().encode(text) } });
    }

    end(): void {
        this.deliver({ result: { done: true } });
    }

    fail(error: unknown): void {
        this.deliver({ error });
    }

    private deliver(item: { result?: ReadResult; error?: unknown }): void {
        const pending = this.waiting.shift();
        if (!pending) {
            this.queued.push(item);
            return;
        }

        if (item.error) {
            pending.reject(item.error);
        } else {
            pending.resolve(item.result!);
        }
    }
}

function streamingResponse(stream: FakeBodyStream): Response {
    const headers = new Headers();
    headers.set('content-type', 'text/event-stream');

    return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers,
        body: stream,
        text: async () => '',
    } as unknown as Response;
}

function errorResponse(body: string, status: number, statusText: string): Response {
    const headers = new Headers();
    headers.set('content-type', 'application/json');

    return {
        ok: false,
        status,
        statusText,
        headers,
        body: null,
        text: async () => body,
    } as unknown as Response;
}

function respondWithStream(stream: FakeBodyStream) {
    return (_url: string, init?: RequestInit) => {
        if (init?.signal) {
            stream.bindSignal(init.signal);
        }
        return Promise.resolve(streamingResponse(stream));
    };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('SSEClient fetch transport', () => {
    let mockFetch: ReturnType<typeof vi.fn>;
    let eventSourceConstructor: ReturnType<typeof vi.fn>;
    let originalEventSource: typeof EventSource;
    let stream: FakeBodyStream;
    let storage: Record<string, string>;

    beforeEach(() => {
        mockFetch = vi.fn();
        setFetch(mockFetch as never);

        stream = new FakeBodyStream();
        mockFetch.mockImplementation(respondWithStream(stream));

        originalEventSource = globalThis.EventSource;
        eventSourceConstructor = vi.fn(() => ({
            close: () => {},
            addEventListener: () => {},
        }));
        (globalThis as unknown as { EventSource: unknown }).EventSource = eventSourceConstructor;

        storage = {};
        vi.stubGlobal('localStorage', {
            getItem: (key: string) => storage[key] ?? null,
            setItem: (key: string, value: string) => {
                storage[key] = value;
            },
            removeItem: (key: string) => {
                delete storage[key];
            },
        });

        configure({ baseUrl: undefined, bearerTokenName: 'jwt' });
    });

    afterEach(() => {
        setFetch();
        (globalThis as unknown as { EventSource: typeof EventSource }).EventSource =
            originalEventSource;
        vi.unstubAllGlobals();
        configure({ baseUrl: undefined, bearerTokenName: 'jwt' });
    });

    describe('choosing a transport', () => {
        it('eventSource_is_used_when_no_fetch_only_option_is_set', () => {
            new SSEClient('/api/events', { eventTypes: ['notification'] }).connect();

            expect(eventSourceConstructor).toHaveBeenCalled();
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('fetch_transport_is_used_when_a_body_is_supplied', async () => {
            new SSEClient('/api/verdict', { method: 'POST', body: '{}' }).connect();
            await flush();

            expect(mockFetch).toHaveBeenCalled();
            expect(eventSourceConstructor).not.toHaveBeenCalled();
        });

        it('fetch_transport_is_used_when_auto_reconnect_is_disabled', async () => {
            new SSEClient('/api/events', { autoReconnect: false }).connect();
            await flush();

            expect(mockFetch).toHaveBeenCalled();
            expect(eventSourceConstructor).not.toHaveBeenCalled();
        });

        it('explicit_auto_reconnect_with_a_body_is_reported_as_a_misconfiguration', () => {
            const client = new SSEClient('/api/verdict', {
                method: 'POST',
                body: '{}',
                autoReconnect: true,
            });

            expect(() => client.connect()).toThrow(/autoReconnect/);
            expect(mockFetch).not.toHaveBeenCalled();
        });
    });

    describe('the request', () => {
        it('post_body_and_headers_reach_the_server', async () => {
            new SSEClient('/api/verdict', {
                method: 'POST',
                body: JSON.stringify({ matchId: 42 }),
                headers: { 'content-type': 'application/json' },
            }).connect();
            await flush();

            const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
            const headers = init.headers as Headers;

            expect(url).toBe('/api/verdict');
            expect(init.method).toBe('POST');
            expect(init.body).toBe('{"matchId":42}');
            expect(headers.get('content-type')).toBe('application/json');
            expect(headers.get('accept')).toBe('text/event-stream');
        });

        it('base_url_and_bearer_token_are_applied_on_the_fetch_transport', async () => {
            configure({ baseUrl: '/api' });
            storage['jwt'] = 'token123';

            new SSEClient('/verdict', { autoReconnect: false }).connect();
            await flush();

            const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];

            expect(url).toBe('/api/verdict');
            expect((init.headers as Headers).get('authorization')).toBe('Bearer token123');
        });

        it('onConnect_fires_once_the_server_accepted_the_request', async () => {
            const onConnect = vi.fn();
            const client = new SSEClient('/api/events', { autoReconnect: false, onConnect });

            client.connect();
            expect(client.connected).toBe(false);

            await flush();

            expect(onConnect).toHaveBeenCalledWith(client);
            expect(client.connected).toBe(true);
        });
    });

    describe('receiving events', () => {
        it('events_arriving_in_pieces_are_dispatched_as_dom_events', async () => {
            const handler = vi.fn();
            document.addEventListener('token', handler);

            new SSEClient('/api/verdict', {
                autoReconnect: false,
                eventTypes: ['token'],
            }).connect();
            await flush();

            stream.push('event: token\ndata: {"tex');
            stream.push('t":"hi"}\n\n');
            await flush();

            expect(handler).toHaveBeenCalledTimes(1);
            expect((handler.mock.calls[0][0] as SSEDataEvent).data).toEqual({ text: 'hi' });

            document.removeEventListener('token', handler);
        });

        it('event_types_filtering_matches_the_event_source_transport', async () => {
            const wanted = vi.fn();
            const unwanted = vi.fn();
            document.addEventListener('wanted', wanted);
            document.addEventListener('unwanted', unwanted);

            new SSEClient('/api/events', {
                autoReconnect: false,
                eventTypes: ['wanted'],
            }).connect();
            await flush();

            stream.push('event: wanted\ndata: a\n\nevent: unwanted\ndata: b\n\n');
            await flush();

            expect(wanted).toHaveBeenCalledTimes(1);
            expect(unwanted).not.toHaveBeenCalled();

            document.removeEventListener('wanted', wanted);
            document.removeEventListener('unwanted', unwanted);
        });

        it('without_event_types_only_the_message_event_is_dispatched', async () => {
            const message = vi.fn();
            const named = vi.fn();
            document.addEventListener('message', message);
            document.addEventListener('named', named);

            new SSEClient('/api/events', { autoReconnect: false }).connect();
            await flush();

            stream.push('data: plain\n\nevent: named\ndata: b\n\n');
            await flush();

            expect(message).toHaveBeenCalledTimes(1);
            expect(named).not.toHaveBeenCalled();

            document.removeEventListener('message', message);
            document.removeEventListener('named', named);
        });
    });

    describe('why the stream ended', () => {
        it('stream_ending_after_a_terminal_event_closes_as_completed', async () => {
            const onClose = vi.fn();

            new SSEClient('/api/verdict', {
                autoReconnect: false,
                eventTypes: ['token', 'verdict'],
                terminalEvents: ['verdict'],
                onClose,
            }).connect();
            await flush();

            stream.push('event: token\ndata: hi\n\n');
            stream.push('event: verdict\ndata: {"ok":true}\n\n');
            stream.end();
            await flush();

            expect(onClose).toHaveBeenCalledTimes(1);
            expect(onClose.mock.calls[0][1]).toMatchObject({
                reason: 'completed',
                lastEventName: 'verdict',
            });
        });

        it('stream_ending_without_a_terminal_event_closes_as_truncated', async () => {
            const onClose = vi.fn();

            new SSEClient('/api/verdict', {
                autoReconnect: false,
                eventTypes: ['token', 'verdict'],
                terminalEvents: ['verdict'],
                onClose,
            }).connect();
            await flush();

            stream.push('event: token\ndata: hi\n\n');
            stream.end();
            await flush();

            expect(onClose.mock.calls[0][1]).toMatchObject({
                reason: 'truncated',
                lastEventName: 'token',
            });
        });

        it('clean_end_closes_as_completed_when_no_terminal_events_are_configured', async () => {
            const onClose = vi.fn();

            new SSEClient('/api/events', { autoReconnect: false, onClose }).connect();
            await flush();

            stream.push('data: hi\n\n');
            stream.end();
            await flush();

            expect(onClose.mock.calls[0][1].reason).toBe('completed');
        });

        it('terminal_event_ends_the_stream_even_when_it_is_not_listened_for', async () => {
            const onClose = vi.fn();

            new SSEClient('/api/verdict', {
                autoReconnect: false,
                eventTypes: ['token'],
                terminalEvents: ['verdict'],
                onClose,
            }).connect();
            await flush();

            stream.push('event: token\ndata: hi\n\nevent: verdict\ndata: done\n\n');
            stream.end();
            await flush();

            expect(onClose.mock.calls[0][1].reason).toBe('completed');
        });

        it('disconnect_closes_as_aborted', async () => {
            const onClose = vi.fn();
            const client = new SSEClient('/api/events', { autoReconnect: false, onClose });

            client.connect();
            await flush();

            client.disconnect();
            await flush();

            expect(onClose).toHaveBeenCalledTimes(1);
            expect(onClose.mock.calls[0][1].reason).toBe('aborted');
            expect(client.connected).toBe(false);
        });

        it('an_aborted_signal_closes_as_aborted', async () => {
            const onClose = vi.fn();
            const controller = new AbortController();

            new SSEClient('/api/events', { signal: controller.signal, onClose }).connect();
            await flush();

            controller.abort();
            await flush();

            expect(onClose.mock.calls[0][1].reason).toBe('aborted');
        });

        it('network_failure_closes_as_failed', async () => {
            const onClose = vi.fn();
            const onError = vi.fn();
            mockFetch.mockRejectedValue(new Error('offline'));

            new SSEClient('/api/events', { autoReconnect: false, onClose, onError }).connect();
            await flush();

            expect(onError).toHaveBeenCalledTimes(1);
            expect(onError.mock.calls[0][1]).toBeInstanceOf(SSEErrorEvent);
            expect(onClose.mock.calls[0][1]).toMatchObject({ reason: 'failed' });
            expect(onClose.mock.calls[0][1].error.message).toBe('offline');
        });

        it('client_can_connect_again_after_the_stream_closed', async () => {
            const client = new SSEClient('/api/events', { autoReconnect: false });

            client.connect();
            await flush();
            stream.end();
            await flush();

            stream = new FakeBodyStream();
            mockFetch.mockImplementation(respondWithStream(stream));

            client.connect();
            await flush();

            expect(mockFetch).toHaveBeenCalledTimes(2);
            expect(client.connected).toBe(true);
        });

        it('disconnect_on_the_event_source_transport_closes_as_aborted', () => {
            const onClose = vi.fn();
            const client = new SSEClient('/api/events', { onClose });

            client.connect();
            client.disconnect();

            expect(onClose).toHaveBeenCalledTimes(1);
            expect(onClose.mock.calls[0][1].reason).toBe('aborted');
        });
    });

    describe('a server that refuses the request', () => {
        it('non_2xx_response_reports_the_error_body_as_raw_text', async () => {
            const onClose = vi.fn();
            const onError = vi.fn();
            mockFetch.mockResolvedValue(
                errorResponse('{"message":"Not enabled here."}', 503, 'Service Unavailable')
            );

            new SSEClient('/api/verdict', {
                method: 'POST',
                body: '{}',
                onClose,
                onError,
            }).connect();
            await flush();

            const errorEvent = onError.mock.calls[0][1] as SSEErrorEvent;
            expect(errorEvent).toBeInstanceOf(SSEErrorEvent);
            expect(errorEvent.error).toBeInstanceOf(HttpError);
            expect(errorEvent.response!.statusCode).toBe(503);
            expect(errorEvent.response!.body).toBe('{"message":"Not enabled here."}');

            const result = onClose.mock.calls[0][1];
            expect(result.reason).toBe('failed');
            expect(result.response.body).toBe('{"message":"Not enabled here."}');
            expect(() => result.response.as()).toThrow();
        });

        it('documented_testing_recipe_drives_a_real_readable_stream', async () => {
            const encoder = new TextEncoder();
            const body = new ReadableStream({
                start(controller) {
                    controller.enqueue(encoder.encode('event: verdict\ndata: {"ok":true}\n\n'));
                    controller.close();
                },
            });
            mockFetch.mockResolvedValue(
                new Response(body, {
                    status: 200,
                    headers: { 'content-type': 'text/event-stream' },
                })
            );

            const received: unknown[] = [];
            const handler = (e: Event) => received.push((e as SSEDataEvent).data);
            document.addEventListener('verdict', handler);

            const onClose = vi.fn();
            new SSEClient('/api/verdict', {
                method: 'POST',
                body: '{}',
                eventTypes: ['verdict'],
                terminalEvents: ['verdict'],
                onClose,
            }).connect();
            await flush();

            expect(received).toEqual([{ ok: true }]);
            expect(onClose.mock.calls[0][1].reason).toBe('completed');

            document.removeEventListener('verdict', handler);
        });

        it('a_refused_request_never_reconnects', async () => {
            mockFetch.mockResolvedValue(errorResponse('nope', 500, 'Server Error'));

            new SSEClient('/api/events', { autoReconnect: false }).connect();
            await flush();
            await flush();

            expect(mockFetch).toHaveBeenCalledTimes(1);
        });
    });
});
