# Server-Sent Events

SSE client that dispatches received server events as DOM events.

## Quick Start

```typescript
import { SSEClient, SSEDataEvent } from 'relaxjs/http';

const sse = new SSEClient('/api/events', {
    eventTypes: ['user-updated', 'notification']
});

sse.connect();

document.addEventListener('user-updated', (e: SSEDataEvent) => {
    console.log('User updated:', e.data);
});

// When done
sse.disconnect();
```

## Configuration

```typescript
interface SSEOptions {
    target?: string | Element;      // CSS selector or element (default: document)
    withCredentials?: boolean;      // Send credentials (default: false)
    eventTypes?: string[];          // SSE event types to listen for
    eventFactory?: SSEEventFactory; // Custom event factory
    onConnect?: (client: SSEClient) => void;
    onError?: (client: SSEClient, error: Event) => void;
}

type SSEEventFactory = (eventName: string, data: unknown) => Event;
```

## Event Types

### Default (message)

Without `eventTypes`, listens to the default `message` event:

```typescript
// Server sends: data: {"text": "hello"}
const sse = new SSEClient('/api/events');
sse.connect();

document.addEventListener('message', (e: SSEDataEvent) => {
    console.log(e.data); // { text: 'hello' }
});
```

### Named Events

With `eventTypes`, listens to specific SSE event types:

```typescript
// Server sends: event: notification\ndata: {"text": "hello"}
const sse = new SSEClient('/api/events', {
    eventTypes: ['notification', 'alert']
});
sse.connect();

document.addEventListener('notification', (e: SSEDataEvent) => {
    console.log(e.data);
});
```

## Target Element

Dispatch events to a specific element instead of document:

```typescript
const sse = new SSEClient('/api/events', {
    target: '#notifications',
    eventTypes: ['notification']
});

sse.connect();

document.querySelector('#notifications')
    .addEventListener('notification', (e: SSEDataEvent) => {
        showNotification(e.data);
    });
```

## Event Factory

Use `eventFactory` to create custom event instances:

```typescript
class UserUpdatedEvent extends Event {
    constructor(public user: User) {
        super('user-updated', { bubbles: true });
    }
}

class OrderCreatedEvent extends Event {
    constructor(public order: Order) {
        super('order-created', { bubbles: true });
    }
}

const sse = new SSEClient('/api/events', {
    eventTypes: ['user-updated', 'order-created'],
    eventFactory: (eventName, data) => {
        switch (eventName) {
            case 'user-updated':
                return new UserUpdatedEvent(data as User);
            case 'order-created':
                return new OrderCreatedEvent(data as Order);
            default:
                return new SSEDataEvent(eventName, data);
        }
    }
});

sse.connect();

// Now events are properly typed
document.addEventListener('user-updated', (e: UserUpdatedEvent) => {
    console.log(e.user);
});
```

## Type Registration

Register event types for TypeScript support:

```typescript
declare global {
    interface DocumentEventMap {
        'user-updated': UserUpdatedEvent;
        'order-created': OrderCreatedEvent;
    }
}

// TypeScript now knows the event type
document.addEventListener('user-updated', (e) => {
    console.log(e.user); // Typed as User
});
```

## Reconnection

EventSource has built-in automatic reconnection. The `onError` callback fires when errors occur, but the browser handles reconnection automatically.

```typescript
const sse = new SSEClient('/api/events', {
    onConnect: () => console.log('Connected'),
    onError: () => console.log('Error (will auto-reconnect)')
});
```

## API Reference

### SSEClient

| Method/Property | Description |
|-----------------|-------------|
| `connect()` | Establish SSE connection |
| `disconnect()` | Close connection |
| `connected` | `boolean` - Current connection state |

### SSEDataEvent

| Property | Type | Description |
|----------|------|-------------|
| `type` | `string` | Event name from SSE |
| `data` | `unknown` | Parsed data (JSON auto-parsed) |
| `bubbles` | `boolean` | Always `true` |

### Exports

```typescript
import {
    SSEClient,
    SSEOptions,
    SSEDataEvent,
    SSEEventFactory
} from 'relaxjs/http';
```
