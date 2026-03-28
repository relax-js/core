import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    WebSocketClient,
    WebSocketAbstraction,
    SimpleDataEvent,
    WebSocketCodec,
} from '../../src/http/SimpleWebSocket';

class MockWebSocket implements WebSocketAbstraction {
    onopen: ((event: Event) => void) | null = null;
    onerror: ((event: ErrorEvent) => void) | null = null;
    onclose: ((event: CloseEvent) => void) | null = null;
    onmessage: ((event: SimpleDataEvent) => void) | null = null;

    sent: (string | ArrayBufferLike | Blob | ArrayBufferView)[] = [];
    closed = false;

    send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
        this.sent.push(data);
    }

    close(): void {
        this.closed = true;
        this.onclose?.(new CloseEvent('close'));
    }

    simulateOpen(): void {
        this.onopen?.(new Event('open'));
    }

    simulateMessage(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
        this.onmessage?.({ data });
    }

    simulateError(): void {
        this.onerror?.(new ErrorEvent('error'));
    }
}

describe('WebSocketClient', () => {
    let mockWs: MockWebSocket;
    let factory: () => WebSocketAbstraction;

    beforeEach(() => {
        mockWs = new MockWebSocket();
        factory = () => mockWs;
    });

    describe('connection', () => {
        it('should connect and set connected to true on open', () => {
            const client = new WebSocketClient<string>(factory);
            expect(client.connected).toBe(false);

            client.connect();
            mockWs.simulateOpen();

            expect(client.connected).toBe(true);
        });

        it('should disconnect and set connected to false', () => {
            const client = new WebSocketClient<string>(factory, { autoReconnect: false });
            client.connect();
            mockWs.simulateOpen();
            expect(client.connected).toBe(true);

            client.disconnect();

            expect(client.connected).toBe(false);
            expect(mockWs.closed).toBe(true);
        });

        it('should call onConnect callback when connected', () => {
            const onConnect = vi.fn();
            const client = new WebSocketClient<string>(factory, { onConnect });

            client.connect();
            mockWs.simulateOpen();

            expect(onConnect).toHaveBeenCalledWith(client);
        });

        it('should call onClose callback when disconnected', () => {
            const onClose = vi.fn();
            const client = new WebSocketClient<string>(factory, { onClose, autoReconnect: false });

            client.connect();
            mockWs.simulateOpen();
            client.disconnect();

            expect(onClose).toHaveBeenCalledWith(client);
        });
    });

    describe('sending messages', () => {
        it('should serialize and send JSON objects', () => {
            const client = new WebSocketClient<{ name: string }>(factory);
            client.connect();
            mockWs.simulateOpen();

            client.send({ name: 'test' });

            expect(mockWs.sent).toEqual(['{"name":"test"}']);
        });

        it('should send strings directly', () => {
            const client = new WebSocketClient<string>(factory);
            client.connect();
            mockWs.simulateOpen();

            client.send('hello');

            expect(mockWs.sent).toEqual(['hello']);
        });

        it('should queue messages when not connected', () => {
            const client = new WebSocketClient<string>(factory, { autoReconnect: false });

            client.send('message1');
            client.send('message2');

            expect(mockWs.sent).toEqual([]);
        });

        it('should send queued messages when connection opens', () => {
            const client = new WebSocketClient<string>(factory);

            client.send('message1');
            client.send('message2');
            client.connect();
            mockWs.simulateOpen();

            expect(mockWs.sent).toEqual(['message1', 'message2']);
        });

        it('should use codec for encoding when provided', () => {
            const codec: WebSocketCodec<{ value: number }> = {
                encode: (data) => `encoded:${data.value}`,
                decode: (data) => ({ value: parseInt(String(data).split(':')[1]) }),
            };
            const client = new WebSocketClient<{ value: number }>(factory, { codec });
            client.connect();
            mockWs.simulateOpen();

            client.send({ value: 42 });

            expect(mockWs.sent).toEqual(['encoded:42']);
        });
    });

    describe('receiving messages', () => {
        it('should receive and parse JSON messages', async () => {
            const client = new WebSocketClient<{ name: string }>(factory);
            client.connect();
            mockWs.simulateOpen();

            const receivePromise = client.receive();
            mockWs.simulateMessage('{"name":"test"}');

            const result = await receivePromise;
            expect(result).toEqual({ name: 'test' });
        });

        it('should receive string messages as-is', async () => {
            const client = new WebSocketClient<string>(factory);
            client.connect();
            mockWs.simulateOpen();

            const receivePromise = client.receive();
            mockWs.simulateMessage('hello');

            const result = await receivePromise;
            expect(result).toBe('hello');
        });

        it('should queue messages when no receive is pending', async () => {
            const client = new WebSocketClient<string>(factory);
            client.connect();
            mockWs.simulateOpen();

            mockWs.simulateMessage('message1');
            mockWs.simulateMessage('message2');

            expect(await client.receive()).toBe('message1');
            expect(await client.receive()).toBe('message2');
        });

        it('should throw when receive is called twice', () => {
            const client = new WebSocketClient<string>(factory);
            client.connect();
            mockWs.simulateOpen();

            client.receive();

            expect(() => client.receive()).toThrow('You can only invoke receive() once at a time.');
        });

        it('should reject pending receive when connection closes', async () => {
            const client = new WebSocketClient<string>(factory, { autoReconnect: false });
            client.connect();
            mockWs.simulateOpen();

            const receivePromise = client.receive();
            client.disconnect();

            await expect(receivePromise).rejects.toThrow('WebSocket connection closed');
        });

        it('should use codec for decoding when provided', async () => {
            const codec: WebSocketCodec<{ value: number }> = {
                encode: (data) => `encoded:${data.value}`,
                decode: (data) => ({ value: parseInt(String(data).split(':')[1]) }),
            };
            const client = new WebSocketClient<{ value: number }>(factory, { codec });
            client.connect();
            mockWs.simulateOpen();

            const receivePromise = client.receive();
            mockWs.simulateMessage('encoded:42');

            const result = await receivePromise;
            expect(result).toEqual({ value: 42 });
        });

        it('should parse JSON arrays', async () => {
            const client = new WebSocketClient<number[]>(factory);
            client.connect();
            mockWs.simulateOpen();

            const receivePromise = client.receive();
            mockWs.simulateMessage('[1,2,3]');

            const result = await receivePromise;
            expect(result).toEqual([1, 2, 3]);
        });

        it('should parse JSON strings', async () => {
            const client = new WebSocketClient<string>(factory);
            client.connect();
            mockWs.simulateOpen();

            const receivePromise = client.receive();
            mockWs.simulateMessage('"quoted string"');

            const result = await receivePromise;
            expect(result).toBe('quoted string');
        });
    });

    describe('auto-reconnect', () => {
        it('should reconnect by default when connection closes', async () => {
            vi.useFakeTimers();
            let connectionCount = 0;

            const client = new WebSocketClient<string>(() => {
                connectionCount++;
                mockWs = new MockWebSocket();
                return mockWs;
            });

            client.connect();
            mockWs.simulateOpen();
            mockWs.close();

            expect(connectionCount).toBe(1);

            await vi.advanceTimersByTimeAsync(1000);

            expect(connectionCount).toBe(2);

            vi.useRealTimers();
        });

        it('should not reconnect when autoReconnect is false', async () => {
            vi.useFakeTimers();
            let connectionCount = 0;

            const client = new WebSocketClient<string>(
                () => {
                    connectionCount++;
                    mockWs = new MockWebSocket();
                    return mockWs;
                },
                { autoReconnect: false }
            );

            client.connect();
            mockWs.simulateOpen();
            mockWs.close();

            await vi.advanceTimersByTimeAsync(5000);

            expect(connectionCount).toBe(1);

            vi.useRealTimers();
        });

        it('should not reconnect after disconnect() is called', async () => {
            vi.useFakeTimers();
            let connectionCount = 0;

            const client = new WebSocketClient<string>(() => {
                connectionCount++;
                mockWs = new MockWebSocket();
                return mockWs;
            });

            client.connect();
            mockWs.simulateOpen();
            client.disconnect();

            await vi.advanceTimersByTimeAsync(5000);

            expect(connectionCount).toBe(1);

            vi.useRealTimers();
        });

        it('should use exponential backoff for reconnect delays', async () => {
            vi.useFakeTimers();
            let connectionCount = 0;

            const client = new WebSocketClient<string>(
                () => {
                    connectionCount++;
                    mockWs = new MockWebSocket();
                    return mockWs;
                },
                { reconnectDelay: 100, maxReconnectDelay: 1000 }
            );

            client.connect();
            mockWs.simulateOpen();
            mockWs.close();

            await vi.advanceTimersByTimeAsync(100);
            expect(connectionCount).toBe(2);
            mockWs.close();

            await vi.advanceTimersByTimeAsync(100);
            expect(connectionCount).toBe(2);

            await vi.advanceTimersByTimeAsync(100);
            expect(connectionCount).toBe(3);
            mockWs.close();

            await vi.advanceTimersByTimeAsync(400);
            expect(connectionCount).toBe(4);

            vi.useRealTimers();
        });

        it('should respect maxReconnectDelay', async () => {
            vi.useFakeTimers();
            let connectionCount = 0;

            const client = new WebSocketClient<string>(
                () => {
                    connectionCount++;
                    mockWs = new MockWebSocket();
                    return mockWs;
                },
                { reconnectDelay: 100, maxReconnectDelay: 200 }
            );

            client.connect();

            for (let i = 0; i < 5; i++) {
                mockWs.simulateOpen();
                mockWs.close();
                await vi.advanceTimersByTimeAsync(200);
            }

            expect(connectionCount).toBe(6);

            vi.useRealTimers();
        });

        it('should reset reconnect attempts on successful connection', async () => {
            vi.useFakeTimers();
            let connectionCount = 0;

            const client = new WebSocketClient<string>(
                () => {
                    connectionCount++;
                    mockWs = new MockWebSocket();
                    return mockWs;
                },
                { reconnectDelay: 100 }
            );

            client.connect();
            mockWs.simulateOpen();
            mockWs.close();

            await vi.advanceTimersByTimeAsync(100);
            expect(connectionCount).toBe(2);
            mockWs.close();

            await vi.advanceTimersByTimeAsync(200);
            expect(connectionCount).toBe(3);

            mockWs.simulateOpen();
            mockWs.close();

            await vi.advanceTimersByTimeAsync(100);
            expect(connectionCount).toBe(4);

            vi.useRealTimers();
        });
    });

    describe('error handling', () => {
        it('should close on error', () => {
            const client = new WebSocketClient<string>(factory, { autoReconnect: false });
            client.connect();

            mockWs.simulateError();

            expect(mockWs.closed).toBe(true);
        });
    });
});
