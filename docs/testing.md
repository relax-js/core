# Testing

Helpers for testing components built on Relaxjs, exported from `@relax.js/core/testing`.

They exist because the failures that matter in a component are asynchronous or quiet. A custom element only connects once it is in the document, work started in `connectedCallback` finishes a task later, and a template that cannot resolve an expression reports the problem instead of throwing. Without helpers every project rewrites the same waiting and the same error capture.

Import them in test files only. Nothing here belongs in application code.

## flush

Waits for pending microtasks and the next macrotask, so DOM work started by a lifecycle callback has finished.

```typescript
import { mount, flush } from '@relax.js/core/testing';

const { element } = mount<UserProfile>('user-profile');
await flush();

expect(element.querySelector('h1')?.textContent).toBe('Alice');
```

Asserting straight after `mount()` sees the element before its data arrived, because lifecycle callbacks are synchronous but anything they `await` is not.

## mount

Attaches an element to `document.body` so its lifecycle callbacks run, and hands back the means to detach it.

```typescript
const { element, unmount } = mount<UserProfile>('user-profile');
element.setAttribute('user-id', '42');
await flush();

unmount();
```

An element created with `document.createElement` alone never runs `connectedCallback`, so a component tested that way looks inert for reasons that have nothing to do with the component. `mount` also accepts an element you already created.

`unmount()` removes it again, which is how you test `disconnectedCallback`.

## captureRelaxErrors

Collects `RelaxError`s instead of letting them throw, so a test can assert on failures that would otherwise only appear in a browser console.

```typescript
import { captureRelaxErrors } from '@relax.js/core/testing';

const captured = captureRelaxErrors();
try {
    const { content, render } = compileTemplate('<p>{{user.naem}}</p>');
    render({ user: { name: 'Alice' } });

    expect(captured.messages()).toEqual([]);
} finally {
    captured.restore();
}
```

This is what turns a template typo into a test failure. `{{user.naem}}` renders an empty string and reports the problem; without capturing it, the test sees an empty element and no reason for it.

The same channel carries the failures that produce no DOM at all: a `render()` given the object it was given last time, an `html` template bound twice, a navigation waiting for a route target that never connects, a re-render replacing the field the user has focus in. Asserting `captured.messages()` is empty in tests that are about something else is what catches those.

Errors are suppressed while the capture is installed, so rendering continues and the assertion is reached. `restore()` puts the previously registered handler back, so call it in a `finally` or an `afterEach`.

| Member | Description |
|--------|-------------|
| `errors` | Every `RelaxError` reported since the capture was installed, in order. |
| `messages()` | The messages of those errors, for readable assertions. |
| `restore()` | Puts the previously registered handler back. |

## mountRouting

Registers routes and puts `<r-route-target>` elements in the document, so a test navigates the way the application does and gets the rendered component back.

```typescript
import { mountRouting } from '@relax.js/core/testing';

const routing = mountRouting([
    { name: 'user', path: '/users/:id', componentTagName: 'user-profile' },
]);
try {
    const page = await routing.navigate<UserProfile>('user', { params: { id: '42' } });
    expect(page.routeData).toEqual({ id: '42' });
    expect(page.querySelector('h1')?.textContent).toBe('Alice');
} finally {
    routing.unmount();
}
```

A navigation is several asynchronous steps: the target must be connected, the component registered, `loadRoute()` awaited. `navigate()` resolves once the component is inside its target, which is after all of that, so `flush()` is not needed. It rejects when no route matched or a guard stopped the navigation, the same errors `navigate()` throws in the application.

When nothing renders within the timeout, the rejection lists the Relaxjs errors reported meanwhile. A `loadRoute()` that threw, or a tag name that is not registered, is named there instead of leaving you with an empty target.

Routes with a `layout` other than the one the document is in cannot be navigated to here, because the router would reload the page to switch layout.

| Member | Description |
|--------|-------------|
| `target` | The unnamed `<r-route-target>`, where routes without a `target` render. |
| `navigate(nameOrUrl, options?)` | Navigates and resolves with the routed component. |
| `unmount()` | Removes the targets and forgets any parked navigation. |

| Option | Description |
|--------|-------------|
| `targets` | Names of additional `<r-route-target name="...">` elements to add. |
| `timeout` | How long `navigate()` waits for the component, in milliseconds. Default 1000. |

## fakeServer

Replaces the network for `@relax.js/core/http` with canned responses, and records every request.

```typescript
import { fakeServer, mount, flush } from '@relax.js/core/testing';

const server = fakeServer()
    .on('GET', '/api/users/42', { id: 42, name: 'Alice' })
    .on('POST', '/api/users', (request) => ({ id: 43, ...request.json<object>() }), 201);
try {
    const { element } = mount<UserProfile>('user-profile');
    await flush();

    expect(element.querySelector('h1')?.textContent).toBe('Alice');
    expect(server.requests.map((r) => r.path)).toEqual(['/api/users/42']);
} finally {
    server.restore();
}
```

Paths are matched without the query string and include the configured base URL, since that is what a server sees. The body is serialized as JSON; a function body is called with the request, which is how a POST answers with what it was sent.

A request nothing was registered for gets a 404 whose body names the registered routes, and is recorded like any other. An unexpected call therefore shows up in `requests` and in the component's error state rather than hanging or reaching the network.

Only requests made through the http module are intercepted. A component calling `fetch` directly is outside this seam.

| Member | Description |
|--------|-------------|
| `on(method, path, body?, status?)` | Registers a response. Returns the server, so calls chain. |
| `requests` | Every request received, in order. Each has `method`, `url`, `path`, `query`, `headers`, `body` and `json()`. |
| `restore()` | Puts the real fetch back. |

## Related

- [Error Handling](Errors.md) covers `onError()` and `RelaxError` in application code
- [Debugging](Debugging.md) covers the console traces for problems you are reproducing by hand
