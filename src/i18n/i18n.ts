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
import { registerBuiltinNamespaces } from './builtins';
import { normalizeLocale, resolveNamespace, TranslationMap } from './catalogue';

type Locale = string;
type Namespace = string;
type Translations = Record<Namespace, TranslationMap>;

/**
 * Extra behaviour for a single `t()` call.
 */
export interface TranslateOptions {
    /**
     * Text to show when the key is missing, instead of the key itself.
     *
     * Use it for wording that must never be absent, such as a legally required
     * notice. The fallback goes through the same formatter, so it can contain
     * placeholders.
     */
    fallback?: string;
}

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

registerBuiltinNamespaces();

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

async function tryResolve(
    locale: Locale,
    namespace: Namespace,
): Promise<TranslationMap | undefined> {
    try {
        return await resolveNamespace(locale, namespace);
    } catch (err) {
        console.warn(
            `i18n: could not load namespace '${namespace}' for locale '${locale}'.`,
            err,
        );
        return undefined;
    }
}

/**
 * Loads a translation namespace from the catalogue.
 * Falls back to the default locale when the namespace is not translated yet.
 *
 * Never rejects. A namespace nobody registered is reported as a warning so that
 * one forgotten file cannot stop the application from starting.
 *
 * @param namespace - The namespace to load (e.g., 'shop', 'errors')
 *
 * @example
 * await loadNamespace('shop');
 * const price = t('shop:priceLabel');
 */
export async function loadNamespace(namespace: Namespace): Promise<void> {
    if (loadedNamespaces.has(namespace)) return;

    let messages = await tryResolve(currentLocale, namespace);
    if (!messages && currentLocale !== fallbackLocale) {
        messages = await tryResolve(fallbackLocale, namespace);
    }

    if (!messages) {
        console.warn(
            `i18n: namespace '${namespace}' is not registered for locale '${currentLocale}'. ` +
            `Register it during startup with registerCatalogue() or registerNamespace().`,
        );
        return;
    }

    translations[namespace] = messages;
    loadedNamespaces.add(namespace);
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
 * @param options - Set `fallback` for text that must never be missing
 * @returns The translated string, the fallback, or the key if neither is available
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
 *
 * // Wording that must never render as a raw key
 * t('shell:aiDisclosure', undefined, {
 *     fallback: 'You are interacting with an AI system.',
 * });
 */
export function t(
    fullKey: string,
    values?: Record<string, any>,
    options?: TranslateOptions,
): string {
    const [namespace, key] = fullKey.includes(':')
        ? fullKey.split(':')
        : ['r-common', fullKey];
    const message = translations[namespace]?.[key];

    if (!message) {
        if (missingHandler) missingHandler(key, namespace, currentLocale);
        if (options?.fallback === undefined) return fullKey;
        return format(options.fallback, values, options.fallback);
    }

    return format(message, values, options?.fallback ?? fullKey);
}

function format(message: string, values: Record<string, any> | undefined, onError: string): string {
    try {
        return formatICU(message, values, currentLocale) as string;
    } catch {
        return onError;
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
