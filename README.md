# Relaxjs

**Ship faster with less code.**

Web Component library with routing, forms, DI, templating, and i18n. No virtual DOM, no build magic, no surprise re-renders.

- No runtime dependencies
- Native Web Components, zero vendor lock-in
- Use only what you need: forms, routing, DI, i18n are all independent
- No build step required, no compiler, no CLI
- Standard DOM, standard async/await, HTML templates with a small expression syntax

You always know *when* something ran, *why* it ran, and *what* triggered it.

> [Why Relaxjs?](docs/WhyRelaxjs.md) compares this with the framework approach, point by point.

## What Relaxjs Adds

Web Components give you encapsulation and lifecycle hooks. Relaxjs fills the gaps:

| Vanilla Web Components | With Relaxjs |
|------------------------|--------------|
| Manual form serialization | `readData(form)` returns typed objects (send it directly to backend) |
| Query string parsing | Named routes with typed parameters |
| DIY validation logic | `FormValidator` with HTML5 integration |
| No component library | Table, Tabs, TreeView, Menu ready to use |
| Manual service wiring | Decorator-based dependency injection |
| Raw fetch boilerplate | Simple HTTP client for backend calls |

## Installation

```bash
npm install @relax.js/core
```

Ships as ES modules only. `@relax.js/core` and its sub-paths (`/routing`, `/forms`, `/http`, ...) share one instance of every module, so an `onError()` handler registered through one sees what the others report.

Works in all browsers that support Web Components (Chrome, Firefox, Safari, Edge).

## Coding Agents

The rules an agent needs in order to write Relaxjs ship with the package. Install them into your project:

```bash
npx @relax.js/core init-agents
```

That writes a skill per area into `.claude/skills/`: the core model, then templates, forms, routing, services, testing and setup. Each one carries what an agent gets wrong from habit and links into the documentation for the rest. Tools without skill support can be pointed straight at `node_modules/@relax.js/core/skills/relaxjs/SKILL.md`.

Agents cannot run your app, so they verify statically and through tests. `npx @relax.js/core check` resolves every expression in a typed `compileTemplate<T, F>` template against those types and reports mistakes as `tsc`-style lines. `@relax.js/core/testing` gives them `mount()`, `flush()` and `captureRelaxErrors()`, which turns a template typo into a failing assertion instead of a blank element, plus `fakeServer()` for the requests a component makes and `mountRouting()` to navigate to a page the way the app does and get the rendered component back.

> [Working in a Relaxjs project](docs/AGENTS.md)

## Quick Examples

### Form Handling

Read and write form data with automatic type conversion:

```typescript
import { setFormData, readData } from '@relax.js/core';

// Populate a form from an object
const user = { name: 'John', email: 'john@example.com', age: 30 };
setFormData(form, user);

// Read form data back (with types!)
const data = readData(form);
// { name: 'John', email: 'john@example.com', age: 30 }
```

Supports nested objects (`user.address.city`), arrays (`tags[]`), and automatic type conversion for numbers, booleans, and dates.

> [Form utilities docs](docs/forms/forms.md)

### Client-Side Routing

Define routes and let the router handle navigation:

```typescript
import { defineRoutes, navigate, startRouting } from '@relax.js/core';

defineRoutes([
    { name: 'home', path: '/', componentTagName: 'app-home' },
    { name: 'user', path: '/users/:id', componentTagName: 'app-user' },
    { name: 'settings', path: '/settings', componentTagName: 'app-settings' }
]);

startRouting();

// Navigate programmatically
navigate('user', { params: { id: '123' } });
```

```html
<r-route-target></r-route-target>
```

> [Routing docs](docs/routing/Routing.md)

### Form Validation

HTML5-style validation with custom rules and error summaries:

```typescript
import { FormValidator } from '@relax.js/core';

const validator = new FormValidator(form, {
    useSummary: true,
    submitCallback: () => saveData()
});
```

> [Validation docs](docs/forms/validation.md)

## Where Relaxjs Doesn't Fit

It suits a small-to-medium SPA where you want direct control over the DOM and adopt only the parts you need. It is not the right tool for everything:

- **Large-scale apps with complex state** - Relaxjs has no reactive state management, no global store, no computed properties. If your UI has dozens of interdependent data flows, you'll be writing a lot of manual update logic.
- **Server-side rendering / static site generation** - Relaxjs is client-only. If you need SEO, fast first-paint from the server, or pre-rendered pages, look at Next.js, Nuxt, or SvelteKit.
- **Big teams that need a large talent pool** - React and Angular developers are everywhere. Finding developers who know Relaxjs (or are willing to learn a small library) is harder.
- **Rich ecosystem needs** - There's no component marketplace, no DevTools extension, no community middleware. You build what you need or use vanilla JS libraries.
- **Mobile / native targets** - No React Native equivalent, no Ionic integration. Relaxjs is for the browser.

## Documentation

- [Why Relaxjs?](docs/WhyRelaxjs.md) - Detailed comparison with frameworks
- [Getting Started](docs/GettingStarted.md) - Progressive adoption guide
- [Working in a Relaxjs project](docs/AGENTS.md) - Agent skills, what each covers, and how to install them
- [Architecture](docs/Architecture.md)
- [Building a Form Page](docs/forms/form-page.md) - Template, load, validate and save in one component
- [Form Utilities](docs/forms/forms.md) - Validation, reading/writing, custom form components
- [Routing](docs/routing/Routing.md) - Routes, guards, layouts, navigation
- [HTML Templates](docs/html/html.md) - Tagged templates with data binding
- [Checking templates](docs/html/checking.md) - `npx @relax.js/core check` verifies template expressions against their types before the app runs
- [HTTP & WebSocket](docs/http/HttpClient.md) - REST calls, WebSocket, SSE
- [Dependency Injection](docs/DependencyInjection.md)
- [i18n](docs/i18n/i18n.md) - Translations, ICU format, locale switching
- [Pipes](docs/Pipes.md) - Data transformations for templates
- [Testing](docs/testing.md) - Mounting components, faking the server, navigating to pages, asserting on reported errors
- [Utilities](docs/utilities.md) - Sequential IDs, LinkedList, helpers

## License

MIT
