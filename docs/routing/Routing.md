# Routing

## Overview

A client-side routing system for single-page applications. The router:

- Matches URLs to route configurations
- Extracts typed parameters from URL segments
- Manages browser history (back/forward navigation)
- Dispatches `NavigateRouteEvent` to render components
- Supports multiple rendering targets (main content, sidebars, modals)
- Handles layout switching between different HTML shells

The router itself only handles matching and navigation. Rendering is handled by [`<r-route-target>`](RoutingTarget.md) components that listen for navigation events.

## Quick Start

```typescript
import { Route, defineRoutes, startRouting } from '@relax.js/core/routing';

const routes: Route[] = [
    { name: 'home', path: '/', componentTagName: 'home-page' },
    { name: 'users', path: '/users', componentTagName: 'user-list' },
    { name: 'user', path: '/users/:id', componentTagName: 'user-profile' },
];

defineRoutes(routes);
startRouting();
```

```html
<body>
    <nav>
        <r-link name="home">Home</r-link>
        <r-link name="users">Users</r-link>
    </nav>
    <main>
        <r-route-target></r-route-target>
    </main>
</body>
```

## Route Definition

Each route specifies how a URL maps to a component:

```typescript
interface Route {
    name?: string;              // Identifier for programmatic navigation
    path: string;               // URL pattern with parameters
    componentTagName?: string;  // Custom element tag name
    component?: WebComponentConstructor;  // Or class reference
    target?: string;            // Named r-route-target (default: unnamed)
    layout?: string;            // HTML file for different shells
    guards?: RouteGuard[];      // Access control
}
```

### URL Pattern Syntax

| Syntax | Type | Example | Matches |
|--------|------|---------|---------|
| `text` | Static segment | `/users` | Exactly "users" |
| `:name` | String parameter | `/users/:id` | `/users/john` → `{ id: 'john' }` |
| `;name` | Number parameter | `/orders/;orderId` | `/orders/123` → `{ orderId: 123 }` |

Number parameters (`;`) validate that the segment contains only digits and convert to `number` type. String parameters (`:`) accept any value and remain as `string`.

```typescript
const routes: Route[] = [
    { name: 'home', path: '/' },
    { name: 'user', path: '/users/:userName' },        // String: userName
    { name: 'order', path: '/orders/;orderId' },       // Number: orderId
    { name: 'category', path: '/shop/:category/items' }, // Mixed static + param
];
```

## Navigation

### Using RouteLink Component

The simplest way to navigate is with [`<r-link>`](RouteLink.md):

```html
<r-link name="home">Home</r-link>
<r-link name="user" param-userName="john">View Profile</r-link>
<r-link name="order" param-orderId="123">Order Details</r-link>
```

### Programmatic Navigation

Use `navigate()` for navigation from code:

```typescript
import { navigate } from '@relax.js/core/routing';

// By route name with parameters
navigate('user', { params: { userName: 'john' } });
navigate('order', { params: { orderId: 123 } });

// By URL directly
navigate('/users/john');
navigate('/orders/123');

// To a specific target
navigate('preview', { params: { id: '42' }, target: 'modal' });
```

## Multiple Targets

Routes can render in different [`<r-route-target>`](RoutingTarget.md) elements:

```html
<div class="layout">
    <aside>
        <r-route-target name="sidebar"></r-route-target>
    </aside>
    <main>
        <r-route-target></r-route-target>
    </main>
</div>
```

```typescript
const routes: Route[] = [
    { name: 'home', path: '/', componentTagName: 'home-page' },
    { name: 'menu', path: '/menu', target: 'sidebar', componentTagName: 'nav-menu' },
];
```

Routes without a `target` property render in the default (unnamed) target.

## Browser History

The router integrates with the browser's History API:

- `navigate()` calls `history.pushState()` to add entries
- Back/forward buttons trigger navigation to previous routes (components receive `loadRoute` again)
- `startRouting()` reads the current URL and navigates on page load

URLs display the route path (e.g., `/users/john`), not the HTML file.

## Layouts

Different parts of your application may need different HTML shells (navigation, sidebar presence, etc.). See [Layouts](layouts.md) for details.

```typescript
const routes: Route[] = [
    { name: 'login', path: '/login', componentTagName: 'login-page', layout: 'public' },
    { name: 'dashboard', path: '/dashboard', componentTagName: 'dashboard-page' }, // default layout
];
```

When navigating between layouts, the router redirects to the appropriate HTML file and resumes navigation.

## Route Guards

Guards control access to routes:

```typescript
import { RouteGuard, GuardResult, RouteMatchResult } from '@relax.js/core/routing';

class AuthGuard implements RouteGuard {
    check(route: RouteMatchResult): GuardResult {
        if (isAuthenticated()) {
            return GuardResult.Continue;  // Check other guards
        }
        navigate('login');
        return GuardResult.Stop;  // Prevent navigation
    }
}

const routes: Route[] = [
    { name: 'dashboard', path: '/dashboard', componentTagName: 'dashboard-page', guards: [new AuthGuard()] },
];
```

### Guard Results

| Result | Behavior |
|--------|----------|
| `Allow` | Proceed immediately, skip remaining guards |
| `Continue` | Check next guard (or proceed if none left) |
| `Stop` | Cancel navigation silently |
| `Deny` | Cancel navigation and throw `RouteGuardError` |

## Events

Navigation dispatches `NavigateRouteEvent` on `document`:

```typescript
import { NavigateRouteEvent } from '@relax.js/core/routing';

document.addEventListener('rlx.navigateRoute', (e: NavigateRouteEvent) => {
    console.log('Route:', e.route.name);
    console.log('Params:', e.routeData);
    console.log('Target:', e.routeTarget ?? 'default');
});
```

This event is typed in `HTMLElementEventMap` for full TypeScript support.

## Route Matching

For advanced use cases, match routes without navigating:

```typescript
import { matchRoute, findRouteByUrl, findRouteByName } from '@relax.js/core/routing';

// Match by URL
const result = matchRoute(routes, '/users/john');
// { route: {...}, params: { userName: 'john' }, urlSegments: ['users', 'john'] }

// Match by name
const result = matchRoute(routes, 'user', { userName: 'john' });

// Direct functions
findRouteByUrl(routes, '/users/john');
findRouteByName(routes, 'user', { userName: 'john' });
```

## Receiving Route Parameters

Components rendered by `<r-route-target>` can receive route parameters in two ways.

### loadRoute (async initialization)

Implement `loadRoute()` to run async setup before the component is added to the DOM. The component is not visible until `loadRoute()` completes.

```typescript
import { LoadRoute, RouteData } from '@relax.js/core/routing';

class OrderDetail extends HTMLElement implements LoadRoute<{ orderId: number }> {
    private order: Order;

    async loadRoute(data: { orderId: number }) {
        this.order = await fetchOrder(data.orderId);
    }

    connectedCallback() {
        this.render(this.order);
    }
}
```

### routeData (typed property)

Implement `Routable` to receive parameters as a typed property. The property is optional since it's set by the router after construction.

```typescript
import { Routable } from '@relax.js/core/routing';

class UserProfile extends HTMLElement implements Routable<{ userName: string }> {
    routeData?: { userName: string };
}
```

For convention-based usage without the interface, declare `routeData` directly on your component. The router always assigns it regardless.

Both can be combined. `loadRoute()` runs first, then `routeData` is assigned.

## Error Handling

```typescript
import { RouteError, RouteGuardError } from '@relax.js/core/routing';

try {
    navigate('unknown-route');
} catch (e) {
    if (e instanceof RouteGuardError) {
        console.log('Access denied');
    } else if (e instanceof RouteError) {
        console.log('Route not found');
    }
}
```

When no route matches, the error message lists all available routes for debugging.

Routing errors are reported through the global [error handler](../Errors.md). The error context contains:

| Field | Description |
|-------|-------------|
| `route` | Route name |
| `componentTagName` | Custom element tag name |
| `component` | Component class name (if using class reference) |
| `routeData` | Parameters extracted from the URL |

## API Reference

### Functions

| Function | Description |
|----------|-------------|
| `defineRoutes(routes)` | Register routes at startup |
| `startRouting()` | Initialize router and navigate to current URL |
| `navigate(nameOrUrl, options?)` | Navigate to a route |
| `matchRoute(routes, nameOrUrl, params?)` | Match without navigating |
| `findRouteByUrl(routes, path)` | Match by URL pattern |
| `findRouteByName(routes, name, params)` | Match by route name |

### Types

```typescript
type RouteParamType = string | number;
type RouteData = Record<string, RouteParamType>;

interface NavigateOptions {
    params?: Record<string, string | number>;
    target?: string;
    routes?: Route[];  // Override registered routes
}

interface RouteMatchResult {
    route: Route;
    params: RouteData;
    urlSegments: string[];
}

enum GuardResult {
    Allow,     // Proceed, skip remaining guards
    Deny,      // Throw RouteGuardError
    Continue,  // Check next guard
    Stop       // Cancel silently
}
```

## Related

- [`<r-route-target>`](RoutingTarget.md) - Renders routed components
- [`<r-link>`](RouteLink.md) - Declarative navigation links
- [Layouts](layouts.md) - Multiple HTML shells
