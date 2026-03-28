# Error Handling

Global error handling for Relaxjs. Intercept errors before they throw, inspect structured context, and decide whether to suppress them.

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
| `onError(handler)` | Register a global error handler. Replaces any previous handler. |
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
```
