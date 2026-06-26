# Changelog

## 1.1.1 (2026-06-16)

### Fixed

- Removed unused `reflect-metadata` runtime dependency (it was never imported and `emitDecoratorMetadata` is disabled).

## 1.1.0

- Added event handling to `compileTemplate`.
- Added history navigation to the router.
- Fixed `r-link` param-* casing so DOM-lowercased attributes still resolve route params declared in camelCase; kebab-case attribute names are now converted to camelCase.
