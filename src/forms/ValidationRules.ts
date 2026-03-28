/**
 * @module ValidationRules
 * Form validation rules for use with FormValidator.
 * Provides declarative validation through decorators.
 *
 * Validation messages use the i18n system. Load the 'r-validation' namespace
 * for localized error messages:
 *
 * @example
 * await loadNamespace('r-validation');
 *
 * @example
 * // In HTML, use validation attributes
 * <input name="age" data-validate="required range(0-120)" />
 */

import { t } from '../i18n/i18n';

/**
 * Context provided to validators during validation.
 */
export interface ValidationContext {
    /** The HTML input type (text, number, email, etc.) */
    inputType: string;
    /** The data-type attribute value if present */
    dataType?: string;
    /** Adds an error message to the validation result */
    addError(message: string): void;
}

/**
 * Interface for custom validators.
 * @internal
 */
interface Validator {
    /**
     * Validates the given value.
     * @param value - The string value to validate
     * @param context - Validation context with type info and error reporting
     */
    validate(value: string, context: ValidationContext): void;
}

/** @internal */
interface ValidatorRegistryEntry {
    validator: { new (): Validator };
    validInputTypes: string[];
}

const validators: Map<string, ValidatorRegistryEntry> = new Map();

/**
 * Decorator to register a validator class for a specific validation name.
 *
 * @param validationName - The name used in data-validate attribute
 * @param validInputTypes - Optional list of input types this validator applies to
 *
 * @example
 * @RegisterValidator('email')
 * class EmailValidation implements Validator {
 *     validate(value: string, context: ValidationContext) {
 *         if (!value.includes('@')) {
 *             context.addError('Invalid email address');
 *         }
 *     }
 * }
 */
export function RegisterValidator(validationName: string, validInputTypes: string[] = []) {
    return function (target: { new (...args: unknown[]): Validator }) {
        validators.set(validationName, { validator: target, validInputTypes });
    };
}

/**
 * Looks up a registered validator by name.
 *
 * @param name - The validator name used in `data-validate`
 * @returns The registry entry, or `undefined` if not found
 */
export function getValidator(name: string): ValidatorRegistryEntry | undefined {
    return validators.get(name);
}

/**
 * Validates that a field has a non-empty value.
 * Use with `data-validate="required"`.
 */
@RegisterValidator('required')
export class RequiredValidation implements Validator {
    static create(rule: string): RequiredValidation | null {
        return rule === 'required' ? new RequiredValidation() : null;
    }

    validate(value: string, context: ValidationContext) {
        if (value.trim() !== ''){
            return;
        }

        context.addError(this.getMessage());
    }

    getMessage(): string {
        return t('r-validation:required');
    }
}

/**
 * Validates that a numeric value falls within a specified range.
 * Use with `data-validate="range(min-max)"`.
 *
 * @example
 * <input name="age" type="number" data-validate="range(0-120)" />
 */
@RegisterValidator('range', ['number'])
export class RangeValidation implements Validator {
    min: number;
    max: number;

    constructor(min: number, max: number) {
        this.min = min;
        this.max = max;
    }

    static create(rule: string): RangeValidation | null {
        const rangeMatch = rule.match(/^range\((-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)\)$/);
        if (rangeMatch) {
            const [, min, max] = rangeMatch;
            return new RangeValidation(parseFloat(min), parseFloat(max));
        }
        return null;
    }

    validate(value: string, context: ValidationContext) {
        if (value.trim() === '') return;

        const num = parseFloat(value);
        if (!isNaN(num) && num >= this.min && num <= this.max){
            return;
        }

        context.addError(this.getMessage(value));
    }

    getMessage(actual: string): string {
        return t('r-validation:range', { min: this.min, max: this.max, actual });
    }
}

/**
 * Validates that a value contains only numeric digits (0-9).
 * Use with `data-validate="digits"`.
 */
@RegisterValidator('digits', ['number'])
export class DigitsValidation implements Validator {
    static create(rule: string): DigitsValidation | null {
        return rule === 'digits' ? new DigitsValidation() : null;
    }

    validate(value: string, context: ValidationContext) {
        if (/^\d+$/.test(value)){
            return;
        }

        context.addError(this.getMessage());
    }

    getMessage(): string {
        return t('r-validation:digits');
    }
}
