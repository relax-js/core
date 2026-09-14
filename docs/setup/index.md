# Setup

Getting an application off the ground: where files go, what `main.ts` has to do in what order, and
what the build and the server need to know.

## Available Features

| Feature | Description | Use Case |
|---------|-------------|----------|
| [Bootstrapping](bootstrapping.md) | The order `main.ts` has to follow, and what breaks when it does not | Writing or fixing application startup |
| [Project structure](project-structure.md) | Where components, services, locales and styles live | Starting a project, or finding where something belongs |
| [Vite](vite.md) | TypeScript and decorator configuration | Setting up the build for the first time |
| [Build and deploy](build-and-deploy.md) | Production build, subpaths, SPA fallback | Putting the app on a server |

## Quick Start

```typescript
import './services/ApiClient';
import './components/HomePage';

import { setLocale, loadNamespaces } from '@relax.js/core/i18n';
import { defineRoutes, startRouting } from '@relax.js/core/routing';

async function bootstrap() {
    await setLocale(navigator.language || 'en');
    await loadNamespaces(['r-validation']);

    defineRoutes([{ name: 'home', path: '/', componentTagName: 'home-page' }]);
    startRouting();
}

bootstrap();
```

Service modules are imported first so their decorators run, then component modules, then
translations, and routing last. Page components are created by the router after `startRouting()`,
which is what keeps them from constructing before the things they depend on exist.

```html
<body>
    <r-route-target></r-route-target>
    <script type="module" src="/src/main.ts"></script>
</body>
```

`index.html` holds the target and nothing else. Writing a page component tag straight into the
shell constructs it before startup has finished.

## Choosing the Right Tool

- **Startup order, or a service or translation that is undefined too early?** →
  [Bootstrapping](bootstrapping.md)
- **Deciding where a file goes?** → [Project structure](project-structure.md)
- **A decorator that never runs, or a TypeScript parse error?** → [Vite](vite.md)
- **A deployed app that 404s on reload, or lives under a subpath?** →
  [Build and deploy](build-and-deploy.md)
