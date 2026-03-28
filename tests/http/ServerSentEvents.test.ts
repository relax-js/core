import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SSEClient, SSEDataEvent } from '../../src/http/ServerSentEvents';

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
