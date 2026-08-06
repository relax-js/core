# Changelog

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
