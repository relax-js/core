# Typed copy

`t('shop:priceLabel')` takes a string, so a misspelled key is found when the page renders, by
the [missing translation handler](i18n.md#missing-translation-handler). Typed copy is the
alternative for text that is fixed at build time: one JSON file per language, read as
properties of an object whose type comes from the JSON itself. `tsc` then checks every use in
code and [`check`](../html/checking.md) every use in a template, before anything runs.

Reach for it on marketing pages, navigation, footers and legal text, where the strings are
plain and known up front. Keep `t()` for plurals, `select` and anything loaded on demand. The two
coexist: a page can take its labels from typed copy and its item count from `t()`.

## Files

Nest freely; the structure is the key space.

```json
// src/copy/en.json
{
    "nav": { "how": "How it works", "about": "About", "menu": "Menu" },
    "footer": { "company": "Built by Coderr AB.", "privacy": "Privacy policy" }
}
```

```json
// src/copy/sv.json
{
    "nav": { "how": "Så fungerar det", "about": "Om oss", "menu": "Meny" },
    "footer": { "company": "Vaenligt utvecklas av Coderr AB.", "privacy": "Integritetspolicy" }
}
```

## The type

`resolveJsonModule` in `tsconfig.json` lets the compiler read JSON. One language is the source
of truth; its shape is the type. Written as `typeof import(...)` it is a type-only reference and
puts nothing in the bundle:

```typescript
// src/copy/SiteCopy.ts
export type SiteCopy = typeof import('./en.json');
```

## Loading a language

A record of loaders gives the bundler one chunk per language and gives `tsc` the check that every
language has the keys of `en`: a key missing from `sv.json` makes the assignment to `SiteCopy`
fail to compile.

```typescript
const languages = {
    en: () => import('./copy/en.json'),
    sv: () => import('./copy/sv.json'),
};

export async function loadCopy(lang: keyof typeof languages): Promise<SiteCopy> {
    return (await languages[lang]()).default;
}
```

## In templates

Put the copy on the view model and `check` verifies every path against the JSON:

```typescript
interface HomePage {
    copy: SiteCopy;
    user: User;
}

const home = compileTemplate<HomePage>(`
    <a href="/how">{{copy.nav.how}}</a>
    <p>{{copy.footer.compnay}}</p>
`);
```

```
src/HomePage.ts:9:11 - error: Cannot resolve "copy.footer.compnay": { company: string; privacy: string; } has no property "compnay"
```

## In code

Outside templates it is an ordinary object, and `tsc` does the checking:

```typescript
document.title = copy.nav.about;
button.setAttribute('aria-label', copy.nav.menu);
```

## Keeping languages in sync

Assignability catches a missing key but not an extra one, so a key removed from `en.json` and
forgotten in `sv.json` is never reported by the compiler. One test closes that gap and picks up
new language files without edits:

```typescript
import { readdirSync, readFileSync } from 'node:fs';

function keyPaths(value: unknown, prefix = ''): string[] {
    if (typeof value !== 'object' || value === null) return [prefix];
    return Object.entries(value).flatMap(([key, child]) =>
        keyPaths(child, prefix ? `${prefix}.${key}` : key),
    );
}

it('every_language_has_exactly_the_keys_of_en', () => {
    const load = (file: string) => JSON.parse(readFileSync(`src/copy/${file}`, 'utf8'));
    const expected = keyPaths(load('en.json')).sort();
    for (const file of readdirSync('src/copy').filter(f => f.endsWith('.json'))) {
        expect(keyPaths(load(file)).sort(), file).toEqual(expected);
    }
});
```

## Typed copy or `t()`

| | Typed copy | `t()` |
|---|---|---|
| Wrong key is found | by `tsc` and `check`, before running | at render, by the missing handler |
| Plurals and `select` | no; use `t()` or [`Intl.PluralRules`](intl-standard.md) | ICU in the message |
| Loading | one import per language | namespaces, lazy or eager |
| Changing language at runtime | load the other file and re-render | `setLocale()` and the `localechange` event |
| Files | nested JSON, one per language | flat JSON, one per language and namespace |
