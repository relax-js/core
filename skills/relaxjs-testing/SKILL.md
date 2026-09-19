---
name: relaxjs-testing
description: Testing and debugging components built on @relax.js/core - mount(), flush(), captureRelaxErrors(), mountRouting() and fakeServer() from @relax.js/core/testing, the onError channel and the window.relaxDebug traces. Use when writing a test for a Relaxjs component, page, route or template, when a test sees an empty element or an element that never initialised, or when diagnosing a page that renders nothing without reporting an error.
---

# Testing and debugging Relaxjs

Import the helpers from `@relax.js/core/testing`. They exist because the failures that matter here
are asynchronous or quiet. Nothing from this module belongs in application code.

Tests run in vitest with jsdom. Register test-only components with a `test-` prefix so they never
collide with real ones, and `import` from the package, not from `dist` paths.

## An element must be mounted to live

`document.createElement` alone never runs `connectedCallback`, so a component tested that way
looks inert for reasons that have nothing to do with the component.

```typescript
const { element, unmount } = mount<UserProfile>('user-profile');
await flush();
```

`flush()` waits for pending microtasks and the next macrotask. Lifecycle callbacks are
synchronous, but anything they `await` is not, so asserting straight after `mount()` sees the
element before its data arrived. `unmount()` is how you test `disconnectedCallback`.

## Capture the errors or the test proves nothing

Template failures are reported, not thrown. `{{user.naem}}` renders an empty string, so a test
that only checks the DOM sees a blank element and no reason for it.

```typescript
const captured = captureRelaxErrors();
try {
    render({ user: { name: 'Alice' } });
    expect(captured.messages()).toEqual([]);
} finally {
    captured.restore();
}
```

Errors are suppressed while the capture is installed, so rendering continues and the assertion is
reached. `restore()` puts the previous handler back, so call it in a `finally` or an `afterEach`.
Assert on `captured.messages()` even in tests that are about something else: it is what turns a
typo into a failure instead of a mystery. A typo in a typed template is cheaper still:
`npx @relax.js/core check` reports it with a file and line, no test needed (see the
**relaxjs-templates** skill).

## Fake the server, not the component

A component that loads data goes through `@relax.js/core/http`. `fakeServer()` answers those
requests and records them, so the component under test is the real one and the assertion covers
both what it rendered and what it asked for.

```typescript
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

Paths include the configured base URL and exclude the query string, which lands in
`request.query`. An unregistered request gets a 404 naming what is registered and is still
recorded, so an unexpected call is visible in `server.requests`. Do not stub `fetch` globally or
mock the component's own methods; the seam is the http module.

## Navigate like the app, then assert on the page

`mountRouting()` registers routes and puts `<r-route-target>` elements in the document. Its
`navigate()` resolves with the routed component once it is in the target, after `loadRoute()`
finished, so no `flush()` is needed.

```typescript
const routing = mountRouting([
    { name: 'user', path: '/users/:id', componentTagName: 'user-profile' },
]);
try {
    const page = await routing.navigate<UserProfile>('user', { params: { id: '42' } });
    expect(page.routeData).toEqual({ id: '42' });
} finally {
    routing.unmount();
}
```

It rejects the way `navigate()` throws in the app (no route, guard stopped it), and when nothing
renders within the timeout the rejection lists the Relaxjs errors reported meanwhile. Test guards
with `await expect(routing.navigate('locked')).rejects.toBeInstanceOf(RouteGuardError)`. Pass
`{ targets: ['modal'] }` for routes with a named target. Routes with another `layout` cannot be
navigated to; the router would reload the page.

A page test combines the three: `fakeServer()` for its data, `mountRouting()` to reach it,
`captureRelaxErrors()` to prove the template resolved.

## Reset between tests

Routing targets, the error handler and the fetch replacement are module-level. Every helper
returns the means to undo itself (`unmount()`, `restore()`); call it in `afterEach` or a `finally`
so one test's leftovers cannot explain the next test's failure. Reset `onError(null as any)` in
`beforeEach` when a test registers a handler of its own.

## Debugging a running app

Traces are off by default, turned on per area, and shipped in the production build on purpose,
because routing and template problems surface in deployed apps.

```javascript
window.relaxDebug = { routing: true };
```

`routing` covers registration, layout resolution, every navigation, targets connecting and
disconnecting, and navigations that could not be delivered. `templates` covers expressions that
could not be resolved. `errors` prints the whole error channel. Turn on one area at a time.

Every reported error collects in `window.relaxErrors` whether a handler is registered or not, and
the first unhandled one prints a single line naming that array. Read it after a failure instead of
reproducing the failure with a flag on.

Traces are not the error channel. If something failed, start with the error context. Reach for
traces when nothing failed and nothing happened either.

## Detail

- `@relax.js/core/docs/testing.md` for the helpers
- `@relax.js/core/docs/Debugging.md` for which flag answers which symptom
- `@relax.js/core/docs/Errors.md` for `onError()` and `RelaxError` in application code
