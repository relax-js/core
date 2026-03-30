# Translations

Relaxjs provides namespace-based translations with ICU message format, lazy loading, and locale change events.

```typescript
import { setLocale, loadNamespaces, t } from '@relax.js/core/i18n';

await setLocale('sv');
await loadNamespaces(['r-pipes', 'r-validation']);

t('greeting', { name: 'Anna' });         // "Hej, Anna!"
t('items', { count: 3 });                // "3 saker"
t('r-pipes:daysAgo', { count: 2 });      // "2 dagar sedan"
```

For full documentation, see the [i18n guide](i18n/i18n.md). It covers:

- Translation file structure and folder layout
- The `t()` function, namespaces, and key format
- ICU message format (interpolation, pluralization, select)
- Built-in namespaces (`r-common`, `r-pipes`, `r-validation`)
- Locale switching and `LocaleChangeEvent`
- Missing translation handling
- Custom message formatters
- Pipe integration
- Adding new locales
- Full API reference
