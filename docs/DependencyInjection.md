# Dependency Injection

A lightweight IoC container for managing service dependencies in your application.

## Overview

The DI system provides:
- Constructor injection
- Property injection
- Singleton and scoped lifetimes
- Decorator-based registration

## Quick Start

```typescript
import { ContainerService, container } from '@relax.js/core/di';

@ContainerService()
class LoggerService {
    log(message: string) {
        console.log(`[LOG] ${message}`);
    }
}

// Resolve and use
const logger = container.resolve(LoggerService);
logger.log('Hello!');
```

## Registration

Use the `@ContainerService` decorator to register services:

```typescript
@ContainerService()
class ConfigService {
    apiUrl = '/api/v1';
}

@ContainerService({ inject: [ConfigService] })
class ApiClient {
    constructor(private config: ConfigService) {}

    fetch(path: string) {
        return fetch(this.config.apiUrl + path);
    }
}
```

### Manual Registration

For cases where you can't use decorators (e.g. registering an existing instance):

```typescript
import { serviceCollection } from '@relax.js/core/di';

// Register with existing instance
const config = { apiUrl: '/api' };
serviceCollection.register(ConfigService, {
    inject: [],
    instance: config
});

// Register with custom key
serviceCollection.register(CacheService, {
    key: 'primaryCache',
    scope: 'global',
    inject: []
});
```

## Scopes

### Global (Singleton)

Same instance returned every time:

```typescript
@ContainerService({ scope: 'global' })
class DatabaseConnection {
    // ...
}

const db1 = container.resolve(DatabaseConnection);
const db2 = container.resolve(DatabaseConnection);
// db1 === db2
```

### Closest (Scoped)

New instance for each container scope:

```typescript
@ContainerService({ scope: 'closest' })
class RequestContext {
    // ...
}
```

## Constructor Injection

Dependencies are passed to the constructor in order:

```typescript
@ContainerService({
    inject: [LoggerService, ConfigService, DatabaseConnection]
})
class UserRepository {
    constructor(
        private logger: LoggerService,
        private config: ConfigService,
        private db: DatabaseConnection
    ) {}
}
```

## Property Injection

### Using the `@Inject` Decorator

The `@Inject` decorator resolves a dependency and assigns it to a class field:

```typescript
import { ContainerService, Inject } from '@relax.js/core/di';

@ContainerService({ inject: [] })
class OrderService {
    @Inject(LoggerService)
    private logger!: LoggerService;

    @Inject('primaryCache')  // resolve by string key
    private cache!: CacheService;
}
```

`@Inject` resolves the dependency immediately when the class is instantiated, so the field is available in all methods (including the constructor body).

### Using the `properties` Option

Alternatively, declare property injection in the registration options:

```typescript
@ContainerService({
    inject: [],
    properties: {
        logger: LoggerService,
        cache: 'primaryCache'  // string key
    }
})
class OrderService {
    logger!: LoggerService;
    cache!: CacheService;
}
```

## Integration with Web Components

```typescript
@ContainerService({ inject: [UserService] })
class UserProfileComponent extends HTMLElement {
    constructor(private userService: UserService) {
        super();
    }

    connectedCallback() {
        this.loadProfile();
    }

    async loadProfile() {
        const user = await this.userService.getCurrentUser();
        this.render(user);
    }
}

customElements.define('user-profile', UserProfileComponent);
```

## Resolving Dependencies

```typescript
// By class
const service = container.resolve(MyService);

// By string key
const cache = container.resolve<CacheService>('primaryCache');
```

## Error Handling

All DI errors go through the global [`onError`](Errors.md) handler, so you can log, display, or suppress them.

### Resolution Errors

Thrown when `resolve()` cannot find a registered service.

| Field | Description |
|-------|-------------|
| `service` | The class name or string key that was requested |
| `registeredTypes` | Array of all registered class names |
| `registeredKeys` | Array of all registered string keys |

```
RelaxError: Failed to resolve service 'MyService'
  { service: 'MyService', registeredTypes: ['LoggerService', 'ConfigService'], registeredKeys: ['primaryCache'] }
```

### Registration Errors

Thrown during `register()` or `registerByType()` to catch configuration mistakes early.

| Error | Context | Cause |
|-------|---------|-------|
| Service name collision | `{ service }` | Two different classes registered with the same class name |
| Service key already registered | `{ key, existingClass, newClass }` | A string key is reused for a different class |
| Instance and inject conflict | `{ service }` | Both `instance` and non-empty `inject` provided (`inject` is ignored) |

### Suppressing Errors

```typescript
import { onError } from '@relax.js/core/utils';

onError((error, ctx) => {
    if (error.context.service === 'OptionalPlugin') {
        ctx.suppress();
        return;
    }
    console.error(error.message, error.context);
});
```

## Best Practices

1. **Register early**: Register all services at application startup
2. **Prefer constructor injection**: More explicit than property injection
3. **Use global scope for stateless services**: Like loggers, config
4. **Use closest scope for request-specific data**: Like user context
5. **Avoid circular dependencies**: Restructure to use events or mediators
