# Translations

Relaxjs provides namespace-based translations with ICU message format, lazy loading, and locale change events.

## Create Translation Files

Each namespace is a JSON file in your own project, one folder per locale:

```
src/i18n/locales/
├── en/
│   ├── r-common.json
│   └── errors.json
└── sv/
    ├── r-common.json
    └── errors.json
```

`r-common`, `r-pipes`, and `r-validation` already ship with Relaxjs, so you only need
files for the namespaces your application adds. Create a file with the same name to
replace a built-in one.

**`src/i18n/locales/en/r-common.json`**:

```json
{
    "welcome": "Welcome to our site!",
    "greeting": "Hello, {name}!",
    "items": "{count, plural, =0 {No items} one {# item} other {# items}}",
    "goodbye": "Goodbye!"
}
```

**`src/i18n/locales/en/errors.json`**:

```json
{
    "notFound": "Page not found",
    "unauthorized": "You are not authorized to view this page",
    "serverError": "An unexpected error occurred"
}
```

**`src/i18n/locales/sv/r-common.json`**:

```json
{
    "welcome": "Välkommen till vår sida!",
    "greeting": "Hej, {name}!",
    "items": "{count, plural, =0 {Inga föremål} one {# föremål} other {# föremål}}",
    "goodbye": "Hejdå!"
}
```

## Register Your Translation Files

Relaxjs cannot find files that live in your project, because a bundler resolves import
paths relative to the file they are written in. Hand your files to the library at
startup instead, before you set the locale.

With Vite, one call registers the whole folder:

```typescript
import { registerCatalogue } from '@relax.js/core/i18n';

registerCatalogue(import.meta.glob('./locales/*/*.json', { eager: true }));
```

The locale and the namespace are read from the last two parts of each path, so
`./locales/en/errors.json` becomes locale `en` and namespace `errors`.

Drop `{ eager: true }` to download each file the first time it is used instead of
including all of them in the first download:

```typescript
registerCatalogue(import.meta.glob('./locales/*/*.json'));
```

Without Vite, register the files yourself. `registerNamespace` accepts either the
messages or a function that loads them:

```typescript
import { registerNamespace } from '@relax.js/core/i18n';
import errorsEn from './locales/en/errors.json';

registerNamespace('en', 'errors', errorsEn);
registerNamespace('sv', 'errors', () => import('./locales/sv/errors.json'));
```

## Set the Locale

Set the locale at application startup. This loads the `r-common` namespace automatically:

```typescript
import { setLocale } from '@relax.js/core/i18n';

await setLocale('sv');
```

Locale codes are normalized: `en-US` becomes `en`, `sv-SE` becomes `sv`.

## Load Additional Namespaces

Load extra namespaces before using their keys:

```typescript
import { loadNamespace, loadNamespaces } from '@relax.js/core/i18n';

// One at a time
await loadNamespace('errors');

// Or several in parallel
await loadNamespaces(['r-pipes', 'r-validation']);
```

## Translate

Use `t()` to translate a key. Omit the namespace to use `r-common`:

```typescript
import { t } from '@relax.js/core/i18n';

t('greeting', { name: 'Anna' });          // "Hej, Anna!"
t('items', { count: 3 });                 // "3 föremål"
t('errors:notFound');                      // "Page not found"
t('r-pipes:daysAgo', { count: 2 });       // "2 dagar sedan"
```

### Interpolation

```json
{ "greeting": "Hello, {name}!" }
```

```typescript
t('greeting', { name: 'John' });  // "Hello, John!"
```

### Pluralization

Uses ICU plural syntax. The `#` token inserts the count:

```json
{ "items": "{count, plural, =0 {No items} one {# item} other {# items}}" }
```

```typescript
t('items', { count: 0 });  // "No items"  (exact =0 match)
t('items', { count: 1 });  // "1 item"    (plural category)
t('items', { count: 5 });  // "5 items"   (plural category)
```

### Selection

Chooses a branch based on a string match. Always include an `other` fallback:

```json
{ "status": "{gender, select, male {He is online} female {She is online} other {They are online}}" }
```

```typescript
t('status', { gender: 'female' });  // "She is online"
t('status', { gender: 'other' });   // "They are online"
```

### Number and Date Formatting

ICU format supports locale-aware number and date formatting:

```json
{
    "price": "Price: {amount, number, currency}",
    "date": "Date: {date, date, medium}"
}
```

## Handle Missing Translations

If a key is not found, `t()` returns the key itself:

```typescript
t('unknownKey');  // "unknownKey"
```

If a namespace is not translated for the current locale, the library falls back to `en`.
A namespace nobody registered is reported as a warning and leaves its keys untranslated,
so a forgotten file cannot stop your application from starting.

You can register a handler to catch missing keys during development:

```typescript
import { onMissingTranslation } from '@relax.js/core/i18n';

onMissingTranslation((key, namespace, locale) => {
    console.warn(`Missing: ${namespace}:${key} [${locale}]`);
});
```

### Text That Must Never Be Missing

Returning the key is a safe default for a button label, but not for wording you are
required to show. A visitor who does not read your key names sees `shell:aiDisclosure`
as if it were part of the design.

Pass a `fallback` for those strings. It is used only when the key is missing, and it
goes through the same formatter, so it can contain placeholders:

```typescript
t('shell:aiDisclosure', undefined, {
    fallback: 'You are interacting with an AI system.',
});
```

## Further Reading

For the complete guide, see the [i18n documentation](i18n/i18n.md). It covers:

- Built-in namespaces (`r-common`, `r-pipes`, `r-validation`)
- Locale switching and `LocaleChangeEvent`
- Custom message formatters
- Pipe integration
- Adding new locales
- Full API reference
