# Translation Library Documentation

This library helps you internationalize (i18n) your application using namespace-based translations and ICU message format for pluralization and formatting.

---

## Table of Contents

1. [Installation](#installation)
2. [Initialization and Loading Translations](#initialization-and-loading-translations)
3. [Setting the Locale](#setting-the-locale)
4. [Translation Function (`t`)](#translation-function-t)
5. [Using Parameters in Translations](#using-parameters-in-translations)
6. [Namespaces](#namespaces)
7. [ICU Message Format](#icu-message-format)
8. [Error Handling](#error-handling)
9. [Example Translation Files](#example-translation-files)
10. [Best Practices](#best-practices)

---

## Installation

Import the library functions in your code:

```ts
import { setLocale, loadNamespace, t, getCurrentLocale } from '@relax.js/core/i18n';
```

---

## Initialization and Loading Translations

When you first start your application, set the locale and the library will automatically load the `common` namespace.

**Example:**

```ts
import { setLocale } from '@relax.js/core/i18n';

// Set locale at application startup
await setLocale('en');
```

Under the hood, the library will:
1. Normalize the locale (e.g., 'en-US' becomes 'en')
2. Clear any previously loaded translations
3. Load the `common` namespace from `/locales/{locale}/common.json`
4. Fall back to English (`en`) if the requested locale is not found

---

## Setting the Locale

Use `setLocale(locale: string)` to switch or explicitly set the user's locale. The function returns a Promise that resolves once the `common` namespace is loaded.

**Example:**

```ts
import { setLocale } from '@relax.js/core/i18n';

async function switchToSwedish() {
  await setLocale('sv');
  console.log('Switched to Swedish!');
}
```

> **Important**: Setting the locale clears all previously loaded translations and reloads the `common` namespace.

---

## Translation Function (`t`)

Use the `t` function to translate a key into the current locale's string. The signature is:
```ts
t(fullKey: string, values?: Record<string, any>): string;
```

- **fullKey**: A string key in format `namespace:key` or just `key` (defaults to `common` namespace)
- **values**: An optional object for ICU message interpolation

**Basic Example:**
```ts
import { t } from '@relax.js/core/i18n';

console.log(t("welcome_message"));
// Uses common:welcome_message

console.log(t("errors:notFound"));
// Uses errors namespace
```

---

## Using Parameters in Translations

If your translation string includes placeholders, provide dynamic values in the `values` argument. The library uses ICU message format for interpolation.

**Example:**

```ts
// In your .json translation file (e.g. locales/en/common.json)
{
  "greeting": "Hello, {name}!"
}

// In your code:
import { t } from '@relax.js/core/i18n';

console.log(t("greeting", { name: "Alice" }));
// Output: "Hello, Alice!"
```

---

## Namespaces

Translations are organized into namespaces. Each namespace corresponds to a JSON file in the locales directory.

### Directory Structure

```
/locales
  /en
    common.json
    errors.json
    shop.json
  /sv
    common.json
    errors.json
    shop.json
```

### Loading Namespaces

The `common` namespace is loaded automatically when setting the locale. Load additional namespaces on demand:

```ts
import { loadNamespace, t } from '@relax.js/core/i18n';

// Load the shop namespace before using its translations
await loadNamespace('shop');

// Now you can use shop translations
const price = t('shop:priceLabel');
const items = t('shop:itemCount', { count: 5 });
```

### Key Format

Use `namespace:key` format to reference translations:

```ts
t('common:greeting');     // Explicit common namespace
t('greeting');            // Implicit common namespace (same as above)
t('errors:notFound');     // errors namespace
t('shop:checkout');       // shop namespace
```

---

## ICU Message Format

The library uses ICU message format for advanced formatting, including pluralization and selection.

### Simple Interpolation

```json
{
  "welcome": "Welcome, {name}!"
}
```

```ts
t('welcome', { name: 'John' }); // "Welcome, John!"
```

### Pluralization

```json
{
  "items": "{count, plural, =0 {No items} one {# item} other {# items}}"
}
```

```ts
t('items', { count: 0 }); // "No items"
t('items', { count: 1 }); // "1 item"
t('items', { count: 5 }); // "5 items"
```

### Selection

```json
{
  "userStatus": "{gender, select, male {He is online} female {She is online} other {They are online}}"
}
```

```ts
t('userStatus', { gender: 'female' }); // "She is online"
```

### Number and Date Formatting

ICU format supports locale-aware number and date formatting:

```json
{
  "price": "Price: {amount, number, currency}",
  "date": "Date: {date, date, medium}"
}
```

---

## Error Handling

1. **Missing translations**: If a translation key is not found, the function returns the key itself
2. **Missing namespace**: If a namespace fails to load, the library falls back to the English locale
3. **Format errors**: If ICU formatting fails, the function returns the key

**Example:**

```ts
// If 'unknownKey' doesn't exist
const result = t('unknownKey');
// Returns: "unknownKey"

// Namespace loading with fallback
try {
  await loadNamespace('shop');
} catch (error) {
  console.warn('Shop namespace not found, using fallback');
}
```

---

## Example Translation Files

Below are example JSON translation files:

**`/locales/en/common.json`**:
```json
{
  "welcome_message": "Welcome to our site!",
  "greeting": "Hello, {name}!",
  "items": "{count, plural, =0 {No items} one {# item} other {# items}}",
  "goodbye": "Goodbye!"
}
```

**`/locales/en/errors.json`**:
```json
{
  "notFound": "Page not found",
  "unauthorized": "You are not authorized to view this page",
  "serverError": "An unexpected error occurred"
}
```

**`/locales/sv/common.json`** (Swedish):
```json
{
  "welcome_message": "Välkommen till vår sida!",
  "greeting": "Hej, {name}!",
  "items": "{count, plural, =0 {Inga föremål} one {# föremål} other {# föremål}}",
  "goodbye": "Hejdå!"
}
```

---

## Best Practices

- **Keep your translation keys consistent**: Use descriptive keys like `"user_profile_update_success"` instead of just `"message4"`.
- **Organize by feature**: Use namespaces to group related translations (e.g., `shop`, `auth`, `errors`)
- **Load namespaces lazily**: Only load namespaces when needed to reduce initial load time
- **Use ICU format for plurals**: Instead of `item`/`items` keys, use ICU plural syntax
- **Test across locales**: Different locales format numbers, dates, and plurals differently
- **Provide fallbacks**: The library falls back to English, so ensure all keys exist in the English locale

---

## API Reference

### `setLocale(locale: string): Promise<void>`
Sets the current locale and loads the `common` namespace.

### `loadNamespace(namespace: string): Promise<void>`
Loads a translation namespace on demand.

### `t(fullKey: string, values?: Record<string, any>): string`
Translates a key with optional value interpolation using ICU format.

### `getCurrentLocale(): string`
Returns the current normalized locale code.

---

## Summary

With this translation library, you can:

- Organize translations into namespaces for better structure
- Use the `t` function to substitute placeholders using ICU message format
- Handle pluralization and selection with standard ICU syntax
- Load namespaces on demand to optimize performance
- Fall back to English for missing translations

For more information on ICU message format, see the [ICU User Guide](https://unicode-org.github.io/icu/userguide/format_parse/messages/).
