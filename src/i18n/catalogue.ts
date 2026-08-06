/**
 * @module i18n/catalogue
 * Registry of translation files, filled by the application at startup.
 *
 * A bundler resolves import paths relative to the file that contains them, so a
 * library can never discover translation files that live in an application. The
 * application therefore hands its files to the library instead.
 *
 * @example
 * // Vite
 * import { registerCatalogue } from '@relax.js/core/i18n';
 * registerCatalogue(import.meta.glob('./locales/*\/*.json', { eager: true }));
 *
 * @example
 * // Any bundler, or no bundler at all
 * import { registerNamespace } from '@relax.js/core/i18n';
 * import shellEn from './locales/en/shell.json';
 * registerNamespace('en', 'shell', shellEn);
 */

export type TranslationMap = Record<string, string>;

/**
 * Loads a namespace the first time it is used, so translations for locales
 * nobody selects stay out of the initial download.
 */
export type NamespaceLoader = () => Promise<TranslationMap | { default: TranslationMap }>;

/**
 * A namespace given either as ready messages or as a loader that fetches them.
 */
export type NamespaceSource = TranslationMap | NamespaceLoader;

const catalogue: Record<string, Record<string, NamespaceSource>> = {};

/**
 * Reduces `en-US` to `en`, so a browser language matches a translation folder.
 */
export function normalizeLocale(locale: string): string {
    return locale.toLowerCase().split('-')[0];
}

function unwrapModule(value: TranslationMap | { default: TranslationMap }): TranslationMap {
    const candidate = (value as { default?: TranslationMap }).default;
    return candidate && typeof candidate === 'object' ? candidate : (value as TranslationMap);
}

/**
 * Adds a single namespace to the catalogue.
 *
 * Registering the same locale and namespace twice replaces the previous entry,
 * which lets an application override a built-in namespace such as `r-validation`.
 *
 * @param locale - Locale code, normalized the same way as `setLocale()`
 * @param namespace - Namespace name used in front of the colon in `t('shell:title')`
 * @param source - The messages, or a function that loads them on first use
 *
 * @example
 * import shellEn from './locales/en/shell.json';
 * registerNamespace('en', 'shell', shellEn);
 *
 * @example
 * registerNamespace('sv', 'shell', () => import('./locales/sv/shell.json'));
 */
export function registerNamespace(
    locale: string,
    namespace: string,
    source: NamespaceSource,
): void {
    const normalized = normalizeLocale(locale);
    if (!catalogue[normalized]) catalogue[normalized] = {};
    catalogue[normalized][namespace] = source;
}

/**
 * Adds every namespace in a path-keyed record, so a whole `locales/` folder is
 * registered in one call.
 *
 * The locale and namespace are read from the last two segments of each key, so
 * `./locales/en/shell.json` becomes locale `en` and namespace `shell`. Values may
 * be the messages, a module with the messages as its default export, or a
 * function returning either. That covers Vite's eager and lazy `import.meta.glob`,
 * webpack's `require.context`, and a plain object written by hand.
 *
 * @param modules - Record keyed by file path
 *
 * @example
 * // Vite, everything in the first download
 * registerCatalogue(import.meta.glob('./locales/*\/*.json', { eager: true }));
 *
 * @example
 * // Vite, each locale downloaded when it is first selected
 * registerCatalogue(import.meta.glob('./locales/*\/*.json'));
 *
 * @example
 * // No bundler
 * registerCatalogue({
 *     './locales/en/shell.json': { title: 'Dashboard' },
 *     './locales/sv/shell.json': { title: 'Instrumentpanel' },
 * });
 */
export function registerCatalogue(modules: Record<string, unknown>): void {
    for (const path of Object.keys(modules)) {
        const segments = path.replace(/\.json$/i, '').split('/').filter(Boolean);
        if (segments.length < 2) {
            console.warn(
                `i18n: skipped catalogue entry '${path}' because it has no {locale}/{namespace} part.`,
            );
            continue;
        }
        const namespace = segments[segments.length - 1];
        const locale = segments[segments.length - 2];
        registerNamespace(locale, namespace, modules[path] as NamespaceSource);
    }
}

/**
 * Returns the messages for a namespace, or `undefined` when it was never registered.
 *
 * Rejects when a registered loader fails, so a network error is reported rather
 * than mistaken for a namespace nobody registered.
 */
export async function resolveNamespace(
    locale: string,
    namespace: string,
): Promise<TranslationMap | undefined> {
    const source = catalogue[normalizeLocale(locale)]?.[namespace];
    if (!source) return undefined;
    if (typeof source === 'function') return unwrapModule(await source());
    return unwrapModule(source);
}
