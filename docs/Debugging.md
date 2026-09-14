# Debugging

Relaxjs can narrate what it is doing internally. The traces are off by default and are turned on per area, so you only see the part you are investigating.

They ship in the production build on purpose. Routing and template problems usually surface in a deployed app, and a trace that was stripped at build time is exactly the one missing when that happens. Turn traces on in the browser console of the affected environment, reproduce the problem, and read the output.

## Quick Start

```javascript
window.relaxDebug = { routing: true };
```

Then reproduce the problem. Set it before the app starts routing if you need to see startup, which usually means typing it into the console and reloading, or setting it from application code:

```typescript
window.relaxDebug = { routing: true };
defineRoutes(routes);
startRouting();
```

Every trace is prefixed with the area that produced it, so you can filter the console on `[relaxjs:`.

## Areas

| Flag | What it reports |
| --- | --- |
| `routing` | Route registration, layout resolution, every navigation, targets connecting and disconnecting, navigations that could not be delivered, and page reloads performed to switch layout. |
| `templates` | Expressions that could not be resolved while rendering, for both `html` and `compileTemplate`. |
| `errors` | Every error reported through `reportError`, with its context. This is the whole error channel, not one area of it. |

Turn on one area at a time. Each area is verbose on purpose: when you have opted into it, a missing line is worse than an extra one, because you cannot tell "this did not happen" from "this was not logged".

## Which flag for which symptom

**Nothing rendered and there was no error.** The usual cause is a navigation aimed at a target that is not connected. Relaxjs parks that navigation and replays it when a matching target appears, so a target that is merely slow still works. A navigation still parked once the page has settled is reported as an error naming the target that was asked for and the targets that exist. Use `routing` when you want to watch the same thing happen live, along with everything around it.

**The URL is right but no route matched.** Use `routing`. The trace lists every route that was tried with its path and segment count next to the segment count of the URL. A count mismatch and a value mismatch look identical from the outside and have different fixes.

**A value renders as empty and nothing complains.** A template renders an empty string for an expression it cannot resolve, so a mistyped path such as `{{user.naem}}`, a function that was never passed, or an unknown event name all render as nothing. Each one is reported through [onError()](Errors.md) with the expression and the place in the template it came from, so the failure is catchable without a browser. Turn on `templates` to see the same reports in the console while you reproduce.

In a test, `captureRelaxErrors()` from `@relax.js/core/testing` collects them so a blank element becomes an assertion:

```typescript
import { captureRelaxErrors } from '@relax.js/core/testing';

const captured = captureRelaxErrors();
render({ user: { name: 'Alice' } });
expect(captured.messages()).toEqual([]);
captured.restore();
```

**The back button behaves oddly after a layout switch.** Use `routing`. Each target owns its history, and that history is set aside and restored when a target disconnects and reconnects. The trace says whether a target got a restored history or a fresh one.

## Errors that nobody handled

Errors are quiet by default: they go to the handler registered with `onError()`, and if there is
none, nowhere. That keeps a library out of a production console, but it also means a failure can go
unnoticed. Two things make them findable without turning anything on in advance.

Every reported error is kept in `window.relaxErrors`, most recent last, so the failures that
already happened can be read after the fact:

```javascript
window.relaxErrors.map(e => e.message);
window.relaxErrors.at(-1).context;
```

And the first time an error is reported with nothing listening, one line is printed naming that
array, the `errors` flag, `onError()` and `captureRelaxErrors()`. It appears once per page load and
never repeats, so it is a signpost rather than noise.

## Traces are not the error channel

Traces describe what happened. Errors describe what went wrong, carry structured context, and are the thing to build on when you want failures reported from real users. See [Error Handling](Errors.md) for `onError()` and `RelaxError`.

If you are diagnosing a failure rather than a silence, start with the error context. Reach for traces when nothing failed and nothing happened either.

## Printing the route table

`printRoutes()` writes the registered routes to the console at any time, independently of the debug flags:

```typescript
import { printRoutes } from '@relax.js/core/routing';

printRoutes();
```

## Type support

`window.relaxDebug` is typed through `RelaxDebugFlags`, which is exported from the package root. Importing anything from `@relax.js/core` is enough to make the global available to TypeScript.
