Getting Started
===============

Relaxjs is designed for gradual adoption. Start with full control using vanilla web components, then progressively add features like templating and routing as your app grows.

## Installation

```
npm i -S relaxjs
```

---

## Level 1: Plain Web Components

Start with standard custom elements. No Relaxjs features are needed, just your components in HTML.

```html
<!-- index.html -->
<body>
    <my-header></my-header>
    <my-content></my-content>
</body>
```

```ts
// my-header.ts
export class MyHeader extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `<h1>My App</h1>`;
    }
}
customElements.define('my-header', MyHeader);
```

You're in complete control. Relaxjs components like `<r-input>`, `<r-button>`, etc. work alongside your own.

---

## Level 2: Add Templating with `html()`

When your components get complex, use `html()` for reactive templates and data binding.

```ts
import { html } from 'relaxjs/html';

export class UserCard extends HTMLElement {
    private user = { name: 'Alice', role: 'Admin' };

    connectedCallback() {
        const result = html`
            <div class="card">
                <h2>{{name}}</h2>
                <span>{{role}}</span>
                <button onclick=${() => this.edit()}>Edit</button>
            </div>
        `(this.user);
        this.appendChild(result.fragment);
    }

    private edit() {
        // Handle edit
    }
}
customElements.define('user-card', UserCard);
```

Still no routing. You control navigation yourself.

---

## Level 3: Manual Navigation

Swap content programmatically while staying in full control.

```ts
import { html } from 'relaxjs/html';

export class AppShell extends HTMLElement {
    private main!: HTMLElement;

    connectedCallback() {
        const result = html`
            <nav>
                <a onclick=${() => this.showMain()}>Home</a>
                <a onclick=${() => this.showSettings()}>Settings</a>
            </nav>
            <main></main>
        `({});
        this.appendChild(result.fragment);
        this.main = this.querySelector('main')!;
        this.main.innerHTML = '<home-page></home-page>';
    }

    private showMain() {
        this.main.innerHTML = '<home-page></home-page>';
    }
    private showSettings() {
        this.main.innerHTML = '<settings-page></settings-page>';
    }
}
customElements.define('app-shell', AppShell);
```

---

## Level 4: Simple Routing

When your app has multiple pages and you want URL-based navigation, add routing.

```ts
import { Route, defineRoutes, startRouting } from 'relaxjs/routing';

const routes: Route[] = [
    { name: 'home', path: '/', componentTagName: 'home-page' },
    { name: 'settings', path: '/settings', componentTagName: 'settings-page' },
    { name: 'profile', path: '/profile/:id', componentTagName: 'profile-page' },
];

defineRoutes(routes);
startRouting();
```

```html
<!-- index.html -->
<body>
    <nav>
        <r-link name="home">Home</r-link>
        <r-link name="settings">Settings</r-link>
        <r-link name="profile" param-id="123">Profile</r-link>
    </nav>
    <r-route-target></r-route-target>
</body>
```

The `<r-link>` component handles navigation by route name. Use `param-*` attributes for route parameters. The `<r-route-target>` renders the matched component.

---

## Level 5: Programmatic Navigation

Use `navigate()` for code-driven navigation.

```ts
import { navigate } from 'relaxjs/routing';

// Navigate by route name with params
navigate('profile', { params: { id: '123' } });

// Navigate by path
navigate('/settings');
```

---

## Level 6: Route Guards

Protect routes with guards when you need authentication or authorization.

```ts
// guards.ts
import { RouteGuard, RouteMatchResult, GuardResult, navigate } from 'relaxjs/routing';

export class AuthGuard implements RouteGuard {
    check(route: RouteMatchResult): GuardResult {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('login');
            return GuardResult.Stop;
        }
        return GuardResult.Continue;
    }
}
```

```ts
// app.ts
import { Route, defineRoutes } from 'relaxjs/routing';
import { AuthGuard } from './guards';

const authGuard = new AuthGuard();

const routes: Route[] = [
    { name: 'login', path: '/login', componentTagName: 'login-page' },
    { name: 'home', path: '/', componentTagName: 'home-page', guards: [authGuard] },
    { name: 'admin', path: '/admin', componentTagName: 'admin-page', guards: [authGuard] },
];

defineRoutes(routes);
```

---

## Level 7: Layouts

Use different HTML pages for distinct UI structures. Each layout is a separate static HTML file.

```
/index.html      <- default layout (authenticated app)
/public.html     <- public layout (login, register)
```

```ts
const routes: Route[] = [
    // Routes using public.html
    { name: 'login', path: '/login', componentTagName: 'login-page', layout: 'public' },
    { name: 'register', path: '/register', componentTagName: 'register-page', layout: 'public' },

    // Routes using index.html (default)
    { name: 'dashboard', path: '/', componentTagName: 'dashboard-page' },
    { name: 'settings', path: '/settings', componentTagName: 'settings-page' },
];
```

When navigating between layouts, the router redirects to the appropriate HTML file automatically.

---

## Summary

| Level | Features | Use When |
|-------|----------|----------|
| 1 | Plain components | Starting out, simple pages |
| 2 | `html()` templating | Complex component rendering |
| 3 | Manual navigation | Few views, full control needed |
| 4 | Basic routing | Multiple pages, URL sync needed |
| 5 | `navigate()` | Code-driven navigation |
| 6 | Guards | Auth/access control |
| 7 | Layouts | Shared UI structure |

Start at Level 1 and add features as your app requires them. You're always in control.
