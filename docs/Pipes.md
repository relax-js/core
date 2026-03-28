# Pipes

Data transformation functions for use in template expressions. Pipes transform values for display without modifying the underlying data.

## Usage

In templates with `compileTemplate`:

```html
<span>{{name | uppercase}}</span>
<span>{{price | currency}}</span>
<span>{{description | shorten:50}}</span>
<span>{{tags | join:, }}</span>
```

Pipes can be chained:

```html
<span>{{text | trim | uppercase | shorten:20}}</span>
```

## Localization

Several pipes are locale-aware and use the [i18n](i18n/i18n.md) system:

- `currency` - Formats numbers according to locale
- `date` - Formats dates according to locale
- `daysAgo` - Translates "today", "yesterday", "X days ago"
- `pieces` - Translates piece counts

To use localized pipes:

```typescript
import { setLocale, loadNamespace } from '@relax.js/core/i18n';

// Set locale and load pipe translations
await setLocale('sv');
await loadNamespace('r-pipes');

// Now pipes will output Swedish
// {{createdAt | daysAgo}} → "idag", "igår", "3 dagar sedan"
// {{price | currency:SEK}} → "1 234,56 kr"
```

### Translation Keys

Translation keys in the `r-pipes` namespace:

| Key | Message (EN) | Message (SV) |
|-----|-------------|-------------|
| `today` | `today` | `idag` |
| `yesterday` | `yesterday` | `igår` |
| `daysAgo` | `{count, plural, one {# day ago} other {# days ago}}` | `{count, plural, one {# dag sedan} other {# dagar sedan}}` |
| `pieces` | `{count, plural, =0 {none} one {one} other {# pcs}}` | `{count, plural, =0 {inga} one {en} other {# st}}` |

### Translation Files

Pipe translations are stored in `src/i18n/locales/{locale}/r-pipes.json`:

```json
{
    "today": "today",
    "yesterday": "yesterday",
    "daysAgo": "{count, plural, one {# day ago} other {# days ago}}",
    "pieces": "{count, plural, =0 {none} one {one} other {# pcs}}"
}
```

To add a new locale, create `src/i18n/locales/{locale}/r-pipes.json` with the translated strings.

## Programmatic Usage

```typescript
import { applyPipes, defaultPipes, createPipeRegistry } from '@relax.js/core/utils';

// Apply pipes to a value
const result = applyPipes('hello world', ['uppercase', 'shorten:8']);
// Returns: 'HELLO...'

// Use the default registry directly
const upper = defaultPipes.get('uppercase');
console.log(upper('hello')); // 'HELLO'

// Create a fresh registry
const registry = createPipeRegistry();
```

## Built-in Pipes

### Text

| Pipe | Description | Example | Result |
|------|-------------|---------|--------|
| `uppercase` | Convert to uppercase | `{{"hello" \| uppercase}}` | `HELLO` |
| `lowercase` | Convert to lowercase | `{{"HELLO" \| lowercase}}` | `hello` |
| `capitalize` | Capitalize first letter | `{{"hello" \| capitalize}}` | `Hello` |
| `trim` | Remove leading/trailing whitespace | `{{" hello " \| trim}}` | `hello` |
| `shorten:n` | Limit to n characters with ellipsis | `{{"hello world" \| shorten:8}}` | `hello...` |

### Formatting (Locale-Aware)

These pipes use the current i18n locale for formatting.

| Pipe | Description | Example | en | sv |
|------|-------------|---------|----|----|
| `currency` | Format as currency (default USD) | `{{1234.5 \| currency}}` | `$1,234.50` | `1 234,50 US$` |
| `currency:CODE` | Format with specific currency | `{{1234.5 \| currency:SEK}}` | `SEK 1,234.50` | `1 234,50 kr` |
| `date` | Format date (ISO) | `{{date \| date}}` | `2024-01-15T...` | `2024-01-15T...` |
| `date:short` | Short date format | `{{date \| date:short}}` | `1/15/2024` | `2024-01-15` |
| `date:long` | Long date format | `{{date \| date:long}}` | `Monday, January 15, 2024` | `måndag 15 januari 2024` |
| `daysAgo` | Relative date | `{{date \| daysAgo}}` | `3 days ago` | `3 dagar sedan` |
| `pieces` | Piece count | `{{3 \| pieces}}` | `3 pcs` | `3 st` |

### Arrays

| Pipe | Description | Example | Result |
|------|-------------|---------|--------|
| `join` | Join with comma | `{{tags \| join}}` | `a,b,c` |
| `join:sep` | Join with custom separator | `{{tags \| join: \| }}` | `a \| b \| c` |
| `first` | Get first element | `{{items \| first}}` | First item |
| `last` | Get last element | `{{items \| last}}` | Last item |

### Objects

| Pipe | Description | Example | Result |
|------|-------------|---------|--------|
| `keys` | Get object keys as array | `{{user \| keys}}` | `["name", "email"]` |

### Conditionals

| Pipe | Description | Example | Result |
|------|-------------|---------|--------|
| `default:val` | Fallback for falsy values | `{{name \| default:Anonymous}}` | Value or `Anonymous` |
| `ternary:t:f` | Conditional value | `{{active \| ternary:Yes:No}}` | `Yes` or `No` |

## Pipe Arguments

Arguments are passed after a colon:

```html
<!-- Single argument -->
<span>{{text | shorten:50}}</span>
<span>{{price | currency:EUR}}</span>

<!-- Multiple arguments -->
<span>{{status | ternary:Active:Inactive}}</span>
```

## Configuration

Pass a pipe registry to `compileTemplate`:

```typescript
import { compileTemplate } from '@relax.js/core/html';
import { createPipeRegistry } from '@relax.js/core/utils';

const pipeRegistry = createPipeRegistry();
const { content, render } = compileTemplate(
    '<span>{{name | uppercase}}</span>',
    { strict: false, pipeRegistry }
);
```

## API Reference

### Types

```typescript
type PipeFunction = (value: any, ...args: any[]) => any;

interface PipeRegistry {
    lookup(name: string): PipeFunction | null;
    get(name: string): PipeFunction;  // Throws if not found
    has(name: string): boolean;
}
```

### Functions

| Function | Description |
|----------|-------------|
| `createPipeRegistry()` | Create a new registry with all built-in pipes |
| `applyPipes(value, pipes, registry?)` | Apply an array of pipe strings to a value |
| `defaultPipes` | Pre-created registry instance |

### Individual Pipe Functions

All pipes are also exported as individual functions for direct use:

```typescript
import {
    uppercasePipe,
    lowercasePipe,
    capitalizePipe,
    trimPipe,
    shortenPipe,
    currencyPipe,
    datePipe,
    daysAgoPipe,
    piecesPipe,
    joinPipe,
    firstPipe,
    lastPipe,
    keysPipe,
    defaultPipe,
    ternaryPipe
} from '@relax.js/core/utils';

const result = uppercasePipe('hello');  // 'HELLO'
const formatted = currencyPipe(1234.56);  // '$1,234.56' (depends on locale)
```
