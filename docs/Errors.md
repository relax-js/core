# Error Handling

Global error handling for Relaxjs. Intercept errors before they throw, inspect structured context, and decide whether to suppress them.

Looking for the case where nothing failed but nothing happened either? See [Debugging](Debugging.md) for the trace flags.

## Overview

By default, Relaxjs throws a `RelaxError` when something goes wrong internally. Register a handler with `onError()` to intercept these errors. The handler receives an `ErrorContext` that lets you control whether the error is thrown.

## Quick Start

```typescript
import { onError } from '@relax.js/core/utils';

onError((error, ctx) => {
    console.log(error.message);
    console.log(error.context);
});
```

Errors still throw after the handler runs. Call `ctx.suppress()` to prevent that:

```typescript
onError((error, ctx) => {
    logToService(error.message, error.context);
    showToast(error.message);
    ctx.suppress();
});
```

## Finding errors nobody handled

With no handler registered, an error still has somewhere to go. Every reported error is appended to
`window.relaxErrors`, most recent last, capped at the last 50, whether a handler exists or not:

```javascript
window.relaxErrors.map(e => e.message);
```

The first time an error is reported with nothing listening, one line is printed to the console
naming that array and the ways of handling errors properly. It appears once per page load.

To see errors as they happen instead of after the fact, turn the channel on:

```javascript
window.relaxDebug = { errors: true };
```

## RelaxError

Extends `Error` with a `context: Record<string, unknown>` field. The context contains specific information from the error source. For example, a routing error includes the route name, component tag, and route data. See each module's documentation for the context fields it provides.

## ErrorContext

The second argument passed to the handler. Call `suppress()` to prevent the error from being thrown.

```typescript
onError((error, ctx) => {
    if (error.context.route === 'optional-sidebar') {
        ctx.suppress();
        return;
    }

    showErrorDialog(error.message);
});
```

If the handler does not call `suppress()`, the `RelaxError` is thrown after the handler returns.

### Template diagnostics are the exception

An unresolved template expression is reported but not thrown, because rendering has to continue: one mistyped path should not blank out the rest of the page. To make it a hard failure, throw from the handler, or compile the template with `{ strict: true }`.

```typescript
onError((error) => {
    throw error;
});
```

## Using reportError

Application code can route errors through the same handler using `reportError()`. It returns the `RelaxError` to throw, or `null` if the handler suppressed it:

```typescript
import { reportError } from '@relax.js/core/utils';

const error = reportError('Payment processing failed', {
    orderId: 123,
    provider: 'stripe',
    statusCode: 500,
});
if (error) throw error;
```

## API Reference

### Functions

| Function | Description |
|----------|-------------|
| `onError(handler)` | Register a global error handler. Replaces any previous handler and returns the one it replaced, so a temporary handler can put the old one back. |
| `reportError(message, context)` | Create and report a `RelaxError`. Returns the error to throw, or `null` if suppressed. |

### Types

```typescript
interface ErrorContext {
    suppress(): void;
}

class RelaxError extends Error {
    context: Record<string, unknown>;
}

type ErrorHandler = (error: RelaxError, ctx: ErrorContext) => void;

function onError(handler: ErrorHandler): ErrorHandler | null;
```

Writing tests against reported errors? [Testing](testing.md) has a helper that collects them.
