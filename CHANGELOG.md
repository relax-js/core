# Changelog

## 1.5.0 (2026-08-16)

### Added

- `SSEClient` can send data to the server. Setting `method`, `body`, `headers` or `signal` switches it to a transport built on `fetch`, so an endpoint that takes input and streams a result back can now be called. The browser's `EventSource` is GET only and cannot send a body or a header, which made those endpoints unreachable. Nothing changes for an existing client that sets none of these options.
- `SSEOptions.onClose` reports why a stream stopped, as `completed`, `truncated`, `aborted` or `failed`. A server that finished and a server that died look identical to `EventSource`, so an application could not tell a whole result from one that was cut off. `terminalEvents` names the event the server sends last, which is what separates `completed` from `truncated`.
- `SSEClient` surfaces a refused request. A non 2xx answer calls `onError` with an `SSEErrorEvent` carrying the status and the response, then closes with reason `failed`, instead of being retried forever by the browser. `SSEErrorEvent` extends `Event`, so handlers written against the previous `onError` signature keep working. The response `body` holds raw text, matching what `post()` returns for a failed request.
- `SSEOptions.autoReconnect` set to `false` selects the fetch transport, which never retries. A request that sends data is not always safe to repeat, so it reports through `onClose` and leaves the retry to the application.
- On the fetch transport `SSEClient` applies `configure({ baseUrl })` and the JWT bearer token. `EventSource` cannot send headers, so neither applies there and its URLs are unchanged.

## 1.4.0 (2026-08-09)

### Added

- `NavigateRouteEvent.fragment` gives a component the URL fragment (the part after `#`), without the leading `#`, or `undefined` when the URL had none. A fragment is never sent to the server, so it is the one place a value stays out of server, proxy and CDN access logs. Activation and password reset links use this for their token. Unlike a query string it has no name, so it is not merged into route parameters.
- The fragment survives a layout switch. It travels in `sessionStorage` together with the route parameters rather than on the redirect URL, so a token carried there is not repeated in the address bar of the layout page.
- `NavigateOptions.fragment` passes a fragment to `navigate()` by hand. Rarely needed, since the router fills it in when replaying a navigation that crossed a layout switch.

### Fixed

- Navigating to a route with its own layout threw `A redirect failed, does the requsted layout exist?` whenever the URL had any fragment at all. The check that detects a failed layout redirect tested for the presence of a hash rather than for the marker the router itself writes, so an application fragment such as a reset token in `/reclaim#token` looked like a failed redirect. Loop detection now matches the marker exactly and every other fragment is left alone.

### Changed

- The marker the router puts on the URL while switching layout is now `#rlx-layout` instead of `#layout`, so it cannot collide with an application's own anchor or fragment. This is internal to the redirect and is cleared once routing settles.

## 1.3.0 (2026-08-06)

### Added

- `registerCatalogue(modules)` registers a whole `locales/` folder from a record keyed by file path. Values may be the messages, a module with the messages as its default export, or a function returning either, so it works with Vite's eager and lazy `import.meta.glob`, webpack's `require.context`, and plain objects.
- `registerNamespace(locale, namespace, source)` registers a single namespace, either with the messages or with a loader called the first time the namespace is used. Registering the same locale and namespace again replaces the entry, which is how a built-in namespace such as `r-validation` is overridden.
- `t(key, values, { fallback })` renders the fallback text instead of the raw key when a key is missing. Intended for wording that must never be absent, such as a legally required notice. The fallback goes through the same formatter, so it can contain placeholders.

### Fixed

- Translations could not be loaded from a built package at all. The loader used a dynamic import with a variable path, which a bundler resolves relative to the file containing it, at that file's build time. The path pointed at `dist/i18n/locales/`, which was never shipped, so every namespace failed in `index`, `forms`, `html`, `utils`, and `i18n`. Built-in translations are now bundled directly.
- `loadNamespace()` rejected instead of warning when a namespace was missing on a non-English locale, because the English fallback import inside the `catch` was itself unguarded. One missing file stopped application startup. It now warns and continues, which is the behaviour the documentation already described.
- A failing namespace loader is now reported with its error instead of being indistinguishable from a namespace nobody registered.

### Changed

- Applications must register their own translation files at startup, before `setLocale()`. A library cannot discover files that live in an application, so the previous documented layout could never have worked for application-owned namespaces. The built-in namespaces need no registration.

## 1.1.1 (2026-06-16)

### Fixed

- Removed unused `reflect-metadata` runtime dependency (it was never imported and `emitDecoratorMetadata` is disabled).

## 1.1.0

- Added event handling to `compileTemplate`.
- Added history navigation to the router.
- Fixed `r-link` param-* casing so DOM-lowercased attributes still resolve route params declared in camelCase; kebab-case attribute names are now converted to camelCase.
