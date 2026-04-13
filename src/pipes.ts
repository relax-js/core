/**
 * @module pipes
 * Data transformation functions (pipes) for use in template expressions.
 * Pipes transform values for display, like formatting dates, currencies, or text.
 *
 * Locale-aware pipes (currency, date, daysAgo, pieces) use the i18n system
 * for formatting and translations. Call `setLocale()` before using these pipes.
 *
 * Pipes can be chained in templates: `{{value | uppercase | shorten:20}}`
 *
 * @example
 * // In templates
 * <span>{{user.name | uppercase}}</span>
 * <span>{{price | currency}}</span>
 * <span>{{createdAt | daysAgo}}</span>
 *
 * @example
 * // Programmatic usage
 * import { applyPipes, defaultPipes } from 'relaxjs';
 * const result = applyPipes('hello world', ['uppercase', 'shorten:8']);
 * // Returns: 'HELLO...'
 */

import { getCurrentLocale, t } from './i18n/i18n';

/**
 * Type definition for pipe transformation functions.
 * Pipes take a value and optional arguments, returning a transformed value.
 *
 * @example
 * // Define a custom pipe
 * const reversePipe: PipeFunction = (value: string) => {
 *     return value.split('').reverse().join('');
 * };
 */
export type PipeFunction = (value: any, ...args: any[]) => any;


//  =============================== Text manipulation pipes  ===========================



/**
 * Converts a string to uppercase
 * @param value The string to convert
 * @returns The uppercase string
 */
export function uppercasePipe(value: string): string {
    return String(value).toUpperCase();
}

/**
 * Converts a string to uppercase
 * @param value The string to convert
 * @returns The uppercase string
 */
export function trimPipe(value: string): string {
    return String(value).trimEnd().trimStart();
}


/**
 * Converts a string to lowercase
 * @param value The string to convert
 * @returns The lowercase string
 */
export function lowercasePipe(value: string): string {
    return String(value).toLowerCase();
}

/**
 * Capitalizes the first character of a string
 * @param value The string to capitalize
 * @returns The capitalized string
 */
export function capitalizePipe(value: string): string {
    const str = String(value);
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Shortens a string to a specified length and adds ellipsis.
 * @param value The string to shorten
 * @param length Maximum length including ellipsis
 * @returns The shortened string with ellipsis if needed
 */
export function shortenPipe(value: string, length: string): string {
    const str = String(value);
    const maxLength = parseInt(length, 10);
    return str.length > maxLength
        ? str.substring(0, maxLength - 3) + '...'
        : str;
}

// Formatting pipes
/**
 * Formats a number as currency using the current locale.
 * Uses the i18n system's current locale for formatting.
 *
 * @param value The number to format
 * @param currency Currency code (defaults to USD)
 * @returns Formatted currency string
 *
 * @example
 * // In template: {{price | currency}} or {{price | currency:EUR}}
 * currencyPipe(1234.56);        // "$1,234.56" (en) or "1 234,56 $" (sv)
 * currencyPipe(1234.56, 'SEK'); // "SEK 1,234.56" (en) or "1 234,56 kr" (sv)
 */
export function currencyPipe(value: number, currency: string = 'USD'): string {
    const locale = getCurrentLocale();
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency
    }).format(value);
}

/**
 * Formats a date value according to the specified format.
 * Uses the i18n system's current locale for formatting.
 *
 * @param value Date value (string, number, or Date object)
 * @param format Format type: 'short', 'long', or default (ISO)
 * @returns Formatted date string
 *
 * @example
 * // In template: {{date | date:short}} or {{date | date:long}}
 * datePipe(new Date(), 'short'); // "1/15/2024" (en) or "2024-01-15" (sv)
 * datePipe(new Date(), 'long');  // "Monday, January 15, 2024" (en) or "måndag 15 januari 2024" (sv)
 */
export function datePipe(value: string | number | Date, format?: string): string {
    const date = new Date(value);
    const locale = getCurrentLocale();
    if (format === 'short') {
        return date.toLocaleDateString(locale);
    } else if (format === 'long') {
        return date.toLocaleDateString(locale, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
    return date.toISOString();
}

/**
 * Prints today, yesterday or X days ago.
 * Uses the i18n system for translations (requires pipes namespace loaded).
 *
 * @param value Date value (string, number, or Date object)
 * @returns Formatted relative date string
 *
 * @example
 * // In template: {{createdAt | daysAgo}}
 * // English: "today", "yesterday", "3 days ago"
 * // Swedish: "idag", "igår", "3 dagar sedan"
 */
export function daysAgoPipe(value: string | number | Date): string {
    if (!value) {
        return 'n/a';
    }

    const inputDate = new Date(value);
    const today = new Date();

    // Normalize times to midnight to compare only dates
    inputDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const diffTime = today.getTime() - inputDate.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return t('r-pipes:today');
    if (diffDays === 1) return t('r-pipes:yesterday');
    return t('r-pipes:daysAgo', { count: diffDays });
}

/**
 * Formats a count as pieces/items.
 * Uses the i18n system for translations (requires pipes namespace loaded).
 *
 * @param value Count value
 * @returns Formatted piece count string
 *
 * @example
 * // In template: {{quantity | pieces}}
 * // English: "none", "one", "3 pcs"
 * // Swedish: "inga", "en", "3 st"
 */
export function piecesPipe(value: string | number): string {
    if (value === null || value === undefined) {
        return 'n/a';
    }

    const count = Number(value);
    return t('r-pipes:pieces', { count });
}



//  =============================== Array operation pipes  ===========================



/**
 * Joins array elements with the specified separator
 * @param value Array to join
 * @param separator Character(s) to use between elements (defaults to comma)
 * @returns Joined string or original value if not an array
 */
export function joinPipe(value: any[], separator: string = ','): string | any {
    if (!Array.isArray(value)) return value;
    return value.join(separator);
}

/**
 * Returns the first element of an array
 * @param value Array to extract from
 * @returns First element or empty string if array is empty/invalid
 */
export function firstPipe(value: any[]): any {
    if (!Array.isArray(value) || value.length === 0) return '';
    return value[0];
}

/**
 * Returns the last element of an array
 * @param value Array to extract from
 * @returns Last element or empty string if array is empty/invalid
 */
export function lastPipe(value: any[]): any {
    if (!Array.isArray(value) || value.length === 0) return '';
    return value[value.length - 1];
}

// Object operation pipes
/**
 * Returns the keys of an object
 * @param value Object to extract keys from
 * @returns Array of object keys or empty array if not an object
 */
export function keysPipe(value: object): string[] {
    if (typeof value !== 'object' || value === null) return [];
    return Object.keys(value);
}

// Conditional pipes
/**
 * Returns a default value if the input is falsy
 * @param value Input value to check
 * @param defaultValue Value to return if input is falsy
 * @returns Original value or default value
 */
export function defaultPipe(value: any, defaultValue: string): any {
    return value || defaultValue;
}

/**
 * Implements ternary operator as a pipe
 * @param value Condition to evaluate
 * @param trueValue Value to return if condition is truthy
 * @param falseValue Value to return if condition is falsy
 * @returns Selected value based on condition
 */
export function ternaryPipe(value: any, trueValue: string, falseValue: string): string {
    return value ? trueValue : falseValue;
}



//  =============================== Pipe registry and application  ===========================


/**
 * Interface for a collection of pipe functions.
 * Use this to look up pipes by name for template processing.
 *
 * @example
 * // Check if a pipe exists before using
 * if (registry.has('currency')) {
 *     const formatted = registry.get('currency')(price);
 * }
 */
export interface PipeRegistry {
    /**
     * Looks up a pipe by name, returning null if not found.
     */
    lookup(name: string): PipeFunction | null;

    /**
     * Gets a pipe by name, throwing if not found.
     */
    get(name: string): PipeFunction;

    /**
     * Checks if a pipe with the given name exists.
     */
    has(name: string): boolean;
}


/**
 * Creates a new pipe registry with all built-in pipes registered.
 * Built-in pipes include:
 *
 * **Text:** uppercase, lowercase, capitalize, trim, shorten
 * **Formatting:** currency, date, daysAgo, pieces
 * **Arrays:** join, first, last
 * **Objects:** keys
 * **Conditionals:** default, ternary
 *
 * @returns A new pipe registry instance
 *
 * @example
 * const registry = createPipeRegistry();
 * const upperPipe = registry.get('uppercase');
 * console.log(upperPipe('hello')); // 'HELLO'
 */
export function createPipeRegistry(): PipeRegistry {
    const pipes = new Map<string, PipeFunction>();

    // Text manipulation
    pipes.set('uppercase', uppercasePipe);
    pipes.set('lowercase', lowercasePipe);
    pipes.set('capitalize', capitalizePipe);
    pipes.set('trim', trimPipe);
    pipes.set('shorten', shortenPipe);

    // Formatting
    pipes.set('currency', currencyPipe);
    pipes.set('date', datePipe);
    pipes.set('daysAgo', daysAgoPipe);
    pipes.set('pieces', piecesPipe);

    // Array operations
    pipes.set('join', joinPipe);
    pipes.set('first', firstPipe);
    pipes.set('last', lastPipe);

    // Object operations
    pipes.set('keys', keysPipe);

    // Conditional formatting
    pipes.set('default', defaultPipe);
    pipes.set('ternary', ternaryPipe);

    return {
        lookup(name) {
            return pipes.get(name) ?? null;
        },
        get(name) {
            var pipe = pipes.get(name);
            if (!pipe) {
                throw Error("Pipe '" + name + "' not found.");
            }
            return pipe;
        },
        has(name) {
            return pipes.has(name);
        },
    };
}

/**
 * Default pipe registry instance with all built-in pipes.
 * Used by template engines unless a custom registry is provided.
 *
 * @example
 * import { defaultPipes } from 'relaxjs';
 *
 * if (defaultPipes.has('uppercase')) {
 *     const result = defaultPipes.get('uppercase')('hello');
 * }
 */
export const defaultPipes = createPipeRegistry();

/**
 * Applies a series of pipes to a value sequentially.
 * Each pipe transforms the output of the previous pipe.
 *
 * Pipe arguments are specified after a colon: `shorten:20`
 *
 * @param value - Initial value to transform
 * @param pipes - Array of pipe strings (name and optional arguments separated by ':')
 * @param registry - Optional custom pipe registry (uses defaultPipes if not provided)
 * @returns The transformed value after applying all pipes
 *
 * @example
 * // Apply single pipe
 * applyPipes('hello', ['uppercase']); // 'HELLO'
 *
 * @example
 * // Chain multiple pipes
 * applyPipes('hello world', ['uppercase', 'shorten:8']); // 'HELLO...'
 *
 * @example
 * // With pipe arguments
 * applyPipes(1234.56, ['currency']); // '$1,234.56'
 */
export function applyPipes(
    value: any,
    pipes: string[],
    registry: PipeRegistry = defaultPipes
): any {

    return pipes.reduce((currentValue, pipe) => {
        const [pipeName, ...args] = pipe.split(':').map((p) => p.trim());

        if (!registry.has(pipeName)) {
            return `[Pipe ${pipeName} not found]`;
        }

        try {
            return registry.get(pipeName)(currentValue, ...args);
        } catch (error) {
            return `[Pipe ${pipeName}, value: ${value}, error: ${error}]`;
        }
    }, value);
}