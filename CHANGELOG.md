# Changelog

## 2.4.1

### Fixed

- 2.4.0 shipped the 2.3.1 `dist`, so `@relax.js/core/jsx` and the other 2.4.0 changes were missing; publishing now always rebuilds and verifies every `exports` path.

## 2.4.0 (2026-10-27)

### Added

- `failOnRelaxErrors()` in `@relax.js/core/testing`: makes every reported Relaxjs error throw, for use in a vitest setup file.
- `npx @relax.js/core check` reports a block element inside a `<p>` and a table part outside a `<table>`, and scopes loops the way the browser renders them.
- `t()` reports a key whose namespace is not loaded, once per namespace.
- `Route.load`: imports the module defining `componentTagName` on the first visit to the route.
- `@relax.js/core/jsx`: `h()` for `.tsx` files, building real DOM elements with props set as DOM properties, or as attributes when the name has a dash.

### Fixed

- A route declared with `component: SomeClass` threw in jsdom, which lacks `customElements.getName`, so it could not be tested with `mountRouting()`.

### Changed

- `@ContainerService` on a class extending `HTMLElement` throws.
- `startRouting()` before `defineRoutes()` reports an error.
- `fakeServer().on()` for a method and path already registered replaces the earlier response.
- An `@Inject` field whose service is not registered reports the component tag, field and service.
- `response.as()` on a failed response throws a message naming the request and status.
- Docs register event classes in `GlobalEventHandlersEventMap`, and the Vite setup sets `verbatimModuleSyntax`.

## 2.3.1 (2026-10-13)

### Fixed

- `startRouting()`, `navigate('/path?a=1')` and layout switches removed the query string from the address bar, leaving `location.search` empty in the routed page.

## 2.3.0 (2026-10-02)

### Added

- `configure({ getAccessToken })` in `@relax.js/core/http`: supplies the bearer token, sync or async, for http requests and the `SSEClient` fetch transport.
- `configure({ onUnauthorized })` in `@relax.js/core/http`: called for every 401 response from http requests and the `SSEClient` fetch transport.
- Docs: Authentication with OpenID Connect (`docs/http/Authentication.md`).

### Fixed

- `request(url)` without options did not send the bearer token.

## 2.2.0 (2026-09-22)

### Added

- `setPageMeta()` in `@relax.js/core/routing`: writes title, description, canonical, Open Graph, robots and JSON-LD tags for the current page.
- `npx @relax.js/core prerender`: renders every URL in `dist/sitemap.xml` with headless Chromium and writes `dist/<path>/index.html`. Also `prerender()`, `createStaticServer()` and `createChromiumRenderer()` from `@relax.js/core/prerender`.
- `playwright` is an optional peer dependency, used only by `prerender`.
- `navigate('/path?a=1')` merges the query string into the route parameters.

### Changed

- `startRouting()` intercepts clicks on same-origin `<a href>` elements whose path matches a defined route and navigates client side.

## 2.1.1 (2026-09-19)

### Changed

- `LoadRoute<T>` and `Routable<T>` accept any object type, so route parameters can be declared as an `interface`.
- `check` prints file paths relative to the working directory.

### Fixed

- `fakeServer().on()` with a function body left the callback's `request` parameter untyped.

## 2.1.0 (2026-09-19)

### Added

- `npx @relax.js/core check`: verifies every `compileTemplate<T, F>(\`...\`)` template against its type arguments, and every `html\`...\`` literal against the object it is bound with, using the TypeScript compiler. Prints `tsc`-style `file:line:col - error:` lines. Also available as `checkProject()` / `checkProgram()` from `@relax.js/core/check`.
- `compileTemplate<T, F>` takes a second type parameter for the functions context; `render(ctx: T, fns?: F | null)`.
- `typescript` is an optional peer dependency, used only by `check`.

### Fixed

- `html`: `{{fn|a, b}}` with more than one argument, or with a dotted path or literal argument, rendered as literal text.

### Changed

- `FormValidator.FindForm()` searches descendants, so it finds the form inside the wrapper `compileTemplate` appends.
- `CompiledTemplate.content` is typed `HTMLElement`; it was never a `DocumentFragment`.

## 2.0.0 (2026-09-19)

### Breaking

- ES modules only; `require` exports removed.
- Root and sub-path entries share one module instance. Before, each carried its own `onError()`, route table and http config.

### Added

- `mountRouting()` and `fakeServer()` in `@relax.js/core/testing`.

### Fixed

- `readData()`: `name[]` checkbox groups crashed; nested names (`a.b`, `a[0].b`) did not nest; empty text was `undefined` instead of `''`; single-selection `<select multiple>` was not an array.

## 1.8.0 (2026-09-14)

### Added

- `window.relaxErrors` holds every reported error, most recent last, whether an `onError` handler is registered or not. Read it after a failure instead of reproducing with a flag on.
- `window.relaxDebug = { errors: true }` prints every reported error with its context.
- The first error reported with nothing listening prints one line naming `window.relaxErrors`, the `errors` flag, `onError()` and `captureRelaxErrors()`. Once per page load.
- `compileTemplate<T>` accepts any object as view model. An `interface` or a class instance works; an index signature is no longer required.
- `docs/routing/`, `docs/forms/`, `docs/setup/` and `docs/i18n/` have an `index.md`.
- `init-agents` stamps each copied skill with the package version. Running it again after an upgrade lists the copies that are behind.

### Fixed

Failures that produced no DOM and no error now report through `onError()`:

- `render()` given the same context object as the previous render. Nothing was updated because the memoization compares by identity, and nothing said so.
- An `html` template function called a second time. It re-drove the first instance and returned an empty fragment.
- A navigation still parked after a task because no `<r-route-target>` with that name is connected, and a parked navigation replaced by a later one to the same target.
- A render writing `value`, `checked` or `selected` to the element that has focus, replacing what was being typed.
- A route whose component is never registered went to `console.warn` only. It reports, so a test can see it.

### Changed

- A strict-mode template throws when `render()` is skipped for an identical context, as it does for any other reported template error.
- The `relaxjs-templates` skill no longer explains the failures above; the error messages do.

## 1.7.0 (2026-09-03)

### Added

- `return false` from an `r-<event>` handler calls `preventDefault()`, so `<form r-submit="save()">` no longer submits natively. An `async` handler returns a promise instead of `false` and must take `event` to cancel.
- `docs/forms/form-page.md` builds a form page end to end: `compileTemplate`, `setFormData`, `FormValidator` and an async save in one component.

### Fixed

- `render(ctx)` without a functions context silently stopped every `r-<event>` handler on that template. The previous context is kept, so a data-only update leaves handlers wired. Pass `null` to drop it deliberately.
- `submitCallback` was documented as `() => void`. It is `() => void | Promise<void>`.
- The docs never stated that `FormValidator` takes over the form's submit event, nor what happens to the native submit. `docs/forms/validation.md` now leads with both.

### Changed

- `FormValidator` awaits `submitCallback`. An error rethrown by an `onError` handler that does not suppress now surfaces as an unhandled rejection instead of through `dispatchEvent`.
- `CompiledTemplate.render` accepts `null` as its second argument.

## 1.6.1 (2026-08-21)

### Fixed

- An attribute mixing literal text with `{{expr}}`, such as `class="finding {{severity}}"` or `src="/avatars/{{user.id}}.png"`, kept only the first expression and dropped the rest of the value.
- An attribute holding several expressions rendered only the first one.
- `loop` and `if` on the same element threw instead of skipping the items that fail the condition. The same applies to `loop` with `unless`, and to `if` with `unless`.

## 1.6.0 (2026-08-20)

### Added

- `window.relaxDebug` turns on internal traces per area. Off by default. See `docs/Debugging.md`.

### Fixed

- A route whose component is never registered warns instead of waiting forever.
- Navigations aimed at a target that never connected are reported.
- Template expressions that cannot be resolved are reported.
- A URL matching no route reports which routes were tried.
- A path such as `/users/{id}` made the route permanently unreachable. `defineRoutes()` now rejects it.
- `<r-link>` printed the whole route table on every click.
- The failed layout redirect error names the layout, the route and the URL.

### Changed

- The router no longer writes to the console unless a debug area is turned on.
- `loadRoute()` receives `{ r_error: ... }` instead of `{ error: ... }` when the route carries no parameters, and warns.
- A route declared with an empty string as its layout warns instead of being corrected silently.

## 1.5.0 (2026-08-16)

### Added

- `SSEClient` can send data, using a `fetch` transport when `method`, `body`, `headers` or `signal` is set.
- `SSEOptions.onClose` reports why a stream stopped.
- A refused request calls `onError` and closes, instead of being retried forever by the browser.
- `SSEOptions.autoReconnect: false` disables retries.
- The fetch transport applies `configure({ baseUrl })` and the JWT bearer token.

## 1.4.0 (2026-08-09)

### Added

- `NavigateRouteEvent.fragment` gives a component the URL fragment. A fragment is never sent to the server, so it stays out of access logs.
- The fragment survives a layout switch.
- `NavigateOptions.fragment` passes a fragment to `navigate()` by hand.

### Fixed

- Navigating to a route with its own layout threw `A redirect failed` whenever the URL had any fragment.

### Changed

- The layout switch marker is now `#rlx-layout` instead of `#layout`.

## 1.3.0 (2026-08-06)

### Added

- `registerCatalogue(modules)` registers a whole `locales/` folder.
- `registerNamespace(locale, namespace, source)` registers one namespace, which is how `r-validation` is overridden.
- `t(key, values, { fallback })` renders fallback text instead of the raw key.

### Fixed

- Translations could not be loaded from a built package at all.
- `loadNamespace()` rejected instead of warning when a namespace was missing on a non-English locale, stopping application startup.
- A failing namespace loader is reported with its error.

### Changed

- Applications must register their own translation files at startup, before `setLocale()`.

## 1.1.1 (2026-06-16)

### Fixed

- Removed unused `reflect-metadata` runtime dependency.

## 1.1.0

- Added event handling to `compileTemplate`.
- Added history navigation to the router.
- Fixed `r-link` param-* casing so kebab-case attributes resolve camelCase route params.
