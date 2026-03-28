Layouts
=======

Layouts allow different HTML pages to serve as shells for different parts of your application. Common use cases:

- Public pages (login, register) with minimal UI
- Authenticated pages with navigation, sidebar, header
- Admin pages with different structure

## How It Works

Each layout is a separate static HTML file. When navigating to a route with a different layout than the current one, the router:

1. Stores the target route name and params in `sessionStorage`
2. Redirects the browser to the new HTML file
3. On the new page, `startRouting()` reads from `sessionStorage` and navigates to the intended route
4. The URL is updated to show the route path (not the `.html` file)

## File Structure

```
/index.html      <- default layout (no layout property needed)
/public.html     <- public layout
/admin.html      <- admin layout
```

## Route Configuration

```ts
import { Route, defineRoutes, startRouting } from '@relax.js/core/routing';

const routes: Route[] = [
    // Uses public.html
    { name: 'login', path: '/login', componentTagName: 'login-page', layout: 'public' },
    { name: 'register', path: '/register', componentTagName: 'register-page', layout: 'public' },

    // Uses index.html (default - no layout property needed)
    { name: 'home', path: '/', componentTagName: 'home-page' },
    { name: 'settings', path: '/settings', componentTagName: 'settings-page' },

    // Uses admin.html
    { name: 'admin', path: '/admin', componentTagName: 'admin-dashboard', layout: 'admin' },
];

defineRoutes(routes);
startRouting();
```

## Layout HTML Files

Each layout file must:
- Include `<r-route-target>` where routed components render
- Import and call `defineRoutes()` and `startRouting()`
- Register all components that may be rendered in that layout

### index.html (default layout)

```html
<!DOCTYPE html>
<html>
<head>
    <title>My App</title>
    <script type="module" src="/src/app.ts"></script>
</head>
<body>
    <app-header></app-header>
    <app-sidebar></app-sidebar>
    <main>
        <r-route-target></r-route-target>
    </main>
</body>
</html>
```

### public.html

```html
<!DOCTYPE html>
<html>
<head>
    <title>My App - Login</title>
    <script type="module" src="/src/app.ts"></script>
</head>
<body>
    <div class="auth-container">
        <r-route-target></r-route-target>
    </div>
</body>
</html>
```

## Layout Detection

The router determines the current layout from the URL:

| URL | Detected Layout |
|-----|-----------------|
| `/index.html` | `default` |
| `/public.html` | `public` |
| `/admin.html` | `admin` |
| `/` or `/settings` | `default` (inferred) |

## Navigation Flow

When a user on `/settings` (default layout) navigates to `login` (public layout):

1. `navigate('login')` is called
2. Router detects layout mismatch: `default` !== `public`
3. Stores `{ routeName: 'login', params: {} }` in `sessionStorage`
4. Redirects browser to `/public.html#layout`
5. `public.html` loads and calls `startRouting()`
6. `startRouting()` reads from `sessionStorage`, calls `navigate('login')`
7. URL updates to `/login`, `login-page` component renders

## Shared Routes Configuration

Since all layout files need the same routes, keep route configuration in a shared module:

```ts
// routes.ts
import { Route } from '@relax.js/core/routing';

export const routes: Route[] = [
    { name: 'login', path: '/login', componentTagName: 'login-page', layout: 'public' },
    { name: 'home', path: '/', componentTagName: 'home-page' },
    // ...
];
```

```ts
// app.ts (imported by all layout HTML files)
import { defineRoutes, startRouting } from '@relax.js/core/routing';
import { routes } from './routes';

defineRoutes(routes);
startRouting();
```

## Error Handling

If a layout redirect fails (e.g., the HTML file doesn't exist), the router throws an error:

```
A redirect failed, does the requested layout exist? "admin"?
```

The `#layout` hash in the redirect URL is used to detect this: if the hash is still present after redirect, something went wrong.

## Security Considerations

Layout files are static HTML served to the browser. This has security implications:

### Route Exposure

A file like `admin.html` contains (or imports) route configurations that reveal admin URLs. Anyone requesting the file can see what endpoints exist, even without authentication.

### Client-Side Guards Are Not Security

Route guards in Relaxjs prevent components from rendering, but they don't protect data. An attacker can:
- Read the JavaScript bundle to find all routes
- Call backend APIs directly, bypassing the UI entirely

**The real security boundary is always your backend API.** Every API endpoint must validate authentication and authorization.

### Server-Side Protection

For defense in depth, protect sensitive layout files at the HTTP server level:

**Nginx:**
```nginx
location /admin.html {
    auth_request /auth/verify;
    error_page 401 = @unauthorized;
}

location @unauthorized {
    return 302 /login;
}
```

**Express:**
```ts
app.get('/admin.html', verifyJwt, (req, res) => {
    res.sendFile('admin.html');
});
```

**Caddy:**
```
admin.html {
    forward_auth /auth/verify
}
```

### Alternatives

If hiding routes is important:

1. **Single layout with dynamic navigation**: Load admin navigation only after auth verification
2. **Separate builds**: Build different bundles for public/authenticated/admin with different route configurations
3. **Server-rendered shells**: Generate layout HTML server-side based on user role

### Recommendation

1. Always secure your backend APIs with proper authentication/authorization
2. Protect sensitive layout files at the server level in production
3. Don't rely on client-side guards for security. They're for UX, not protection
