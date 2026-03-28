# Relaxjs

**Ship faster with less code.**

Web Component library with routing, forms, DI, templating, and i18n. No virtual DOM, no build magic, no surprise re-renders.

- ~20KB gzipped, one dependency
- Native Web Components, zero vendor lock-in
- Use only what you need: forms, routing, DI, i18n are all independent
- No build step required, no compiler, no CLI
- Standard HTML, standard DOM, standard async/await

## Why Relaxjs?

Modern frameworks solve problems you might not have. Relaxjs takes the opposite approach:

| Framework Approach | Relaxjs Approach |
|-------------------|------------------|
| Virtual DOM diffing | Direct DOM manipulation |
| Reactive state management | Explicit updates |
| Custom template syntax | Standard HTML |
| Framework-specific lifecycle | Native Web Component lifecycle |
| Magic re-renders | You control what updates |
| Custom rendering pipeline | Native async/await everywhere |

> [Read the detailed comparison](docs/WhyRelaxjs.md)

**The result:** You always know *when* something ran, *why* it ran, and *what* triggered it.

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

You write less boilerplate while keeping full control.

## Installation

```bash
npm install @relax.js/core
```

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

## What's Included

| Feature | Description |
|---------|-------------|
| **Form Utilities** | Read/write forms, type conversion, validation |
| **Routing** | Named routes, typed parameters, guards, layouts, multiple targets |
| **HTML Templates** | `html` tagged templates with data binding and in-place updates |
| **HTTP Client** | Type-safe `get`/`post`/`put`/`del` with automatic JWT |
| **WebSocket** | Auto-reconnect, message queuing, typed messages |
| **SSE** | Server-Sent Events dispatched as DOM events |
| **Dependency Injection** | Decorator-based DI with constructor and property injection |
| **i18n** | ICU message format, pluralization, locale-aware formatting |
| **Pipes** | 15 built-in data transformations for templates |

## Where Relaxjs Fits

Relaxjs is a good choice when:

- You're building a **small-to-medium SPA** where you want direct control over the DOM
- Your team prefers **vanilla Web Components** over framework abstractions
- You want **gradual adoption** - use only the parts you need, no all-or-nothing buy-in
- **Bundle size and simplicity** matter more than ecosystem breadth
- You want to **understand what your code does** - no hidden re-renders, no magic proxies, no compiler transforms

## Where Relaxjs Doesn't Fit

Relaxjs is not the right tool for everything:

- **Large-scale apps with complex state** - Relaxjs has no reactive state management, no global store, no computed properties. If your UI has dozens of interdependent data flows, you'll be writing a lot of manual update logic.
- **Server-side rendering / static site generation** - Relaxjs is client-only. If you need SEO, fast first-paint from the server, or pre-rendered pages, look at Next.js, Nuxt, or SvelteKit.
- **Big teams that need a large talent pool** - React and Angular developers are everywhere. Finding developers who know Relaxjs (or are willing to learn a small library) is harder.
- **Rich ecosystem needs** - There's no component marketplace, no DevTools extension, no community middleware. You build what you need or use vanilla JS libraries.
- **Mobile / native targets** - No React Native equivalent, no Ionic integration. Relaxjs is for the browser.

## How It Compares

| | Relaxjs | React | Angular | Vue | Svelte |
|---|---|---|---|---|---|
| **Approach** | Web Components | Virtual DOM | Full framework | Virtual DOM | Compiler |
| **Bundle size** | ~20KB gzipped | ~45KB | ~150KB+ | ~33KB | ~2KB runtime |
| **Learning curve** | Low (vanilla TS) | Medium | High | Medium | Low-Medium |
| **State management** | Explicit DOM updates | Hooks / Redux / Zustand | RxJS / Signals | Reactive refs | Stores / runes |
| **Routing** | Built-in (simple) | react-router (separate) | Built-in (full) | vue-router (separate) | SvelteKit |
| **Forms** | Built-in (HTML5 native) | Controlled / uncontrolled | Reactive forms | v-model | bind: |
| **SSR** | No | Yes | Yes | Yes | Yes |
| **Ecosystem** | Small | Massive | Large | Large | Growing |
| **DI** | Built-in | None (Context API) | Built-in | Provide / Inject | None |
| **i18n** | Built-in (ICU) | i18next etc. | Built-in | vue-i18n | i18next etc. |
| **DevTools** | Browser DevTools | React DevTools | Angular DevTools | Vue DevTools | Svelte DevTools |
| **Community size** | Small | Very large | Large | Large | Medium |

## Philosophy

This isn't a framework - it's a library. Use what you need:

- Need just form handling? Import `setFormData` and `readData`.
- Need routing? Add `defineRoutes` and `r-route-target`.
- Need everything? It's all there.

No buy-in required. No migration path to worry about. 

## Documentation

- [Why Relaxjs?](docs/WhyRelaxjs.md) - Detailed comparison with frameworks
- [Getting Started](docs/GettingStarted.md) - Progressive adoption guide (7 levels)
- [Architecture](docs/Architecture.md)
- [Form Utilities](docs/forms/forms.md) - Validation, reading/writing, custom form components
- [Routing](docs/routing/Routing.md) - Routes, guards, layouts, navigation
- [HTML Templates](docs/html/html.md) - Tagged templates with data binding
- [HTTP & WebSocket](docs/http/HttpClient.md) - REST calls, WebSocket, SSE
- [Dependency Injection](docs/DependencyInjection.md)
- [i18n](docs/i18n/i18n.md) - Translations, ICU format, locale switching
- [Pipes](docs/Pipes.md) - Data transformations for templates
- [Utilities](docs/utilities.md) - Sequential IDs, LinkedList, helpers

## Browser Support

Works in all browsers that support Web Components (Chrome, Firefox, Safari, Edge).

## License

MIT
