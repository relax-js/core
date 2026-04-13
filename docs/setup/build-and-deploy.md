Build and Deploy
================

Relaxjs apps build and deploy like any Vite + TypeScript project. This page covers the two things beginners get wrong: the **base path** setting and the **SPA fallback** on the hosting side.

---

## Building for production

```bash
npm run build
```

Vite outputs static files to `dist/`:

```
dist/
├── index.html
├── assets/
│   ├── index-a1b2c3.js
│   └── index-d4e5f6.css
└── favicon.ico
```

All paths inside `dist/` are relative to the root of your domain by default. If you are deploying to `https://example.com/`, you can upload `dist/` as-is.

---

## Deploying to a subpath

If the app lives at `https://example.com/my-app/` instead of the domain root, set `base` in `vite.config.ts`:

```ts
import { defineConfig } from 'vite';

export default defineConfig({
    base: '/my-app/',
});
```

The trailing slash matters. With this set, Vite rewrites every asset URL in `index.html` to start with `/my-app/`, and relaxjs routing respects it for `<r-link>` and `navigate(...)`.

If you deploy to both a subpath (staging) and the root (production), read the base from an environment variable:

```ts
export default defineConfig({
    base: process.env.VITE_BASE ?? '/',
});
```

---

## SPA fallback (the most common deployment bug)

Relaxjs routing uses the History API. A route like `/profile/42` is a URL the browser shows, but it is **not** a file on disk. When the user reloads that URL, the server looks for `/profile/42/index.html`, doesn't find it, and returns a 404.

The fix is to tell the server: *for any URL that is not a real file, serve `index.html` instead*. How to configure this depends on the host.

### Nginx

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

### Apache (`.htaccess`)

```apache
RewriteEngine On
RewriteBase /
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

### Netlify (`netlify.toml` or `_redirects`)

```
/*    /index.html   200
```

### Vercel (`vercel.json`)

```json
{
    "rewrites": [
        { "source": "/(.*)", "destination": "/index.html" }
    ]
}
```

### Static file servers (local testing)

For testing the built app locally:

```bash
npx serve dist --single
```

The `--single` flag enables SPA fallback.

---

## Multiple HTML layouts

[Level 7](../GettingStarted.md) of the Getting Started guide introduces layouts: separate HTML files for distinct UI structures (for example, `index.html` for the authenticated app and `public.html` for login/register pages).

Vite builds every HTML file listed in the `rollupOptions.input` config. Add each layout:

```ts
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                public: resolve(__dirname, 'public.html'),
            },
        },
    },
});
```

The SPA fallback must still point at the correct layout. With layouts, the rewrite rules get more nuanced: only fall back to `index.html` for authenticated routes, and to `public.html` for public routes. Most hosts handle this with path-prefixed rewrite rules:

```
/login       → /public.html
/register    → /public.html
/*           → /index.html
```

---

## Environment variables

Vite exposes variables prefixed with `VITE_` as `import.meta.env.VITE_*` at build time:

```
# .env.production
VITE_API_URL=https://api.example.com
```

```ts
const apiUrl = import.meta.env.VITE_API_URL;
```

Do not put secrets here. Everything in `import.meta.env` ends up in the public bundle.

---

## Checklist before deploying

- [ ] `npm run build` succeeds with no warnings
- [ ] `base` in `vite.config.ts` matches the deployed URL path
- [ ] SPA fallback is configured on the host
- [ ] Environment variables are set for the target (dev, staging, prod)
- [ ] `index.html` references assets via relative URLs (Vite handles this automatically when `base` is correct)
- [ ] `public/` contains only files that need fixed URLs

---

## Troubleshooting

### Assets load from the wrong path

The `base` config does not match the deploy path. For `https://example.com/my-app/`, `base` must be `/my-app/` with a trailing slash.

### Reloading a route shows 404

The SPA fallback is missing. Configure the host to serve `index.html` for unknown paths.

### Blank page in production, works in dev

Check the browser console. Common causes:
- A service was imported *after* a component that injects it
- `import.meta.env.VITE_*` is missing (undefined at runtime)
- A translation namespace failed to load because the JSON file was not copied to `dist/`

Translation files inside `src/i18n/locales/` are loaded via `fetch()` at runtime, so they need to be reachable from the browser. Either move them to `public/i18n/locales/` or import each JSON statically if your i18n loader is configured for it.
