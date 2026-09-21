# Routing

Client-side routing: the router matches URLs and dispatches a navigation event, and
`<r-route-target>` listens for that event and renders the page component. Both halves have to be
present, or the URL changes and nothing appears.

## Available Features

| Feature | Description | Use Case |
|---------|-------------|----------|
| [Routing](Routing.md) | `defineRoutes`, `startRouting`, `navigate`, path parameters, guards | Defining the route table and moving between pages |
| [&lt;r-route-target&gt;](RoutingTarget.md) | The element that renders the matched component | Placing pages, sidebars and modals in the shell |
| [&lt;r-link&gt;](RouteLink.md) | Anchor element that navigates by route name | Links in markup, including back and forward |
| [Layouts](layouts.md) | Several HTML shells selected per route | A public shell and a signed-in shell in one app |

## Quick Start

```typescript
import { defineRoutes, startRouting } from '@relax.js/core/routing';
import './pages/HomePage';
import './pages/UserPage';

defineRoutes([
    { name: 'home', path: '/', componentTagName: 'home-page' },
    { name: 'user', path: '/users/;id', componentTagName: 'user-page' },
]);

startRouting();
```

`defineRoutes` always comes first and `startRouting` last, after services, components and
translations are ready.

```html
<body>
    <r-route-target></r-route-target>
</body>
```

`:name` is a string segment, `;name` is a numeric segment that arrives as a `number`. Query string
values are merged into the route parameters.

```typescript
class UserPage extends HTMLElement {
    async loadRoute(data: { id: number }) {
        this.user = await api.getUser(data.id);
    }
}
```

`loadRoute` runs before the element enters the DOM, so it is where async loading belongs.

## Choosing the Right Tool

- **Defining routes, or navigating from code?** → [Routing](Routing.md)
- **Deciding where a page renders, or rendering into a dialog?** → [&lt;r-route-target&gt;](RoutingTarget.md)
- **Navigating from markup?** → [&lt;r-link&gt;](RouteLink.md)
- **Different shells for different parts of the app?** → [Layouts](layouts.md)
- **Public pages that search engines and link previews must read?** → [Crawlable pages](../seo.md)
- **A URL changes but nothing renders?** → Set `window.relaxDebug = { routing: true }` and see
  [Debugging](../Debugging.md). The usual cause is a navigation aimed at a target that is not
  connected, which is reported as an error once it is clear no target is coming.
