/**
 * @module FormReader
 * Utilities for reading form data into typed objects.
 * Handles type conversion based on input types and data-type attributes.
 *
 * @example
 * // Basic form reading
 * const form = document.querySelector('form');
 * const data = readData(form);
 *
 * // Type-safe mapping to a class instance
 * const user = mapFormToClass(form, new UserDTO());
 */

import { getCurrentLocale } from '../i18n/i18n';

/**
 * Maps form field values to a class instance's properties.
 * Automatically converts values based on input types (checkbox, number, date).
 *
 * Form field names must match property names on the target instance.
 *
 * @template T - The type of the class instance
 * @param form - The HTML form element to read from
 * @param instance - The class instance to populate
 * @param options - Configuration options
 * @param options.throwOnMissingProperty - Throw if form field has no matching property
 * @param options.throwOnMissingField - Throw if class property has no matching form field
 * @returns The populated instance
 *
 * @example
 * class UserDTO {
 *     name: string = '';
 *     email: string = '';
 *     age: number = 0;
 *     newsletter: boolean = false;
 * }
 *
 * const form = document.querySelector('form');
 * const user = mapFormToClass(form, new UserDTO());
 * console.log(user.name, user.age, user.newsletter);
 *
 * @example
 * // With validation
 * const user = mapFormToClass(form, new UserDTO(), {
 *     throwOnMissingProperty: true,  // Catch typos in form field names
 *     throwOnMissingField: true      // Ensure all DTO fields are in form
 * });
 */
export function mapFormToClass<T extends object>(
    form: HTMLFormElement,
    instance: T,
    options: {
        throwOnMissingProperty?: boolean;
        throwOnMissingField?: boolean;
    } = {}
): T {
    const formElements = form.querySelectorAll('input, select, textarea');

    formElements.forEach((element) => {
        if (!element.hasAttribute('name')) return;
        if (booleanAttr(element, 'disabled')) return;

        const propertyName = element.getAttribute('name')!;

        if (!(propertyName in instance)) {
            if (options.throwOnMissingProperty) {
                throw new Error(
                    `Form field "${propertyName}" has no matching property in class instance`
                );
            }
            return;
        }

        const value = readElementValue(element);
        if (value === SKIP) return;

        (instance as Record<string, unknown>)[propertyName] = value;
    });

    if (options.throwOnMissingField) {
        const formFieldNames = new Set<string>();
        formElements.forEach((element) => {
            if (element.hasAttribute('name')) {
                formFieldNames.add(element.getAttribute('name')!);
            }
        });

        for (const prop in instance) {
            if (
                typeof instance[prop] !== 'function' &&
                Object.prototype.hasOwnProperty.call(instance, prop) &&
                !formFieldNames.has(prop)
            ) {
                throw new Error(
                    `Class property "${prop}" has no matching form field`
                );
            }
        }
    }

    return instance;
}

/**
 * Configuration options for form reading operations.
 */
export interface FormReaderOptions {
    /** Prefix to strip from field names when mapping to properties */
    prefix?: string;
    /** If true, checkboxes return their value instead of true/false */
    disableBinaryCheckbox?: boolean;
    /** If true, radio buttons return their value instead of true/false */
    disableBinaryRadioButton?: boolean;
}

/**
 * Gets the appropriate type converter function for a form element.
 * Uses the `data-type` attribute if present, otherwise infers from input type.
 *
 * @param element - The form element to get a converter for
 * @returns A function that converts string values to the appropriate type
 *
 * @example
 * // With data-type attribute
 * <input name="age" data-type="number" />
 * const converter = getDataConverter(input);
 * converter('42'); // Returns: 42 (number)
 *
 * @example
 * // Inferred from input type
 * <input type="checkbox" name="active" />
 * const converter = getDataConverter(checkbox);
 * converter('true'); // Returns: true (boolean)
 */
export function getDataConverter(element: HTMLElement): ConverterFunc {
    const dataType = element.getAttribute('data-type') as DataType | null;
    if (dataType) {
        return createConverterFromDataType(dataType);
    }

    if (element instanceof HTMLInputElement) {
        return createConverterFromInputType(element.type as InputType);
    }

    // Handle custom form-associated elements with checked property (boolean values)
    if ('checked' in element && typeof (element as any).checked === 'boolean') {
        return BooleanConverter as ConverterFunc;
    }

    return (str) => str;
}


/**
 * Reads all form data into a plain object with automatic type conversion.
 * Handles multiple values (e.g., multi-select) and custom form-associated elements.
 *
 * Type conversion is based on:
 * 1. `data-type` attribute if present (number, boolean, string, Date)
 * 2. Input type (checkbox, number, date, etc.)
 * 3. Falls back to string
 *
 * @param form - The HTML form element to read
 * @returns Object with property names matching field names
 *
 * @example
 * // HTML form
 * <form>
 *     <input name="username" value="john" />
 *     <input name="age" type="number" value="25" />
 *     <input name="active" type="checkbox" checked />
 *     <select name="colors" multiple>
 *         <option value="red" selected>Red</option>
 *         <option value="blue" selected>Blue</option>
 *     </select>
 * </form>
 *
 * // Reading the form
 * const data = readData(form);
 * // Returns: { username: 'john', age: 25, active: true, colors: ['red', 'blue'] }
 *
 * @example
 * // With custom form elements
 * <form>
 *     <r-input name="email" value="test@example.com" />
 *     <r-checkbox name="terms" checked />
 * </form>
 * const data = readData(form);
 1*/
export function readData<T = Record<string, unknown>>(form: HTMLFormElement): T{
    const data: Record<string, unknown> = {};
    const formData = new FormData(form);
    const seen = new Set<string>();

    formData.forEach((_, name) => {
        if (seen.has(name)) return;
        seen.add(name);

        const values = formData.getAll(name);
        const element = form.elements.namedItem(name);
        const converter = element ? getDataConverter(element as HTMLElement) : (v: string) => v;

        if (values.length === 1) {
            const v = values[0];
            data[name] = typeof v === 'string' ? converter(v) : v;
        } else {
            data[name] = values.map(v => typeof v === 'string' ? converter(v) : v);
        }
    });

    for (let i = 0; i < form.elements.length; i++) {
        const el = form.elements[i] as HTMLInputElement;
        if (el.type === 'checkbox' && el.name && !seen.has(el.name)) {
            seen.add(el.name);
            data[el.name] = false;
        }
    }

    return data as T;
}

/**
 * Function type for converting string form values to typed values.
 */
export type ConverterFunc = (value: string) => unknown;

/**
 * Supported data-type attribute values for explicit type conversion.
 */
export type DataType = 'number' | 'boolean' | 'string' | 'Date';

/**
 * Supported HTML input types for automatic type inference.
 */
export type InputType =
    | 'tel'
    | 'text'
    | 'checkbox'
    | 'radio'
    | 'number'
    | 'color'
    | 'date'
    | 'datetime-local'
    | 'month'
    | 'week'
    | 'time';

/**
 * Converts string values to booleans.
 * Handles 'true'/'false' strings and numeric values (>0 is true).
 *
 * @param value - String value to convert
 * @returns Boolean value or undefined if empty
 * @throws Error if value cannot be interpreted as boolean
 */
export function BooleanConverter(value?: string): boolean | undefined {
    if (!value || value == '') {
        return undefined;
    }

    const lower = value.toLowerCase();

    if (lower === 'true' || lower === 'on' || Number(value) > 0) {
        return true;
    }

    if (lower === 'false' || lower === 'off' || Number(value) <= 0) {
        return false;
    }

    throw new Error("Could not convert value '" + value + "' to boolean.");
}

/**
 * Converts string values to numbers.
 *
 * @param value - String value to convert
 * @returns Number value or undefined if empty
 * @throws Error if value is not a valid number
 */
export function NumberConverter(value?: string): number | undefined {
    if (!value || value == '') {
        return undefined;
    }
    const nr = Number(value);
    if (!isNaN(nr)) {
        return nr;
    }
    throw new Error("Could not convert value '" + value + "' to number.");
}

/**
 * Detects the order of day/month/year parts for a given locale
 * using `Intl.DateTimeFormat.formatToParts`.
 *
 * @example
 * getLocaleDateOrder('en-US')  // ['month', 'day', 'year']
 * getLocaleDateOrder('sv')     // ['year', 'month', 'day']
 * getLocaleDateOrder('de')     // ['day', 'month', 'year']
 */
function getLocaleDateOrder(locale: string): ('day' | 'month' | 'year')[] {
    const parts = new Intl.DateTimeFormat(locale).formatToParts(new Date(2024, 0, 15));
    return parts
        .filter((p): p is Intl.DateTimeFormatPart & { type: 'day' | 'month' | 'year' } =>
            p.type === 'day' || p.type === 'month' || p.type === 'year')
        .map(p => p.type);
}

/**
 * Converts string values to Date objects.
 * Supports both ISO format (`2024-01-15`) and locale-specific formats
 * (`01/15/2024` for en-US, `15.01.2024` for de, etc.) based on the
 * current i18n locale.
 *
 * @param value - Date string in ISO or locale format
 * @returns Date object
 * @throws Error if value is not a valid date
 *
 * @example
 * // ISO format (from <input type="date">)
 * DateConverter('2024-01-15')   // Date(2024, 0, 15)
 *
 * // Locale format (from <input type="text" data-type="Date">)
 * // with locale set to 'sv': 2024-01-15
 * // with locale set to 'en-US': 01/15/2024
 * // with locale set to 'de': 15.01.2024
 */
export function DateConverter(value: string): Date | undefined {
    if (!value || value === '') return undefined;

    if (/^\d{4}-\d{2}-\d{2}(T|$)/.test(value)) {
        const date = new Date(value);
        if (!isNaN(date.getTime())) return date;
    }

    const numericParts = value.split(/[\/.\-\s]/);
    if (numericParts.length >= 3 && numericParts.every(p => /^\d+$/.test(p))) {
        const locale = getCurrentLocale();
        const order = getLocaleDateOrder(locale);
        const mapped: Record<string, number> = {};
        order.forEach((type, i) => {
            mapped[type] = parseInt(numericParts[i], 10);
        });

        if (mapped.year !== undefined && mapped.month !== undefined && mapped.day !== undefined) {
            if (mapped.year < 100) mapped.year += 2000;
            const date = new Date(mapped.year, mapped.month - 1, mapped.day);
            if (!isNaN(date.getTime())) return date;
        }
    }

    const date = new Date(value);
    if (isNaN(date.getTime())) {
        throw new Error('Invalid date format');
    }
    return date;
}

/**
 * Creates a converter function based on the data-type attribute value.
 *
 * @param dataType - The data-type attribute value
 * @returns Appropriate converter function for the type
 */
export function createConverterFromDataType(dataType: DataType): ConverterFunc {
    switch (dataType) {
        case 'boolean':
            return BooleanConverter as ConverterFunc;
        case 'number':
            return NumberConverter as ConverterFunc;
        case 'Date':
            return DateConverter;
        case 'string':
            return (value) => (!value || value == '' ? undefined : value);
        default:
            throw new Error(`Unknown data-type "${dataType}".`);
    }
}

/**
 * Creates a converter function based on HTML input type.
 * Handles special types like checkbox, date, time, week, and month.
 *
 * @param inputType - The HTML input type attribute value
 * @returns Appropriate converter function for the type
 */
export function createConverterFromInputType(inputType: InputType): ConverterFunc {
    switch (inputType) {
        case 'checkbox':
            return BooleanConverter as ConverterFunc;

        case 'number':
            return NumberConverter as ConverterFunc;

        case 'date':
        case 'datetime-local':
            return DateConverter;

        case 'month':
            return (value) => {
                const [year, month] = value.split('-').map(Number);
                return new Date(year, month - 1);
            };

        case 'week':
            return (value) => {
                const [year, week] = value.split('-W').map(Number);
                return { year, week };
            };

        case 'time':
            return (value) => {
                const [hours, minutes, seconds = 0] = value.split(':').map(Number);
                return { hours, minutes, seconds };
            };

        default:
            return (value) => (!value || value == '' ? undefined : value);
    }
}

function booleanAttr(element: Element, name: string): boolean {
    const el = element as Record<string, any>;
    if (name in el && typeof el[name] === 'boolean') return el[name];
    const attr = element.getAttribute(name);
    if (attr === null) return false;
    if (attr === '' || attr.toLowerCase() === 'true' || attr.toLowerCase() === name) return true;
    return false;
}

const SKIP = Symbol('skip');

function readElementValue(element: Element): unknown {
    const el = element as Record<string, any>;
    const type = el.type || element.getAttribute('type') || '';

    if (type === 'checkbox') {
        return booleanAttr(element, 'checked');
    }

    if (type === 'radio') {
        if (!booleanAttr(element, 'checked')) return SKIP;
        return el.value;
    }

    if (type === 'number') {
        return el.value ? Number(el.value) : null;
    }

    if (type === 'date') {
        return el.value ? new Date(el.value) : null;
    }

    if ('selectedOptions' in el && booleanAttr(element, 'multiple')) {
        return Array.from(el.selectedOptions as NodeListOf<HTMLOptionElement>)
            .map((o: HTMLOptionElement) => o.value);
    }

    if ('value' in el) {
        return el.value;
    }

    return undefined;
}