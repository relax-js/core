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
| `templates` | Expressions that could not be resolved while rendering. |

Turn on one area at a time. Each area is verbose on purpose: when you have opted into it, a missing line is worse than an extra one, because you cannot tell "this did not happen" from "this was not logged".

## Which flag for which symptom

**Nothing rendered and there was no error.** Use `routing`. The usual cause is a navigation aimed at a target that is not connected. Relaxjs parks that navigation and replays it when a matching target appears, so nothing fails, but nothing shows either. The trace names the target that was asked for and lists the targets that actually exist, which is normally enough to spot a typo or a target that never connected.

**The URL is right but no route matched.** Use `routing`. The trace lists every route that was tried with its path and segment count next to the segment count of the URL. A count mismatch and a value mismatch look identical from the outside and have different fixes.

**A value renders as empty and nothing complains.** Use `templates`. By default a template renders an empty string for an expression it cannot resolve, so a mistyped path such as `{{user.naem}}`, a function that was never passed, or an unknown event name all produce silence. With the flag on, each one is reported with the expression and the place in the template it came from.

**The back button behaves oddly after a layout switch.** Use `routing`. Each target owns its history, and that history is set aside and restored when a target disconnects and reconnects. The trace says whether a target got a restored history or a fresh one.

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
