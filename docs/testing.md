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

## Related

- [Error Handling](Errors.md) covers `onError()` and `RelaxError` in application code
- [Debugging](Debugging.md) covers the console traces for problems you are reproducing by hand
