Bootstrapping
=============

Relaxjs apps need three subsystems started in the right order: **dependency injection**, **i18n**, and **routing** (if used). Getting the order wrong produces "why is my service undefined?" bugs that are hard to trace.

This page shows the safe pattern for `src/main.ts`.

---

## The rule

> Register services **before** any component that uses `@Inject` is constructed.
> Load i18n namespaces **before** you render anything that calls `t()`.
> Start routing **last**.

A custom element is constructed the moment two things line up: the tag is defined with `customElements.define(...)` **and** the tag appears in the DOM. If DI is not ready at that moment, the component's `@Inject` fields become `undefined`.

---

## Minimal `main.ts`

```ts
// 1. Import service modules first so their @ContainerService decorators run.
import './services/ApiClient';
import './services/UserService';

// 2. Import component modules. Each file ends with customElements.define(...)
//    but the tags don't render yet unless they are in index.html.
import './components/HomePage';
import './components/UserPanel';

// 3. Relaxjs subsystems
import { setLocale, loadNamespaces } from '@relax.js/core/i18n';
import { defineRoutes, startRouting } from '@relax.js/core/routing';

async function bootstrap() {
    // i18n before anything calls t()
    await setLocale(navigator.language || 'en');
    await loadNamespaces(['r-validation']);

    // Routing last — this is when components start mounting
    defineRoutes([
        { name: 'home', path: '/', componentTagName: 'home-page' },
        { name: 'profile', path: '/profile/:id', componentTagName: 'user-panel' },
    ]);
    startRouting();
}

bootstrap();
```

The matching `index.html`:

```html
<!DOCTYPE html>
<html>
<body>
    <r-route-target></r-route-target>
    <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

Notice the body contains **only** `<r-route-target>`. Page components are created by the router after `startRouting()` runs, so they never construct before DI and i18n are ready.

A page loaded on first visit with the route's `load: () => import('./pages/ProfilePage')` is not imported in `main.ts` at all. Its module imports the services it injects, and those run before the page is defined, so the order is kept by the module itself. See [Loading a page on first visit](../routing/Routing.md#loading-a-page-on-first-visit).

---

## Why the import order matters

TypeScript imports run top-to-bottom. Decorator side effects (registering a service, defining a custom element) happen at import time.

If you flip the order:

```ts
import './components/UserPanel';   // ❌ custom element defined
import './services/UserService';   // ❌ service registered AFTER
```

...and `<user-panel>` appears in `index.html`, the browser constructs it before `UserService` is registered. Every `@Inject(UserService)` field resolves to `undefined`, and each one is reported through [onError()](../Errors.md) with the tag, the field and the service it was waiting for.

**Always import services before components.** Then import subsystems (i18n, routing) last.

---

## Manual registration (when you can't use decorators)

Some services wrap existing instances (config objects, third-party clients). Register them before the `bootstrap()` call:

```ts
import { serviceCollection } from '@relax.js/core/di';

const config = {
    apiUrl: import.meta.env.VITE_API_URL ?? '/api',
};

serviceCollection.register(ConfigService, {
    inject: [],
    instance: config,
});
```

Do this at the top of `main.ts`, before the subsystem imports.

---

## Components that don't use routing

If your app uses [Level 1-3 patterns](../GettingStarted.md) (plain components, no router), the same rule applies, just without `startRouting()`:

```ts
import './services/ApiClient';
import './components/AppShell';   // defines <app-shell>

import { setLocale, loadNamespaces } from '@relax.js/core/i18n';

async function bootstrap() {
    await setLocale('en');
    await loadNamespaces(['r-validation']);

    // Insert the root component now that everything is ready
    document.body.appendChild(document.createElement('app-shell'));
}

bootstrap();
```

Key point: the root component is appended **after** async setup, not written directly in `index.html`.

---

## Common mistakes

### `@Inject` field is undefined

Reported as `<user-panel> was created before its service was registered`. Cause: a component constructed before its service was registered. Fix: move the service import above the component import in `main.ts`, and keep the component's tag out of `index.html`.

### `t('...')` returns the key unchanged

Reported as `t('shop:title') returned the key because the 'shop' translations are not loaded`, once per namespace. Cause: the namespace wasn't loaded, or the component rendered before `setLocale()` finished. Fix: `await loadNamespaces([...])` before rendering, and re-render on `localechange` if the user can switch locales.

A key missing from a loaded namespace is not reported this way; register [`onMissingTranslation()`](../i18n/i18n.md) for those.

### Routing renders a blank page

Reported as `startRouting() was called before defineRoutes()`. Fix: always call `defineRoutes` first.

---

## Summary

1. Import service modules (side-effect imports run `@ContainerService`)
2. Import component modules (`customElements.define`)
3. `await setLocale(...)` and `await loadNamespaces(...)`
4. `defineRoutes(...)` then `startRouting()`

If you follow this order every time, components never see an undefined service or a missing translation.
