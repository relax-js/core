# Internationalization

Namespace-based translations with ICU message format, lazy loading and locale change events, on top
of the platform's own `Intl` objects.

## Available Features

| Feature | Description | Use Case |
|---------|-------------|----------|
| [i18n](i18n.md) | `registerCatalogue`, `setLocale`, `loadNamespaces`, `t` | Translating an application |
| [The Intl standard](intl-standard.md) | What the browser already does for plurals, numbers, dates, lists and sorting | Formatting a value without adding a library |

## Quick Start

```typescript
import { registerCatalogue, setLocale, loadNamespaces, t } from '@relax.js/core/i18n';

registerCatalogue(import.meta.glob('./locales/*/*.json', { eager: true }));

await setLocale('sv');
await loadNamespaces(['r-pipes', 'r-validation']);

t('greeting', { name: 'Anna' });    // "Hej, Anna!"
t('items', { count: 3 });           // "3 saker"
```

Translations live in your own project as `locales/{locale}/{namespace}.json`. Registration is the
step that makes them visible: a bundler resolves an import path relative to the file it is written
in, so the library can only ever see its own files unless yours are handed to it.

Registration happens once at startup, before `setLocale()`, which puts it ahead of `startRouting()`
in [bootstrapping](../setup/bootstrapping.md).

## Choosing the Right Tool

- **Adding translations to an app?** → [i18n](i18n.md)
- **`t('...')` returns the key unchanged?** → Registration or namespace loading, in
  [i18n](i18n.md), and the startup order in [bootstrapping](../setup/bootstrapping.md)
- **Formatting a number, date, list or plural?** → [The Intl standard](intl-standard.md), before
  reaching for a dependency
- **Formatting inside a template?** → [Pipes](../Pipes.md)
