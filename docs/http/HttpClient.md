# HTTP Client

Type-safe HTTP module built on fetch() with automatic JWT handling.

## Quick Start

```typescript
import { configure, get, post } from 'relaxjs/http';

configure({ baseUrl: '/api/v1' });

// GET request
const response = await get('/users');
const users = response.as<User[]>();

// POST request
const result = await post('/users', JSON.stringify({ name: 'John' }));
```

## Configuration

Call `configure()` once at app startup to set defaults for all requests:

```typescript
import { configure } from 'relaxjs/http';

configure({
    baseUrl: '/api/v1',
    contentType: 'application/json',
    bearerTokenName: 'authToken'
});
```

```typescript
interface HttpOptions {
    baseUrl?: string;           // Base URL prepended to all requests
    contentType?: string;       // Default content type (default: 'application/json')
    bearerTokenName?: string;   // JWT token key in localStorage (default: 'jwt', null to disable)
    timeout?: number;           // Default request timeout in milliseconds
}
```

### Request Timeouts

Set a default timeout for all requests:

```typescript
configure({
    baseUrl: '/api',
    timeout: 10000  // 10 seconds
});
```

Requests that exceed the timeout are automatically aborted. Per-request signals override the default timeout:

```typescript
// Custom timeout for a slow endpoint
await get('/reports/generate', null, {
    signal: AbortSignal.timeout(60000)
});

// Manual abort control
const controller = new AbortController();
await get('/users', null, { signal: controller.signal });
controller.abort();
```

## HTTP Methods

All methods are standalone functions. They return `Promise<HttpResponse>`.

### GET

```typescript
import { get } from 'relaxjs/http';

// Simple GET
const response = await get('/users');

// With query parameters
const filtered = await get('/users', {
    status: 'active',
    role: 'admin'
});
// Results in: /api/v1/users?status=active&role=admin
```

### POST

```typescript
import { post } from 'relaxjs/http';

const user = { name: 'John', email: 'john@example.com' };
const response = await post('/users', JSON.stringify(user));

if (response.success) {
    const created = response.as<User>();
    console.log('Created user:', created.id);
}
```

### PUT

```typescript
import { put } from 'relaxjs/http';

const updates = { name: 'John Updated' };
const response = await put('/users/123', JSON.stringify(updates));
```

### DELETE

The function is named `del` (not `delete`, which is a reserved word):

```typescript
import { del } from 'relaxjs/http';

const response = await del('/users/123');
if (response.success) {
    console.log('User deleted');
}
```

### Generic Request

Use `request()` for full control over the request:

```typescript
import { request } from 'relaxjs/http';

const response = await request('/users', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-Custom-Header': 'value'
    },
    body: JSON.stringify(data),
    credentials: 'include'
});
```

## Response Handling

All methods return an `HttpResponse`:

```typescript
interface HttpResponse {
    success: boolean;           // true for 2xx responses
    statusCode: number;         // HTTP status code
    statusReason: string;       // HTTP status text
    contentType: string | null; // Response content type
    body: unknown;              // Parsed JSON body (success) or raw text (error)
    charset: string | null;     // Response charset
    as<T>(): T;                 // Type-cast body (throws on error responses)
}
```

### Type-Safe Responses

```typescript
interface User {
    id: number;
    name: string;
    email: string;
}

const response = await get('/users/123');

if (response.success) {
    const user = response.as<User>();
    displayUser(user);
} else {
    console.error(`Error ${response.statusCode}: ${response.body}`);
}
```

### 204 No Content

Responses with status 204 return `null` as the body (no JSON parsing attempted).

## Authentication

JWT tokens are automatically read from localStorage and added as `Authorization: Bearer <token>`:

```typescript
// Login and store token
const loginResponse = await post('/auth/login', JSON.stringify({
    username: 'user',
    password: 'pass'
}));

if (loginResponse.success) {
    const { token } = loginResponse.as<{ token: string }>();
    localStorage.setItem('jwt', token);
}

// All subsequent requests include the Authorization header automatically
const protectedData = await get('/protected/resource');
```

### Disabling Auto-Auth

```typescript
configure({
    baseUrl: '/api/public',
    bearerTokenName: null  // Disable JWT handling
});
```

### Custom Token Name

```typescript
configure({
    bearerTokenName: 'auth_token'  // Reads from localStorage.getItem('auth_token')
});
```

## Error Handling

```typescript
import { get, HttpError } from 'relaxjs/http';

try {
    const response = await get('/users/999');

    if (!response.success) {
        throw new HttpError(response);
    }

    return response.as<User>();
} catch (error) {
    if (error instanceof HttpError) {
        console.error(`HTTP ${error.response.statusCode}: ${error.message}`);
    } else {
        console.error('Network error:', error);
    }
}
```

## Testing

Replace the global fetch implementation for unit tests:

```typescript
import { setFetch, get, configure } from 'relaxjs/http';

// Mock fetch for tests
setFetch(async (url, options) => {
    return new Response(JSON.stringify({ id: 1, name: 'Test User' }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
    });
});

configure({ baseUrl: '/api' });
const response = await get('/users/1');
const user = response.as<User>();
// user === { id: 1, name: 'Test User' }

// Restore real fetch
setFetch();
```

## WebSocket Client

Type-safe WebSocket client with automatic reconnection and message queuing.

```typescript
import { WebSocketClient } from 'relaxjs/http';

interface ChatMessage {
    user: string;
    text: string;
}

const ws = new WebSocketClient<ChatMessage>('wss://chat.example.com', {
    autoReconnect: true,
    reconnectDelay: 1000,
    maxReconnectDelay: 30000,
    onConnect: (socket) => console.log('Connected'),
    onClose: (socket) => console.log('Disconnected')
});

ws.connect();

// Send messages (queued automatically if disconnected)
ws.send({ user: 'John', text: 'Hello!' });

// Receive messages
while (ws.connected) {
    try {
        const message = await ws.receive();
        console.log(`${message.user}: ${message.text}`);
    } catch (error) {
        console.log('Connection closed');
        break;
    }
}

ws.disconnect();
```

### Features

- **Auto-reconnect**: Automatically reconnects with exponential backoff (enabled by default)
- **Message queuing**: Messages sent while disconnected are queued and sent on reconnect
- **Type-safe**: Generic type parameter for message types
- **JSON by default**: Automatically serializes/deserializes JSON messages
- **Connection state**: Check `connected` property for current state
- **Graceful disconnect**: Call `disconnect()` to close without auto-reconnect

### WebSocket Options

```typescript
interface WebSocketOptions<TMessage> {
    codec?: WebSocketCodec<TMessage>;   // Custom message encoding
    autoReconnect?: boolean;            // Auto-reconnect (default: true)
    reconnectDelay?: number;            // Initial reconnect delay in ms (default: 1000)
    maxReconnectDelay?: number;         // Max reconnect delay in ms (default: 30000)
    onConnect?: (socket: WebSocketClient<TMessage>) => void;
    onClose?: (socket: WebSocketClient<TMessage>) => void;
}
```

### Exponential Backoff

When auto-reconnect is enabled, the client uses exponential backoff:

| Attempt | Delay (with defaults) |
|---------|----------------------|
| 1 | 1s |
| 2 | 2s |
| 3 | 4s |
| 4 | 8s |
| 5 | 16s |
| 6+ | 30s (max) |

The delay resets to `reconnectDelay` after a successful connection.

### Custom Message Codec

```typescript
interface WebSocketCodec<TMessage> {
    encode(data: TMessage): string | ArrayBufferLike | Blob | ArrayBufferView;
    decode(data: string | ArrayBufferLike | Blob | ArrayBufferView): TMessage;
}

const ws = new WebSocketClient<Message>('wss://api.example.com', {
    codec: {
        encode(msg: Message): string {
            return msgpack.encode(msg);
        },
        decode(data: string): Message {
            return msgpack.decode(data);
        }
    }
});
```

### Receive Behavior

`receive()` returns a Promise that resolves when a message arrives. Only one `receive()` call can be active at a time:

```typescript
// Correct: sequential receives
const msg1 = await ws.receive();
const msg2 = await ws.receive();

// Error: concurrent receives throw
const [msg1, msg2] = await Promise.all([ws.receive(), ws.receive()]); // Throws!
```

The promise rejects if the connection closes while waiting:

```typescript
try {
    const message = await ws.receive();
    handleMessage(message);
} catch (error) {
    // error.message === 'WebSocket connection closed'
    console.log('Connection lost');
}
```

### Testing WebSocket

Pass a factory function instead of a URL:

```typescript
import { WebSocketClient, WebSocketAbstraction, WebSocketFactory } from 'relaxjs/http';

const mockSocket: WebSocketAbstraction = {
    onopen: null,
    onerror: null,
    onclose: null,
    onmessage: null,
    send: vi.fn(),
    close: vi.fn()
};

const factory: WebSocketFactory = () => mockSocket;
const ws = new WebSocketClient<Message>(factory);
ws.connect();

// Simulate server message
mockSocket.onmessage?.({ data: '{"text": "hello"}' });
```

## API Reference

### Functions

| Function | Description |
|----------|-------------|
| `configure(options)` | Set module-wide defaults (base URL, content type, JWT) |
| `get(url, queryString?, options?)` | GET request with optional query parameters |
| `post(url, body, options?)` | POST request with body |
| `put(url, body, options?)` | PUT request with body |
| `del(url, options?)` | DELETE request |
| `request(url, options?)` | Generic request with full RequestInit options |
| `setFetch(fn?)` | Replace fetch implementation for testing |

### WebSocketClient

| Method/Property | Description |
|-----------------|-------------|
| `connect()` | Establish WebSocket connection |
| `disconnect()` | Close connection without auto-reconnect |
| `send(data)` | Send message (queued if disconnected) |
| `receive()` | Receive next message (rejects on close) |
| `connected` | `boolean` - Current connection state |

### Exports

```typescript
// HTTP
import {
    configure,
    get,
    post,
    put,
    del,
    request,
    setFetch,
    HttpOptions,
    HttpResponse,
    HttpError,
    RequestOptions
} from 'relaxjs/http';

// WebSocket
import {
    WebSocketClient,
    WebSocketOptions,
    WebSocketCodec,
    WebSocketAbstraction,
    WebSocketFactory
} from 'relaxjs/http';
```
