# Server-Sent Events

SSE client that dispatches received server events as DOM events.

## Quick Start

```typescript
import { SSEClient, SSEDataEvent } from '@relax.js/core/http';

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

## Sending Data to the Server

The browser's `EventSource` can only do a GET with no body and no headers. That is fine for a feed you subscribe to, but it cannot call an endpoint that takes input and streams a result back, such as "here is the match id, stream me the summary as it is written".

Set request options and `SSEClient` switches to a transport built on `fetch`, which can:

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

document.addEventListener('token', (e: SSEDataEvent) => {
    appendText(e.data);
});
```

### Which Transport is Used

The fetch transport is used when you set `method`, `body`, `headers` or `signal`, or when you set `autoReconnect: false`. Otherwise the browser's `EventSource` is used, exactly as before.

You never pick a transport by name. Set the options you need and the right one is chosen.

### The Fetch Transport Never Reconnects

A request that sends data is not always safe to repeat. Posting the same form twice can create two orders, and re-running a job that costs money costs it twice. So the fetch transport gives up instead of retrying, and tells you why through `onClose`. Offer the user a retry button and call `connect()` again if they want one.

Setting `autoReconnect: true` together with `method`, `body`, `headers` or `signal` is a mistake, and `connect()` reports it rather than quietly ignoring it.

### Base URL and JWT Token

On the fetch transport, `configure({ baseUrl })` and the JWT bearer token from the HTTP client both apply. On the `EventSource` transport neither applies, because `EventSource` cannot send headers at all and takes the URL exactly as you wrote it.

```typescript
configure({ baseUrl: '/api' });

// EventSource transport, the url is used as it is
new SSEClient('/events');
// GET /events

// fetch transport, base url and token are applied
new SSEClient('/events', { autoReconnect: false });
// GET /api/events
// Authorization: Bearer <token from localStorage>
```

Needing an `Authorization` header is by itself a good reason to use the fetch transport.

## Knowing Why the Stream Ended

A server that finished its work and a server that crashed halfway look identical to `EventSource`. Both surface as an error, and then the browser reconnects and runs the whole thing again. So you cannot tell "the answer is complete" from "the answer was cut off", which is exactly what you need to know before showing a result to a user.

`onClose` answers that question. It is called once per `connect()`.

```typescript
const sse = new SSEClient('/api/verdict', {
    method: 'POST',
    body: JSON.stringify({ matchId: 42 }),
    eventTypes: ['token', 'verdict'],
    terminalEvents: ['verdict'],
    onClose: (client, result) => {
        switch (result.reason) {
            case 'completed':
                markAsFinished();
                break;
            case 'truncated':
                showRetryButton();
                break;
            case 'aborted':
                break;
            case 'failed':
                showError(result.error);
                break;
        }
    }
});
```

```typescript
interface SSECloseResult {
    reason: SSECloseReason;
    lastEventName?: string;  // last event received before the stream stopped
    error?: Error;           // set when the reason is 'failed'
    response?: HttpResponse; // set when the server answered with a non 2xx status
}

type SSECloseReason = 'completed' | 'truncated' | 'aborted' | 'failed';
```

| Reason | What happened |
|--------|---------------|
| `completed` | The stream ended after one of your `terminalEvents` arrived. The result is whole. |
| `truncated` | The stream ended cleanly but no terminal event arrived. The result is incomplete. |
| `aborted` | You stopped it, through `disconnect()` or an `AbortSignal`. |
| `failed` | The request failed or the server answered with a non 2xx status. `error` and `response` say why. |

### Teaching the Client What "Finished" Looks Like

`terminalEvents` is the name of the last event your server sends. Nothing else can tell the client that the work is done, because a closed connection looks the same either way.

```typescript
// The server ends every successful run with:  event: verdict
terminalEvents: ['verdict']
```

Points worth knowing:

- Without `terminalEvents`, a clean end is always `completed`. There is nothing to be truncated relative to.
- A terminal event does not have to appear in `eventTypes`. Listing it in `eventTypes` is how you **receive** it. Listing it in `terminalEvents` is how you decide the stream **finished**. Most of the time you want it in both.
- The client is reusable after it closes, so a retry is just another `connect()`.
- On the `EventSource` transport, `onClose` is only called for `disconnect()`, with reason `aborted`. `EventSource` cannot report a clean server side close, so `completed` and `truncated` never happen there.

## Handling Errors

When the server refuses the request, for example because a feature is turned off, `fetch` still gets an answer. It is just not a 2xx one, and there is no stream to read.

`onError` receives an `SSEErrorEvent` carrying the error and the response, and `onClose` follows with reason `failed`. There is no reconnect.

```typescript
const sse = new SSEClient('/api/verdict', {
    method: 'POST',
    body: JSON.stringify({ matchId: 42 }),
    onError: (client, event) => {
        const failure = event as SSEErrorEvent;
        console.log(failure.response?.statusCode); // 503
    },
    onClose: (client, result) => {
        if (result.reason === 'failed' && result.response) {
            const problem = JSON.parse(result.response.body as string);
            showError(problem.message);
        }
    }
});
```

`response.body` holds the **raw response text**, not parsed JSON, so your app parses it. That is the same rule the HTTP client follows for failed requests, see [HttpClient.md](HttpClient.md). Calling `response.as<T>()` on an error response throws, also as it does there.

`SSEErrorEvent` extends `Event`, so an existing `onError` handler written for the `EventSource` transport keeps compiling and keeps working.

Cancelling is not a failure. `disconnect()` and an aborted `signal` both close with reason `aborted`, and never call `onError`.

## Configuration

```typescript
interface SSEOptions {
    target?: string | Element;      // CSS selector or element (default: document)
    withCredentials?: boolean;      // Send credentials (default: false)
    eventTypes?: string[];          // SSE event types to listen for
    eventFactory?: SSEEventFactory; // Custom event factory

    // These select the fetch transport
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';  // default: 'GET'
    body?: BodyInit;                // Data to send to the server
    headers?: Record<string, string>;
    signal?: AbortSignal;           // Cancel the stream
    autoReconnect?: boolean;        // default: true; false selects the fetch transport

    terminalEvents?: string[];      // Events that mean the result is complete
    onClose?: (client: SSEClient, result: SSECloseResult) => void;
    onConnect?: (client: SSEClient) => void;
    onError?: (client: SSEClient, error: Event) => void;
}

type SSEEventFactory = (eventName: string, data: unknown) => Event;
type SSECloseReason = 'completed' | 'truncated' | 'aborted' | 'failed';
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

Both transports filter the same way, so switching between them does not change which events reach your handlers.

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

On the default `EventSource` transport the browser reconnects on its own. The `onError` callback tells you something went wrong, but you do not have to act on it.

```typescript
const sse = new SSEClient('/api/events', {
    onConnect: () => console.log('Connected'),
    onError: () => console.log('Error (will auto-reconnect)')
});
```

If you do not want that, use `autoReconnect: false`. That selects the fetch transport, which stops on the first failure and reports it through `onClose`. See [Knowing Why the Stream Ended](#knowing-why-the-stream-ended).

## Testing

Replace fetch with `setFetch()` and hand back a response whose body is a stream of SSE text. Call `setFetch()` with no argument to restore the real one.

```typescript
import { setFetch } from '@relax.js/core/http';

function streamEvents(chunks: string[]): Response {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        start(controller) {
            for (const chunk of chunks) {
                controller.enqueue(encoder.encode(chunk));
            }
            controller.close();
        }
    });

    return new Response(stream, {
        status: 200,
        headers: { 'content-type': 'text/event-stream' }
    });
}

it('shows_a_retry_when_the_summary_was_cut_off', async () => {
    setFetch(async () => streamEvents(['event: token\ndata: half an answ\n\n']));

    const closed: SSECloseResult[] = [];
    new SSEClient('/api/verdict', {
        method: 'POST',
        body: '{}',
        eventTypes: ['token', 'verdict'],
        terminalEvents: ['verdict'],
        onClose: (client, result) => closed.push(result)
    }).connect();

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(closed[0].reason).toBe('truncated');
    setFetch();
});
```

Splitting one event across several chunks is worth testing, because that is what a real server does and it is where streaming code usually breaks:

```typescript
setFetch(async () => streamEvents([
    'event: verdict\ndata: {"te',
    'xt":"done"}\n\n'
]));
```

To test the `EventSource` transport instead, replace the global `EventSource` with a fake, since there is no injection point for it.

To test a server that refuses the request, return a plain error response:

```typescript
setFetch(async () => new Response('{"message":"Not enabled here."}', {
    status: 503,
    statusText: 'Service Unavailable',
    headers: { 'content-type': 'application/json' }
}));
```

## API Reference

### SSEClient

| Method/Property | Description |
|-----------------|-------------|
| `connect()` | Establish SSE connection. Can be called again after the stream closed. |
| `disconnect()` | Close connection. Closes with reason `aborted`. |
| `connected` | `boolean` - Current connection state |

### SSEDataEvent

| Property | Type | Description |
|----------|------|-------------|
| `type` | `string` | Event name from SSE |
| `data` | `unknown` | Parsed data (JSON auto-parsed) |
| `bubbles` | `boolean` | Always `true` |

### SSEErrorEvent

Passed to `onError` by the fetch transport. Extends `Event`.

| Property | Type | Description |
|----------|------|-------------|
| `error` | `Error` | What went wrong. `HttpError` for a non 2xx response. |
| `response` | `HttpResponse \| undefined` | Set for a non 2xx response. `body` is raw text. |

### SSECloseResult

| Property | Type | Description |
|----------|------|-------------|
| `reason` | `SSECloseReason` | `completed`, `truncated`, `aborted` or `failed` |
| `lastEventName` | `string \| undefined` | Last event received before the stream stopped |
| `error` | `Error \| undefined` | Set when the reason is `failed` |
| `response` | `HttpResponse \| undefined` | Set when the server answered with a non 2xx status |

### Exports

```typescript
import {
    SSEClient,
    SSEOptions,
    SSEDataEvent,
    SSEEventFactory,
    SSEErrorEvent,
    SSECloseResult,
    SSECloseReason
} from '@relax.js/core/http';
```
