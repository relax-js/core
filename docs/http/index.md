# HTTP, WebSocket & SSE

This module provides HTTP, WebSocket, and Server-Sent Events clients for network communication.

## Available Features

| Feature | Description | Use Case |
|---------|-------------|----------|
| [HTTP Client](HttpClient.md#http-client) | Type-safe HTTP functions | REST API calls with JWT handling |
| [WebSocketClient](HttpClient.md#websocket-client) | WebSocket client with auto-reconnect | Real-time bidirectional messaging |
| [SSEClient](ServerSentEvents.md) | Server-Sent Events as DOM events | Server push notifications, and streaming a result back from a request |

## Quick Start

### HTTP Requests

```typescript
import { configure, get, post } from '@relax.js/core/http';

configure({ baseUrl: '/api/v1' });

// GET with query parameters
const response = await get('/users', { status: 'active' });
if (response.success) {
    const users = response.as<User[]>();
}

// POST with JSON body
const result = await post('/users', JSON.stringify({ name: 'John' }));
```

### WebSocket Messaging

```typescript
import { WebSocketClient } from '@relax.js/core/http';

const ws = new WebSocketClient<Message>('wss://api.example.com');
ws.connect();

// Check connection state
console.log(ws.connected); // true when connected

// Send (queued if disconnected)
ws.send({ type: 'chat', text: 'Hello' });

// Receive (rejects if connection closes)
try {
    const message = await ws.receive();
} catch (e) {
    console.log('Connection closed');
}

// Disconnect when done
ws.disconnect();
```

### Server-Sent Events

```typescript
import { SSEClient } from '@relax.js/core/http';

const sse = new SSEClient('/api/events', {
    eventTypes: ['user-updated', 'notification']
});
sse.connect();

// Events dispatch to document by default
document.addEventListener('notification', (e: SSEDataEvent) => {
    showNotification(e.data);
});

// Disconnect when done
sse.disconnect();
```

Send data and stream the answer back:

```typescript
const sse = new SSEClient('/api/verdict', {
    method: 'POST',
    body: JSON.stringify({ matchId: 42 }),
    eventTypes: ['token', 'verdict'],
    terminalEvents: ['verdict'],
    onClose: (client, result) => {
        if (result.reason === 'truncated') {
            showRetryButton();
        }
    }
});
sse.connect();
```

## Key Features

### HTTP Client

- Standalone functions (`get`, `post`, `put`, `del`, `request`)
- Module-wide configuration via `configure()`
- Automatic base URL prefixing
- JWT token from localStorage (configurable)
- Query string building
- Type-safe response casting
- Replaceable fetch for testing via `setFetch()`

### WebSocketClient

- Auto-reconnect with exponential backoff
- Message queuing when disconnected
- Custom message codecs
- Type-safe generic messages
- Connection state tracking
- Graceful disconnect support

### SSEClient

- Dispatches SSE events as DOM events
- Configurable target element or document
- Browser reconnection by default
- Optional fetch transport that sends a method, body and headers
- Reports why a stream ended, so a cut off result can be retried
- Base URL and JWT token on the fetch transport
- Automatic JSON parsing
- Replaceable fetch for testing via `setFetch()`

## Choosing the Right Tool

- **REST API calls?** → Use `get`, `post`, `put`, `del`
- **Bidirectional real-time?** → Use `WebSocketClient`
- **Server push only?** → Use `SSEClient`
- **Send a request and stream the answer back?** → Use `SSEClient` with `method` and `body`
- **Both?** → Use `HttpClient` for requests, `WebSocketClient` or `SSEClient` for subscriptions
