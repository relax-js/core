import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    RegisterValidator,
    RequiredValidation,
    RangeValidation,
    DigitsValidation,
    ValidationContext,
    getValidator,
} from '../../src/forms/ValidationRules';

vi.mock('../../src/i18n/i18n', () => ({
    t: (key: string, params?: Record<string, unknown>) => {
        if (key === 'r-validation:required') {
            return 'This field is required';
        }
        if (key === 'r-validation:range') {
            return `Value must be between ${params?.min} and ${params?.max}`;
        }
        if (key === 'r-validation:digits') {
            return 'Only digits are allowed';
        }
        return key;
    },
}));

function createValidationContext(): ValidationContext & { errors: string[] } {
    const errors: string[] = [];
    return {
        inputType: 'text',
        dataType: undefined,
        errors,
        addError(message: string) {
            errors.push(message);
        },
    };
}

describe('ValidationRules', () => {
    describe('RequiredValidation', () => {
        let validator: RequiredValidation;

        beforeEach(() => {
            validator = new RequiredValidation();
        });

        it('should pass when value is not empty', () => {
            const context = createValidationContext();

            validator.validate('hello', context);

            expect(context.errors).toHaveLength(0);
        });

        it('should fail when value is empty string', () => {
            const context = createValidationContext();

            validator.validate('', context);

            expect(context.errors).toHaveLength(1);
            expect(context.errors[0]).toBe('This field is required');
        });

        it('should fail when value is only whitespace', () => {
            const context = createValidationContext();

            validator.validate('   ', context);

            expect(context.errors).toHaveLength(1);
        });

        it('should pass when value has leading/trailing whitespace but content', () => {
            const context = createValidationContext();

            validator.validate('  hello  ', context);

            expect(context.errors).toHaveLength(0);
        });

        describe('create static method', () => {
            it('should return instance for "required" rule', () => {
                const instance = RequiredValidation.create('required');

                expect(instance).toBeInstanceOf(RequiredValidation);
            });

            it('should return null for other rules', () => {
                const instance = RequiredValidation.create('email');

                expect(instance).toBeNull();
            });
        });

        describe('getMessage', () => {
            it('should return localized message', () => {
                const message = validator.getMessage();

                expect(message).toBe('This field is required');
            });
        });
    });

    describe('RangeValidation', () => {
        let validator: RangeValidation;

        beforeEach(() => {
            validator = new RangeValidation(0, 100);
        });

        it('should pass when value is within range', () => {
            const context = createValidationContext();

            validator.validate('50', context);

            expect(context.errors).toHaveLength(0);
        });

        it('should pass when value equals minimum', () => {
            const context = createValidationContext();

            validator.validate('0', context);

            expect(context.errors).toHaveLength(0);
        });

        it('should pass when value equals maximum', () => {
            const context = createValidationContext();

            validator.validate('100', context);

            expect(context.errors).toHaveLength(0);
        });

        it('should fail when value is below minimum', () => {
            const context = createValidationContext();

            validator.validate('-1', context);

            expect(context.errors).toHaveLength(1);
            expect(context.errors[0]).toContain('between 0 and 100');
        });

        it('should fail when value is above maximum', () => {
            const context = createValidationContext();

            validator.validate('101', context);

            expect(context.errors).toHaveLength(1);
        });

        it('should fail when value is not a number', () => {
            const context = createValidationContext();

            validator.validate('abc', context);

            expect(context.errors).toHaveLength(1);
        });

        it('should handle decimal values', () => {
            const context = createValidationContext();

            validator.validate('50.5', context);

            expect(context.errors).toHaveLength(0);
        });

        it('should handle negative ranges', () => {
            const negativeValidator = new RangeValidation(-100, -10);
            const context = createValidationContext();

            negativeValidator.validate('-50', context);

            expect(context.errors).toHaveLength(0);
        });

        it('should pass when value is empty (non-required field)', () => {
            const context = createValidationContext();

            validator.validate('', context);

            expect(context.errors).toHaveLength(0);
        });

        describe('create static method', () => {
            it('should parse range rule correctly', () => {
                const instance = RangeValidation.create('range(0-120)');

                expect(instance).toBeInstanceOf(RangeValidation);
                expect(instance?.min).toBe(0);
                expect(instance?.max).toBe(120);
            });

            it('should parse range with negative min', () => {
                const instance = RangeValidation.create('range(-10-10)');

                expect(instance).toBeInstanceOf(RangeValidation);
                expect(instance?.min).toBe(-10);
                expect(instance?.max).toBe(10);
            });

            it('should parse range with float values', () => {
                const instance = RangeValidation.create('range(0.5-1.5)');

                expect(instance).toBeInstanceOf(RangeValidation);
                expect(instance?.min).toBe(0.5);
                expect(instance?.max).toBe(1.5);
            });

            it('should parse range with negative float values', () => {
                const instance = RangeValidation.create('range(-1.5-1.5)');

                expect(instance).toBeInstanceOf(RangeValidation);
                expect(instance?.min).toBe(-1.5);
                expect(instance?.max).toBe(1.5);
            });

            it('should return null for invalid range format', () => {
                const instance = RangeValidation.create('range(invalid)');

                expect(instance).toBeNull();
            });

            it('should return null for non-range rules', () => {
                const instance = RangeValidation.create('required');

                expect(instance).toBeNull();
            });

            it('should return null for malformed range', () => {
                const instance = RangeValidation.create('range(0120)');

                expect(instance).toBeNull();
            });
        });

        describe('getMessage', () => {
            it('should return message with min, max, and actual value', () => {
                const message = validator.getMessage('150');

                expect(message).toContain('0');
                expect(message).toContain('100');
            });
        });
    });

    describe('DigitsValidation', () => {
        let validator: DigitsValidation;

        beforeEach(() => {
            validator = new DigitsValidation();
        });

        it('should pass when value contains only digits', () => {
            const context = createValidationContext();

            validator.validate('12345', context);

            expect(context.errors).toHaveLength(0);
        });

        it('should pass for single digit', () => {
            const context = createValidationContext();

            validator.validate('0', context);

            expect(context.errors).toHaveLength(0);
        });

        it('should fail when value contains letters', () => {
            const context = createValidationContext();

            validator.validate('123abc', context);

            expect(context.errors).toHaveLength(1);
            expect(context.errors[0]).toBe('Only digits are allowed');
        });

        it('should fail when value contains special characters', () => {
            const context = createValidationContext();

            validator.validate('123-456', context);

            expect(context.errors).toHaveLength(1);
        });

        it('should fail when value contains spaces', () => {
            const context = createValidationContext();

            validator.validate('123 456', context);

            expect(context.errors).toHaveLength(1);
        });

        it('should fail when value contains decimal point', () => {
            const context = createValidationContext();

            validator.validate('123.45', context);

            expect(context.errors).toHaveLength(1);
        });

        it('should fail for empty string', () => {
            const context = createValidationContext();

            validator.validate('', context);

            expect(context.errors).toHaveLength(1);
        });

        describe('create static method', () => {
            it('should return instance for "digits" rule', () => {
                const instance = DigitsValidation.create('digits');

                expect(instance).toBeInstanceOf(DigitsValidation);
            });

            it('should return null for other rules', () => {
                const instance = DigitsValidation.create('required');

                expect(instance).toBeNull();
            });
        });

        describe('getMessage', () => {
            it('should return localized message', () => {
                const message = validator.getMessage();

                expect(message).toBe('Only digits are allowed');
            });
        });
    });

    describe('RegisterValidator decorator', () => {
        it('should register validator class', () => {
            @RegisterValidator('test-validator')
            class TestValidation {
                validate(_value: string, _context: ValidationContext) {}
            }

            expect(TestValidation).toBeDefined();
        });

        it('should register validator with input type restrictions', () => {
            @RegisterValidator('number-only', ['number'])
            class NumberOnlyValidation {
                validate(_value: string, _context: ValidationContext) {}
            }

            expect(NumberOnlyValidation).toBeDefined();
        });
    });

    describe('getValidator', () => {
        it('should find "required" validator', () => {
            expect(getValidator('required')).toBeDefined();
        });

        it('should find "digits" validator', () => {
            expect(getValidator('digits')).toBeDefined();
        });

        it('should find "range" validator', () => {
            expect(getValidator('range')).toBeDefined();
        });

        it('should return undefined for unknown validator', () => {
            expect(getValidator('nonexistent')).toBeUndefined();
        });
    });

    describe('ValidationContext', () => {
        it('should accumulate multiple errors', () => {
            const context = createValidationContext();

            context.addError('Error 1');
            context.addError('Error 2');
            context.addError('Error 3');

            expect(context.errors).toHaveLength(3);
            expect(context.errors).toEqual(['Error 1', 'Error 2', 'Error 3']);
        });

        it('should store input type', () => {
            const context = createValidationContext();
            context.inputType = 'number';

            expect(context.inputType).toBe('number');
        });

        it('should store data type', () => {
            const context = createValidationContext();
            context.dataType = 'integer';

            expect(context.dataType).toBe('integer');
        });
    });
});
