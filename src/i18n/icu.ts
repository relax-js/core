/**
 * @module icu
 * ICU message format support for internationalization.
 * Provides pluralization, select, and value interpolation.
 *
 * @example
 * // Simple interpolation
 * formatICU('Hello, {name}!', { name: 'World' });
 * // Returns: 'Hello, World!'
 *
 * @example
 * // Pluralization
 * formatICU('{count, plural, one {# item} other {# items}}', { count: 5 });
 * // Returns: '5 items'
 *
 * @example
 * // Select
 * formatICU('{gender, select, male {He} female {She} other {They}}', { gender: 'female' });
 * // Returns: 'She'
 */

const pluralRulesCache = new Map<string, Intl.PluralRules>();

/**
 * Function type for message formatters.
 * Implement this to provide custom message formatting.
 */
export type MessageFormatter = (
    message: string,
    values?: Record<string, any>,
    locale?: string
) => string;


function getPluralRule(locale: string): Intl.PluralRules {
    if (!pluralRulesCache.has(locale)) {
        pluralRulesCache.set(locale, new Intl.PluralRules(locale));
    }
    return pluralRulesCache.get(locale)!;
}

function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Default ICU message formatter implementation.
 * Supports simple interpolation, pluralization with exact matches, and select.
 *
 * @param message - ICU format message string
 * @param values - Values to interpolate
 * @param locale - Locale for plural rules (default: 'en')
 * @returns Formatted message string
 *
 * @example
 * defaultFormatICU('{n, plural, =0 {none} one {# item} other {# items}}', { n: 0 }, 'en');
 * // Returns: 'none'
 *
 * @example
 * defaultFormatICU('{role, select, admin {Full access} other {Limited access}}', { role: 'admin' });
 * // Returns: 'Full access'
 */
export function defaultFormatICU(
    message: string,
    values: Record<string, any>,
    locale: string = 'en'
): string {
    return message.replace(
        /\{(\w+)(?:, (plural|select),((?:[^{}]*\{[^{}]*\})+))?\}/g,
        (_, key, type, categoriesPart) => {
            const value = values[key];

            if (type === 'plural') {
                const exact = new RegExp(
                    `=${escapeRegex(String(value))}\\s*\\{([^{}]*)\\}`
                ).exec(categoriesPart);
                if (exact) {
                    return exact[1]
                        .replace(`{${key}}`, String(value))
                        .replace('#', String(value));
                }

                const rules = getPluralRule(locale);
                const category = rules.select(value);
                const match =
                    new RegExp(`${category}\\s*\\{([^{}]*)\\}`).exec(categoriesPart) ||
                    new RegExp(`other\\s*\\{([^{}]*)\\}`).exec(categoriesPart);
                if (match) {
                    return match[1]
                        .replace(`{${key}}`, String(value))
                        .replace('#', String(value));
                }
                return String(value);
            }

            if (type === 'select') {
                const escaped = escapeRegex(String(value));
                const match =
                    new RegExp(`\\b${escaped}\\s*\\{([^{}]*)\\}`).exec(categoriesPart) ||
                    new RegExp(`\\bother\\s*\\{([^{}]*)\\}`).exec(categoriesPart);
                return match ? match[1] : String(value);
            }

            return value !== undefined ? String(value) : `{${key}}`;
        },
    );
}

/**
 * The active message formatter. Defaults to `defaultFormatICU`.
 * Can be replaced with `setMessageFormatter` for custom formatting.
 */
export let formatICU: MessageFormatter = defaultFormatICU;

/**
 * Replaces the default message formatter with a custom implementation.
 * Use this to integrate with external i18n libraries like FormatJS.
 *
 * @param formatter - The custom formatter function
 *
 * @example
 * // Use FormatJS IntlMessageFormat
 * import { IntlMessageFormat } from 'intl-messageformat';
 *
 * setMessageFormatter((message, values, locale) => {
 *     const fmt = new IntlMessageFormat(message, locale);
 *     return fmt.format(values);
 * });
 */
export function setMessageFormatter(formatter: MessageFormatter) {
    formatICU = formatter;
}