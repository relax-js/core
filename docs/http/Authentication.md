# Authentication with OpenID Connect

Relax.js has no built-in OIDC client. Signing in against an identity provider (Entra ID, Auth0, Keycloak, Okta and so on) is done in one of two ways, and the http module has two hooks that connect either one to every request:

| Option | Purpose |
|--------|---------|
| `getAccessToken` | Supplies the bearer token, sync or async, before each request |
| `onUnauthorized` | Called once per 401 response, in one place for the whole app |

Both are set with `configure()` from `@relax.js/core/http` and apply to `get`, `post`, `put`, `del`, `request` and the fetch transport of `SSEClient`.

## Pick a setup

**Backend-for-frontend (recommended).** Your server runs the OIDC code flow, keeps the tokens, and gives the browser an `HttpOnly` session cookie. JavaScript never sees a token, so an XSS bug cannot steal one. This is the setup the IETF draft "OAuth 2.0 for Browser-Based Applications" recommends.

**Tokens in the browser.** A library such as [oidc-client-ts](https://github.com/authts/oidc-client-ts) runs the code flow with PKCE in the browser and holds the tokens. Use it when there is no server of your own to put in front of the API, for example a static site that calls a third-party API.

## Backend-for-frontend

The server exposes three endpoints, for example `/auth/login`, `/auth/logout` and `/auth/me`. The browser sends the session cookie automatically on same-origin requests, so there is no token to configure.

```typescript
import { configure, get } from '@relax.js/core/http';

configure({
    baseUrl: '/api',
    bearerTokenName: null,
    onUnauthorized: () => {
        const returnUrl = encodeURIComponent(location.pathname + location.search);
        location.assign(`/auth/login?returnUrl=${returnUrl}`);
    },
});
```

For an API on another origin, pass `credentials: 'include'` per request:

```typescript
await get('https://api.example.com/orders', undefined, { credentials: 'include' });
```

Route guards are synchronous, so load the session before routing starts:

```typescript
import { get } from '@relax.js/core/http';
import { defineRoutes, startRouting } from '@relax.js/core/routing';

const me = await get('/auth/me');
export const signedIn = me.success;

defineRoutes(routes);
startRouting();
```

## Tokens in the browser with oidc-client-ts

Install the library:

```bash
npm install oidc-client-ts
```

### Session module

One module owns the `UserManager` and a cached copy of the signed-in user. The cache is what lets a synchronous route guard answer without waiting.

```typescript
// src/auth/session.ts
import { User, UserManager } from 'oidc-client-ts';

export const userManager = new UserManager({
    authority: 'https://login.example.com',
    client_id: 'my-spa',
    redirect_uri: `${location.origin}/auth/callback`,
    post_logout_redirect_uri: location.origin,
    scope: 'openid profile offline_access api',
    automaticSilentRenew: true,
});

let currentUser: User | null = null;

userManager.events.addUserLoaded((user) => (currentUser = user));
userManager.events.addUserUnloaded(() => (currentUser = null));

/**
 * Reads the stored user. Call once before `startRouting()`.
 */
export async function loadSession(): Promise<void> {
    currentUser = await userManager.getUser();
}

export function isSignedIn(): boolean {
    return currentUser !== null && !currentUser.expired;
}

export function signIn(returnUrl: string): Promise<void> {
    return userManager.signinRedirect({ state: returnUrl });
}
```

`automaticSilentRenew` renews the access token before it expires, using the refresh token when the provider issues one (`offline_access`).

### Wire it into the http module

```typescript
import { configure } from '@relax.js/core/http';
import { userManager, signIn } from './auth/session';

configure({
    baseUrl: '/api',
    getAccessToken: async () => {
        const user = await userManager.getUser();
        return user && !user.expired ? user.access_token : null;
    },
    onUnauthorized: () => signIn(location.pathname + location.search),
});
```

`getAccessToken` is called before every request, so a renewed token is picked up without reconfiguring. If it throws, the request is not sent and the call rejects with that error.

### Guard and callback route

```typescript
import { GuardResult, RouteGuard, RouteMatchResult } from '@relax.js/core/routing';
import { isSignedIn, signIn } from './auth/session';

export class SignedInGuard implements RouteGuard {
    check(route: RouteMatchResult): GuardResult {
        if (isSignedIn()) {
            return GuardResult.Continue;
        }
        signIn('/' + route.urlSegments.join('/'));
        return GuardResult.Stop;
    }
}
```

The provider redirects back to `/auth/callback`. Give that URL a route and a component that finishes the sign-in:

```typescript
import { navigate } from '@relax.js/core/routing';
import { userManager } from './auth/session';

class AuthCallback extends HTMLElement {
    async connectedCallback() {
        const user = await userManager.signinRedirectCallback();
        navigate(typeof user.state === 'string' ? user.state : '/');
    }
}
customElements.define('auth-callback', AuthCallback);
```

```typescript
const routes: Route[] = [
    { name: 'auth-callback', path: '/auth/callback', componentTagName: 'auth-callback' },
    { name: 'orders', path: '/orders', componentTagName: 'orders-page', guards: [new SignedInGuard()] },
];
```

### Startup

```typescript
import { defineRoutes, startRouting } from '@relax.js/core/routing';
import { loadSession } from './auth/session';

await loadSession();
defineRoutes(routes);
startRouting();
```

Sign out with `userManager.signoutRedirect()`.

## Server-Sent Events

The browser's `EventSource` cannot send headers, so the bearer token only reaches the server on the fetch transport of `SSEClient` (`autoReconnect: false`, or a `method` or `body`). With a session cookie, both transports work. Pass `withCredentials: true` when the stream is on another origin.
