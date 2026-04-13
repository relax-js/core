Project Structure
=================

Relaxjs doesn't force a folder layout, but the one below works well for Vite projects and matches how the examples in this documentation are written.

---

## Recommended layout

```
my-app/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── public/
│   └── favicon.ico
└── src/
    ├── main.ts
    ├── styles.css
    ├── components/
    │   ├── HomePage.ts
    │   ├── UserPanel.ts
    │   └── AppShell.ts
    ├── services/
    │   ├── ApiClient.ts
    │   └── UserService.ts
    └── i18n/
        └── locales/
            ├── en/
            │   ├── r-common.json
            │   └── r-validation.json
            └── sv/
                ├── r-common.json
                └── r-validation.json
```

Each folder has one job. Beginners can skip folders they don't need yet — a small app may only have `src/main.ts` and `src/components/`.

---

## `index.html`

Vite treats `index.html` as the project entry. It loads `src/main.ts` as an ES module:

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8" />
    <title>My App</title>
    <link rel="stylesheet" href="/src/styles.css" />
</head>
<body>
    <r-route-target></r-route-target>
    <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

Keep the body minimal. Put page content inside components, not in the HTML file.

---

## `src/main.ts`

The bootstrap file. It imports services, components, and starts i18n and routing. See [Bootstrapping](bootstrapping.md) for the exact order and a full example.

---

## `src/components/`

One file per custom element. Use **PascalCase filenames** and **kebab-case tag names**:

```ts
// src/components/UserPanel.ts
import { html } from '@relax.js/core/html';

export class UserPanel extends HTMLElement {
    connectedCallback() {
        const result = html`<h2>Profile</h2>`({});
        this.appendChild(result.fragment);
    }
}

customElements.define('user-panel', UserPanel);
```

The file ends with `customElements.define(...)` so importing the file is enough to register the tag.

---

## `src/services/`

One file per injectable service. Services use `@ContainerService`:

```ts
// src/services/ApiClient.ts
import { ContainerService } from '@relax.js/core/di';

@ContainerService()
export class ApiClient {
    async get(path: string) {
        const res = await fetch(path);
        return res.json();
    }
}
```

Services are plain classes. They don't extend `HTMLElement`.

---

## `src/i18n/locales/`

Translation files, one JSON per locale per namespace:

```
src/i18n/locales/en/r-common.json
src/i18n/locales/en/r-validation.json
src/i18n/locales/sv/r-common.json
src/i18n/locales/sv/r-validation.json
```

The structure is fixed: `{locale}/{namespace}.json`. See [i18n](../i18n/i18n.md) for the file format.

---

## `public/`

Static files served at the web root. Use it for favicons, robots.txt, and assets that need stable URLs. Vite copies everything in `public/` to the build output unchanged.

Prefer imports for assets used by code:

```ts
import logoUrl from './assets/logo.svg';
```

Use `public/` only when the file must have a known fixed URL.

---

## `src/styles.css`

Global styles live in one file, imported from `index.html`. Per-component styles can be inline `<style>` tags inside each component's template, or a sibling `.css` file imported by the component module.

Relaxjs does not ship reset styles. Style semantic HTML directly and use the `.form` class to scope form layouts. See [Forms](../forms/forms.md).

---

## Scaling up

As the app grows, split `components/` by feature:

```
src/components/
├── home/
│   ├── HomePage.ts
│   └── WelcomeBanner.ts
├── profile/
│   ├── UserPanel.ts
│   └── EditForm.ts
└── shared/
    ├── AppShell.ts
    └── NavBar.ts
```

Keep `services/` flat until you have more than ten services, then group the same way.

Avoid a `utils/` dump folder. If a helper is shared by two features, move it into `src/shared/` with a clear filename.
