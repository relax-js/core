/**
 * @module i18n
 * Internationalization support with namespace-based translations.
 * Uses ICU message format for pluralization, select, and formatting.
 *
 * @example
 * // Initialize locale
 * await setLocale('sv');
 *
 * // Use translations
 * const greeting = t('r-common:greeting', { name: 'John' });
 * const items = t('shop:items', { count: 5 });
 */

import { formatICU } from './icu';

type Locale = string;
type Namespace = string;
type TranslationMap = Record<string, string>;
type Translations = Record<Namespace, TranslationMap>;

export type MissingTranslationHandler = (
    key: string,
    namespace: string,
    locale: string,
) => void;

/**
 * Dispatched on `document` after `setLocale()` completes.
 * The `locale` property contains the new normalized locale code.
 *
 * @example
 * document.addEventListener('localechange', (e) => {
 *     console.log(`Locale changed to ${e.locale}`);
 *     this.render();
 * });
 */
export class LocaleChangeEvent extends Event {
    readonly locale: string;
    constructor(locale: string) {
        super('localechange', { bubbles: false });
        this.locale = locale;
    }
}

declare global {
    interface DocumentEventMap {
        localechange: LocaleChangeEvent;
    }
}

const fallbackLocale: Locale = 'en';
let currentLocale: Locale = fallbackLocale;
const loadedNamespaces = new Set<Namespace>();
const translations: Translations = {};
let missingHandler: MissingTranslationHandler | null = null;

function normalizeLocale(locale: string): string {
    return locale.toLowerCase().split('-')[0];
}

/**
 * Sets the current locale and loads the common namespace.
 * Clears previously loaded translations and dispatches a `localechange` event.
 *
 * @param locale - The locale code (e.g., 'en', 'sv', 'en-US')
 *
 * @example
 * await setLocale('sv');
 */
export async function setLocale(locale: string): Promise<void> {
    const normalized = normalizeLocale(locale);
    currentLocale = normalized;
    loadedNamespaces.clear();
    Object.keys(translations).forEach(ns => delete translations[ns]);
    await loadNamespace('r-common');
    if (typeof document !== 'undefined') {
        document.dispatchEvent(new LocaleChangeEvent(normalized));
    }
}

/**
 * Loads a translation namespace on demand.
 * Falls back to the default locale if translations are not found.
 *
 * @param namespace - The namespace to load (e.g., 'shop', 'errors')
 *
 * @example
 * await loadNamespace('shop');
 * const price = t('shop:priceLabel');
 */
export async function loadNamespace(namespace: Namespace): Promise<void> {
    if (loadedNamespaces.has(namespace)) return;

    try {
        const module = await import(`./locales/${currentLocale}/${namespace}.json`);
        translations[namespace] = module.default;
        loadedNamespaces.add(namespace);
    } catch (err) {
        if (currentLocale !== fallbackLocale) {
            const fallback = await import(`./locales/${fallbackLocale}/${namespace}.json`);
            translations[namespace] = fallback.default;
            loadedNamespaces.add(namespace);
        } else {
            console.warn(`i18n: Failed to load namespace '${namespace}' for locale '${currentLocale}'`);
        }
    }
}

/**
 * Loads multiple translation namespaces in parallel.
 *
 * @param namespaces - Array of namespace names to load
 *
 * @example
 * await loadNamespaces(['r-pipes', 'r-validation']);
 */
export async function loadNamespaces(namespaces: Namespace[]): Promise<void> {
    await Promise.all(namespaces.map(ns => loadNamespace(ns)));
}

/**
 * Translates a key with optional value interpolation.
 * Supports ICU message format for pluralization and select.
 *
 * @param fullKey - Translation key in format 'namespace:key' or just 'key' (uses 'r-common')
 * @param values - Values to interpolate into the message
 * @returns The translated string, or the key if not found
 *
 * @example
 * // Simple translation
 * t('greeting'); // Uses r-common:greeting
 *
 * // With namespace
 * t('errors:notFound');
 *
 * // With interpolation
 * t('welcome', { name: 'John' }); // "Welcome, John!"
 *
 * // With pluralization (ICU format)
 * t('items', { count: 5 }); // "5 items" or "5 föremål"
 */
export function t(fullKey: string, values?: Record<string, any>): string {
    const [namespace, key] = fullKey.includes(':')
        ? fullKey.split(':')
        : ['r-common', fullKey];
    const message = translations[namespace]?.[key];
    if (!message) {
        if (missingHandler) missingHandler(key, namespace, currentLocale);
        return fullKey;
    }
    try {
        return formatICU(message, values, currentLocale) as string;
    } catch {
        return fullKey;
    }
}

/**
 * Returns the current locale code.
 *
 * @returns The normalized locale code (e.g., 'en', 'sv')
 */
export function getCurrentLocale(): string {
    return currentLocale;
}

/**
 * Registers a handler called when `t()` encounters a missing translation key.
 * Pass `null` to remove the handler.
 *
 * @param handler - Callback receiving the key, namespace, and locale
 *
 * @example
 * onMissingTranslation((key, ns, locale) => {
 *     console.warn(`Missing: ${ns}:${key} [${locale}]`);
 * });
 */
export function onMissingTranslation(handler: MissingTranslationHandler | null): void {
    missingHandler = handler;
}
