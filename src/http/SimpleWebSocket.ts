/**
 * @module SimpleWebSocket
 * WebSocket client with automatic reconnection and message queuing.
 * Provides a reliable messaging layer over WebSocket connections.
 *
 * @example
 * // Create and connect
 * const ws = new WebSocketClient<ChatMessage>('wss://chat.example.com');
 * ws.connect();
 *
 * // Send and receive
 * await ws.send({ text: 'Hello' });
 * const msg = await ws.receive();
 */

import { LinkedList } from '../collections/LinkedList';

/**
 * Simplified message event for WebSocket data.
 */
export interface SimpleDataEvent {
    data: string | ArrayBufferLike | Blob | ArrayBufferView;
}

/**
 * Abstraction interface for WebSocket to enable unit testing.
 * Implement this for custom WebSocket instances or mocks.
 */
export interface WebSocketAbstraction {
    onopen: ((event: Event) => void) | null;
    onerror: ((event: ErrorEvent) => void) | null;
    onclose: ((event: CloseEvent) => void) | null;
    onmessage: ((event: SimpleDataEvent) => void) | null;
    send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void;
    close(): void;
}

/**
 * Factory function type for creating WebSocket instances.
 */
export type WebSocketFactory = () => WebSocketAbstraction;

/**
 * Managed WebSocket client with automatic reconnection and message queuing.
 *
 * Features:
 * - Automatic reconnection on disconnect
 * - Message queuing when disconnected
 * - Type-safe message handling with optional codecs
 * - Promise-based receive API
 *
 * @template TMessage - The type of messages sent and received
 *
 * @example
 * // Basic usage
 * interface ChatMessage { user: string; text: string; }
 *
 * const client = new WebSocketClient<ChatMessage>('wss://chat.example.com');
 * client.connect();
 *
 * // Send messages
 * await client.send({ user: 'John', text: 'Hello!' });
 *
 * // Receive messages
 * while (true) {
 *     const message = await client.receive();
 *     console.log(`${message.user}: ${message.text}`);
 * }
 *
 * @example
 * // With options
 * const client = new WebSocketClient<Message>('wss://api.example.com', {
 *     autoReconnect: true,
 *     onConnect: (socket) => console.log('Connected'),
 *     onClose: () => console.log('Disconnected')
 * });
 */
export class WebSocketClient<TMessage> {
    private ws?: WebSocketAbstraction;
    private receiveQueue = new LinkedList<TMessage>();
    private receivePromiseWrapper?: PromiseWrapper<TMessage>;
    private sendQueue = new LinkedList<TMessage>();
    private _isConnected = false;
    private isSendingQueue = false;
    private url?: string;
    private wsFactory?: WebSocketFactory;
    private reconnectAttempts = 0;
    private shouldReconnect = true;

    get connected(): boolean {
        return this._isConnected;
    }

    constructor(
        urlOrWebSocketFactory: string | WebSocketFactory,
        private options?: WebSocketOptions<TMessage>
    ) {
        if (typeof urlOrWebSocketFactory === 'string') {
            this.url = urlOrWebSocketFactory;
        } else {
            this.wsFactory = urlOrWebSocketFactory;
        }
    }

    connect() {
        this.shouldReconnect = true;
        this.reconnectAttempts = 0;
        this.reConnect();
    }

    disconnect() {
        this.shouldReconnect = false;
        this.ws?.close();
    }

    send(data: TMessage): void {
        if (!this._isConnected || this.isSendingQueue) {
            this.sendQueue.addLast(data);
            return;
        }

        if (this.sendQueue.length > 0) {
            this.sendQueueItems();
        }

        this.sendInternal(data);
    }

    /**
     * Receive a new message.
     *
     * @throws Error if called while another receive() is pending.
     * @throws Error if connection closes while waiting.
     */
    receive(): Promise<TMessage> {
        if (this.receivePromiseWrapper) {
            throw new Error('You can only invoke receive() once at a time.');
        }

        if (this.receiveQueue.firstValue) {
            return Promise.resolve(this.receiveQueue.removeFirst());
        }

        const wrapper = new PromiseWrapper<TMessage>();
        this.receivePromiseWrapper = wrapper;
        return new Promise((resolve, reject) => {
            wrapper.resolve = resolve;
            wrapper.reject = reject;
        });
    }

    private onMessage(ev: SimpleDataEvent) {
        let msg: TMessage;
        if (this.options?.codec) {
            msg = this.options.codec.decode(ev.data);
        } else if (typeof ev.data === 'string') {
            if (
                ev.data.length > 0 &&
                (ev.data[0] === '"' || ev.data[0] === '[' || ev.data[0] === '{')
            ) {
                msg = JSON.parse(ev.data);
            } else {
                msg = ev.data as TMessage;
            }
        } else {
            msg = ev.data as TMessage;
        }

        if (this.receivePromiseWrapper) {
            this.receivePromiseWrapper.resolve(msg);
            this.receivePromiseWrapper = undefined;
            return;
        }

        this.receiveQueue.addLast(msg);
    }

    private reConnect() {
        const ws: WebSocketAbstraction = this.url
            ? (new WebSocket(this.url) as unknown as WebSocketAbstraction)
            : this.wsFactory!();
        this.ws = ws;
        ws.onmessage = (evt: SimpleDataEvent) => this.onMessage(evt);
        ws.onerror = () => ws.close();
        ws.onopen = () => {
            this._isConnected = true;
            this.reconnectAttempts = 0;
            this.options?.onConnect?.(this);
            this.sendQueueItems();
        };
        ws.onclose = () => {
            this._isConnected = false;

            if (this.receivePromiseWrapper) {
                this.receivePromiseWrapper.reject(new Error('WebSocket connection closed'));
                this.receivePromiseWrapper = undefined;
            }

            this.options?.onClose?.(this);

            if (this.shouldReconnect && this.options?.autoReconnect !== false) {
                const baseDelay = this.options?.reconnectDelay ?? 1000;
                const maxDelay = this.options?.maxReconnectDelay ?? 30000;
                const delay = Math.min(baseDelay * Math.pow(2, this.reconnectAttempts), maxDelay);
                this.reconnectAttempts++;
                setTimeout(() => this.reConnect(), delay);
            }
        };
    }

    private sendInternal(data: TMessage) {
        let dataToSend: string | ArrayBufferLike | Blob | ArrayBufferView;
        if (typeof data !== 'string') {
            if (this.options?.codec) {
                dataToSend = this.options.codec.encode(data);
            } else {
                dataToSend = JSON.stringify(data);
            }
        } else {
            dataToSend = data;
        }

        this.ws!.send(dataToSend);
    }

    private sendQueueItems(): void {
        if (this.isSendingQueue) {
            return;
        }

        this.isSendingQueue = true;
        while (this.sendQueue.length > 0) {
            const item = this.sendQueue.removeFirst();
            if (item == null) {
                break;
            }

            this.sendInternal(item);
        }

        this.isSendingQueue = false;
    }
}

/**
 * CODEC used for messages.
 */
export interface WebSocketCodec<TMessage> {
    /**
     *
     * @param data
     */
    encode(data: TMessage): string | ArrayBufferLike | Blob | ArrayBufferView;

    /**
     *
     * @param data
     */
    decode(data: string | ArrayBufferLike | Blob | ArrayBufferView): TMessage;
}

/**
 * Configuration options for @see WebSocketClient.
 */
export interface WebSocketOptions<TMessage> {
    /**
     * CODEC to use for inbound and outbound messages (if something else that JSON should be used).
     */
    codec?: WebSocketCodec<TMessage>;

    /**
     * Automatically reconnect when getting disconnected (default: true).
     */
    autoReconnect?: boolean;

    /**
     * Initial delay in milliseconds before reconnecting (default: 1000).
     * Uses exponential backoff on subsequent attempts.
     */
    reconnectDelay?: number;

    /**
     * Maximum delay in milliseconds between reconnect attempts (default: 30000).
     */
    maxReconnectDelay?: number;

    /**
     * Callback when the WS is connected.
     *
     * Can be used for authentication messages etc.
     *
     * @param socket Socket
     */
    onConnect?: (socket: WebSocketClient<TMessage>) => void;

    /**
     * Invoked when the connection is closed.
     *
     * The connection will be automatically reconnected if configured (on by default).
     *
     * @param socket Socket.
     */
    onClose?: (socket: WebSocketClient<TMessage>) => void;
}

class PromiseWrapper<TMessage> {
    resolve!: (value: TMessage | PromiseLike<TMessage>) => void;
    reject!: (reason?: unknown) => void;
}
