# The Modern Intl Standard

The browser's built-in [`Intl`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl) object provides locale-aware formatting for numbers, dates, strings, and more. It is supported in all modern browsers and Node.js, so no polyfills or libraries are needed.

Relaxjs uses `Intl` internally (e.g. `Intl.PluralRules` for ICU pluralization) and exposes the current locale via `getCurrentLocale()` so pipes and components can pass it directly to `Intl` APIs.

## Intl.PluralRules

Determines the plural category (`zero`, `one`, `two`, `few`, `many`, `other`) for a number in a given locale. Different languages have different rules. English has two categories (`one` / `other`), Arabic has six.

```typescript
const en = new Intl.PluralRules('en');
en.select(1);   // 'one'
en.select(0);   // 'other'
en.select(5);   // 'other'

const sv = new Intl.PluralRules('sv');
sv.select(1);   // 'one'   → en
sv.select(0);   // 'other' → flera
sv.select(5);   // 'other' → flera
```

The returned strings (`one`, `other`, `few`, etc.) are category identifiers, not localized text. The locale determines *which numbers* map to *which categories*. English and Swedish both use `one`/`other`, while languages like Arabic use all six categories (`zero`, `one`, `two`, `few`, `many`, `other`).

This is the engine behind ICU `{count, plural, ...}` messages. The Relaxjs ICU formatter delegates to `Intl.PluralRules` for category selection.

[MDN: Intl.PluralRules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/PluralRules)

## Intl.NumberFormat

Formats numbers according to locale conventions: thousands separators, decimal marks, currency, percentages, units, and compact notation.

```typescript
new Intl.NumberFormat('en').format(1234.5);        // '1,234.5'
new Intl.NumberFormat('sv').format(1234.5);        // '1 234,5'

new Intl.NumberFormat('en', {
    style: 'currency', currency: 'USD'
}).format(42);                                      // '$42.00'

new Intl.NumberFormat('sv', {
    style: 'currency', currency: 'SEK'
}).format(42);                                      // '42,00 kr'

new Intl.NumberFormat('en', {
    notation: 'compact'
}).format(1_500_000);                               // '1.5M'
```

The Relaxjs `currency` pipe uses `Intl.NumberFormat` with `getCurrentLocale()`.

[MDN: Intl.NumberFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat)

## Intl.DateTimeFormat

Formats dates and times according to locale conventions and configurable options.

```typescript
const date = new Date('2025-06-15T14:30:00');

new Intl.DateTimeFormat('en').format(date);         // '6/15/2025'
new Intl.DateTimeFormat('sv').format(date);         // '2025-06-15'

new Intl.DateTimeFormat('en', {
    dateStyle: 'long', timeStyle: 'short'
}).format(date);                                     // 'June 15, 2025 at 2:30 PM'

new Intl.DateTimeFormat('sv', {
    weekday: 'long', month: 'long', day: 'numeric'
}).format(date);                                     // 'söndag 15 juni'
```

The Relaxjs `date` pipe uses `Intl.DateTimeFormat` with `getCurrentLocale()`.

[MDN: Intl.DateTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat)

## Intl.RelativeTimeFormat

Formats relative time descriptions ("3 days ago", "in 2 hours") with locale-aware phrasing.

```typescript
const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
rtf.format(-1, 'day');    // 'yesterday'
rtf.format(0, 'day');     // 'today'
rtf.format(3, 'day');     // 'in 3 days'

const svRtf = new Intl.RelativeTimeFormat('sv', { numeric: 'auto' });
svRtf.format(-1, 'day');  // 'igår'
svRtf.format(-3, 'day');  // 'för 3 dagar sedan'
```

[MDN: Intl.RelativeTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/RelativeTimeFormat)

## Intl.Collator

Provides locale-sensitive string comparison for sorting. Handles accents, case, and locale-specific sort orders (e.g. Swedish å/ä/ö sort after z).

```typescript
const col = new Intl.Collator('sv');
['ö', 'a', 'å', 'ä'].sort(col.compare);  // ['a', 'å', 'ä', 'ö']

const enCol = new Intl.Collator('en', { sensitivity: 'base' });
enCol.compare('café', 'cafe');             // 0  (equal, ignoring accent)
```

[MDN: Intl.Collator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Collator)

## Intl.Segmenter

Splits text into meaningful segments (graphemes, words, or sentences) while respecting locale rules. Essential for languages without spaces between words (Chinese, Japanese, Thai).

```typescript
const seg = new Intl.Segmenter('en', { granularity: 'word' });
const words = [...seg.segment('Hello world!')].filter(s => s.isWordLike);
// [{segment: 'Hello'}, {segment: 'world'}]
```

[MDN: Intl.Segmenter](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter)

## Intl.ListFormat

Formats lists with locale-appropriate conjunctions and punctuation.

```typescript
new Intl.ListFormat('en', { type: 'conjunction' })
    .format(['Alice', 'Bob', 'Charlie']);    // 'Alice, Bob, and Charlie'

new Intl.ListFormat('sv', { type: 'conjunction' })
    .format(['Alice', 'Bob', 'Charlie']);    // 'Alice, Bob och Charlie'
```

[MDN: Intl.ListFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/ListFormat)

## Intl.DisplayNames

Translates language, region, currency, and script codes into human-readable names.

```typescript
new Intl.DisplayNames('en', { type: 'language' }).of('sv');    // 'Swedish'
new Intl.DisplayNames('sv', { type: 'language' }).of('en');    // 'engelska'
new Intl.DisplayNames('en', { type: 'currency' }).of('SEK');  // 'Swedish Krona'
```

[MDN: Intl.DisplayNames](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DisplayNames)

## ICU Message Format

ICU (International Components for Unicode) defines a message syntax used across platforms. The three core patterns:

### Simple Interpolation

```
Hello, {name}!
```

### Plural

Selects a branch based on `Intl.PluralRules`. The `#` token inserts the numeric value. Exact matches (`=0`, `=1`) take priority over category matches.

```
{count, plural, =0 {No items} one {# item} other {# items}}
```

### Select

Selects a branch based on an exact string match. Always include an `other` fallback.

```
{gender, select, male {He} female {She} other {They}} liked your post.
```

[ICU User Guide: Formatting Messages](https://unicode-org.github.io/icu/userguide/format_parse/messages/)

## Further Reading

- [MDN: Intl](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl), full API reference
- [ICU Message Format](https://unicode-org.github.io/icu/userguide/format_parse/messages/), the message syntax standard
- [Can I Use: Intl](https://caniuse.com/?search=Intl), browser support tables
