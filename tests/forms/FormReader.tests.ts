import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    readData,
    mapFormToClass,
    getDataConverter,
    BooleanConverter,
    NumberConverter,
    DateConverter,
    createConverterFromDataType,
    createConverterFromInputType,
} from '../../src/forms/FormReader';

describe('FormReader', () => {
    let form: HTMLFormElement;

    beforeEach(() => {
        document.body.innerHTML = '';
        form = document.createElement('form');
        document.body.appendChild(form);
    });

    describe('BooleanConverter', () => {
        it('should return true for "true" string', () => {
            expect(BooleanConverter('true')).toBe(true);
        });

        it('should return true for "TRUE" string (case insensitive)', () => {
            expect(BooleanConverter('TRUE')).toBe(true);
        });

        it('should return false for "false" string', () => {
            expect(BooleanConverter('false')).toBe(false);
        });

        it('should return false for "FALSE" string (case insensitive)', () => {
            expect(BooleanConverter('FALSE')).toBe(false);
        });

        it('should return true for positive number strings', () => {
            expect(BooleanConverter('1')).toBe(true);
            expect(BooleanConverter('42')).toBe(true);
        });

        it('should return false for "0" string', () => {
            expect(BooleanConverter('0')).toBe(false);
        });

        it('should return false for negative number strings', () => {
            expect(BooleanConverter('-1')).toBe(false);
        });

        it('should return undefined for empty string', () => {
            expect(BooleanConverter('')).toBeUndefined();
        });

        it('should return undefined for undefined', () => {
            expect(BooleanConverter(undefined)).toBeUndefined();
        });

        it('should throw for non-boolean strings', () => {
            expect(() => BooleanConverter('maybe')).toThrow();
        });

        it('should return true for "on" (default checkbox value)', () => {
            expect(BooleanConverter('on')).toBe(true);
        });

        it('should return false for "off"', () => {
            expect(BooleanConverter('off')).toBe(false);
        });
    });

    describe('NumberConverter', () => {
        it('should convert integer strings', () => {
            expect(NumberConverter('42')).toBe(42);
        });

        it('should convert decimal strings', () => {
            expect(NumberConverter('3.14')).toBe(3.14);
        });

        it('should convert negative numbers', () => {
            expect(NumberConverter('-10')).toBe(-10);
        });

        it('should return undefined for empty string', () => {
            expect(NumberConverter('')).toBeUndefined();
        });

        it('should return undefined for undefined', () => {
            expect(NumberConverter(undefined)).toBeUndefined();
        });

        it('should throw for non-numeric strings', () => {
            expect(() => NumberConverter('abc')).toThrow();
        });

        it('should convert zero', () => {
            expect(NumberConverter('0')).toBe(0);
        });
    });

    describe('DateConverter', () => {
        it('should convert ISO date string', () => {
            const result = DateConverter('2024-01-15');
            expect(result).toBeInstanceOf(Date);
            expect(result.getFullYear()).toBe(2024);
            expect(result.getMonth()).toBe(0);
            expect(result.getDate()).toBe(15);
        });

        it('should convert datetime string', () => {
            const result = DateConverter('2024-01-15T10:30:00');
            expect(result).toBeInstanceOf(Date);
        });

        it('should throw for invalid date string', () => {
            expect(() => DateConverter('not-a-date')).toThrow('Invalid date format');
        });

        it('should parse US locale format (MM/DD/YYYY)', async () => {
            const { setLocale } = await import('../../src/i18n/i18n');
            await setLocale('en-US');

            const result = DateConverter('01/15/2024');

            expect(result.getFullYear()).toBe(2024);
            expect(result.getMonth()).toBe(0);
            expect(result.getDate()).toBe(15);
        });

        it('should parse Swedish locale format (YYYY-MM-DD)', async () => {
            const { setLocale } = await import('../../src/i18n/i18n');
            await setLocale('sv');

            const result = DateConverter('2024-01-15');

            expect(result.getFullYear()).toBe(2024);
            expect(result.getMonth()).toBe(0);
            expect(result.getDate()).toBe(15);
        });

        it('should parse German locale format (DD.MM.YYYY)', async () => {
            const { setLocale } = await import('../../src/i18n/i18n');
            await setLocale('de');

            const result = DateConverter('15.01.2024');

            expect(result.getFullYear()).toBe(2024);
            expect(result.getMonth()).toBe(0);
            expect(result.getDate()).toBe(15);
        });

        it('should handle 2-digit years', async () => {
            const { setLocale } = await import('../../src/i18n/i18n');
            await setLocale('en-US');

            const result = DateConverter('01/15/24');

            expect(result.getFullYear()).toBe(2024);
            expect(result.getMonth()).toBe(0);
            expect(result.getDate()).toBe(15);
        });
    });

    describe('createConverterFromDataType', () => {
        it('should return BooleanConverter for "boolean" type', () => {
            const converter = createConverterFromDataType('boolean');
            expect(converter('true')).toBe(true);
        });

        it('should return NumberConverter for "number" type', () => {
            const converter = createConverterFromDataType('number');
            expect(converter('42')).toBe(42);
        });

        it('should return DateConverter for "Date" type', () => {
            const converter = createConverterFromDataType('Date');
            const result = converter('2024-01-15');
            expect(result).toBeInstanceOf(Date);
        });

        it('should return string converter for "string" type', () => {
            const converter = createConverterFromDataType('string');
            expect(converter('hello')).toBe('hello');
        });

        it('should return undefined for empty string with "string" type', () => {
            const converter = createConverterFromDataType('string');
            expect(converter('')).toBeUndefined();
        });

        it('should throw for unknown data-type', () => {
            expect(() => createConverterFromDataType('integer' as any)).toThrow();
        });
    });

    describe('createConverterFromInputType', () => {
        it('should return BooleanConverter for checkbox', () => {
            const converter = createConverterFromInputType('checkbox');
            expect(converter('true')).toBe(true);
        });

        it('should return NumberConverter for number', () => {
            const converter = createConverterFromInputType('number');
            expect(converter('42')).toBe(42);
        });

        it('should return Date for date input', () => {
            const converter = createConverterFromInputType('date');
            const result = converter('2024-01-15');
            expect(result).toBeInstanceOf(Date);
        });

        it('should throw for invalid date input', () => {
            const converter = createConverterFromInputType('date');
            expect(() => converter('not-a-date')).toThrow('Invalid date format');
        });

        it('should return Date for datetime-local input', () => {
            const converter = createConverterFromInputType('datetime-local');
            const result = converter('2024-01-15T10:30');
            expect(result).toBeInstanceOf(Date);
        });

        it('should throw for invalid datetime-local input', () => {
            const converter = createConverterFromInputType('datetime-local');
            expect(() => converter('not-a-date')).toThrow('Invalid date format');
        });

        it('should return year/month object for month input', () => {
            const converter = createConverterFromInputType('month');
            const result = converter('2024-03') as Date;
            expect(result).toBeInstanceOf(Date);
            expect(result.getFullYear()).toBe(2024);
            expect(result.getMonth()).toBe(2);
        });

        it('should return year/week object for week input', () => {
            const converter = createConverterFromInputType('week');
            const result = converter('2024-W05') as { year: number; week: number };
            expect(result.year).toBe(2024);
            expect(result.week).toBe(5);
        });

        it('should return hours/minutes/seconds object for time input', () => {
            const converter = createConverterFromInputType('time');
            const result = converter('10:30:45') as { hours: number; minutes: number; seconds: number };
            expect(result.hours).toBe(10);
            expect(result.minutes).toBe(30);
            expect(result.seconds).toBe(45);
        });

        it('should handle time without seconds', () => {
            const converter = createConverterFromInputType('time');
            const result = converter('10:30') as { hours: number; minutes: number; seconds: number };
            expect(result.hours).toBe(10);
            expect(result.minutes).toBe(30);
            expect(result.seconds).toBe(0);
        });

        it('should return string for text input', () => {
            const converter = createConverterFromInputType('text');
            expect(converter('hello')).toBe('hello');
        });

        it('should return undefined for empty text input', () => {
            const converter = createConverterFromInputType('text');
            expect(converter('')).toBeUndefined();
        });

        it('should return string for tel input', () => {
            const converter = createConverterFromInputType('tel');
            expect(converter('555-1234')).toBe('555-1234');
        });
    });

    describe('getDataConverter', () => {
        it('should use data-type attribute when present', () => {
            const input = document.createElement('input');
            input.setAttribute('data-type', 'number');

            const converter = getDataConverter(input);

            expect(converter('42')).toBe(42);
        });

        it('should infer from input type when no data-type', () => {
            const input = document.createElement('input');
            input.type = 'checkbox';

            const converter = getDataConverter(input);

            expect(converter('true')).toBe(true);
        });

        it('should return identity converter for select elements', () => {
            const select = document.createElement('select');

            const converter = getDataConverter(select);

            expect(converter('option1')).toBe('option1');
        });

        it('should return identity converter for textarea elements', () => {
            const textarea = document.createElement('textarea');

            const converter = getDataConverter(textarea);

            expect(converter('text content')).toBe('text content');
        });
    });

    describe('readData', () => {
        it('should read text input value', () => {
            const input = document.createElement('input');
            input.name = 'username';
            input.value = 'john';
            form.appendChild(input);

            const data = readData(form);

            expect(data.username).toBe('john');
        });

        it('should read number input as number', () => {
            const input = document.createElement('input');
            input.type = 'number';
            input.name = 'age';
            input.value = '25';
            form.appendChild(input);

            const data = readData(form);

            expect(data.age).toBe(25);
        });

        it('should read checkbox as boolean', () => {
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.name = 'active';
            input.value = 'true';
            input.checked = true;
            form.appendChild(input);

            const data = readData(form);

            expect(data.active).toBe(true);
        });

        it('should read unchecked checkbox as false', () => {
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.name = 'active';
            input.checked = false;
            form.appendChild(input);

            const data = readData(form);

            expect(data.active).toBe(false);
        });

        it('should read checkbox without explicit value attribute as boolean', () => {
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.name = 'active';
            input.checked = true;
            form.appendChild(input);

            const data = readData(form);

            expect(data.active).toBe(true);
        });

        it('should read select value', () => {
            const select = document.createElement('select');
            select.name = 'country';

            const option1 = document.createElement('option');
            option1.value = 'us';
            option1.text = 'United States';

            const option2 = document.createElement('option');
            option2.value = 'uk';
            option2.text = 'United Kingdom';
            option2.selected = true;

            select.appendChild(option1);
            select.appendChild(option2);
            form.appendChild(select);

            const data = readData(form);

            expect(data.country).toBe('uk');
        });

        it('should read multi-select as array', () => {
            const select = document.createElement('select');
            select.name = 'colors';
            select.multiple = true;

            const option1 = document.createElement('option');
            option1.value = 'red';
            option1.selected = true;

            const option2 = document.createElement('option');
            option2.value = 'blue';
            option2.selected = true;

            const option3 = document.createElement('option');
            option3.value = 'green';

            select.appendChild(option1);
            select.appendChild(option2);
            select.appendChild(option3);
            form.appendChild(select);

            const data = readData(form);

            expect(data.colors).toEqual(['red', 'blue']);
        });

        it('should read textarea value', () => {
            const textarea = document.createElement('textarea');
            textarea.name = 'description';
            textarea.value = 'Some long text';
            form.appendChild(textarea);

            const data = readData(form);

            expect(data.description).toBe('Some long text');
        });

        it('should use data-type for conversion', () => {
            const input = document.createElement('input');
            input.name = 'isAdmin';
            input.value = 'true';
            input.setAttribute('data-type', 'boolean');
            form.appendChild(input);

            const data = readData(form);

            expect(data.isAdmin).toBe(true);
        });

        it('should read date input as Date', () => {
            const input = document.createElement('input');
            input.type = 'date';
            input.name = 'birthDate';
            input.value = '2024-01-15';
            form.appendChild(input);

            const data = readData(form);

            expect(data.birthDate).toBeInstanceOf(Date);
        });

        it('should handle form with multiple fields', () => {
            const nameInput = document.createElement('input');
            nameInput.name = 'name';
            nameInput.value = 'John';
            form.appendChild(nameInput);

            const ageInput = document.createElement('input');
            ageInput.type = 'number';
            ageInput.name = 'age';
            ageInput.value = '30';
            form.appendChild(ageInput);

            const activeInput = document.createElement('input');
            activeInput.type = 'checkbox';
            activeInput.name = 'active';
            activeInput.value = 'true';
            activeInput.checked = true;
            form.appendChild(activeInput);

            const data = readData(form);

            expect(data.name).toBe('John');
            expect(data.age).toBe(30);
            expect(data.active).toBe(true);
        });
    });

    describe('mapFormToClass', () => {
        class UserDTO {
            name: string = '';
            age: number = 0;
            active: boolean = false;
        }

        it('should map form fields to class properties', () => {
            const nameInput = document.createElement('input');
            nameInput.name = 'name';
            nameInput.value = 'John';
            form.appendChild(nameInput);

            const ageInput = document.createElement('input');
            ageInput.type = 'number';
            ageInput.name = 'age';
            ageInput.value = '30';
            form.appendChild(ageInput);

            const activeInput = document.createElement('input');
            activeInput.type = 'checkbox';
            activeInput.name = 'active';
            activeInput.checked = true;
            form.appendChild(activeInput);

            const user = mapFormToClass(form, new UserDTO());

            expect(user.name).toBe('John');
            expect(user.age).toBe(30);
            expect(user.active).toBe(true);
        });

        it('should return the same instance', () => {
            const nameInput = document.createElement('input');
            nameInput.name = 'name';
            nameInput.value = 'Test';
            form.appendChild(nameInput);

            const instance = new UserDTO();
            const result = mapFormToClass(form, instance);

            expect(result).toBe(instance);
        });

        it('should skip fields without name attribute', () => {
            const input = document.createElement('input');
            input.value = 'ignored';
            form.appendChild(input);

            const user = mapFormToClass(form, new UserDTO());

            expect(user.name).toBe('');
        });

        it('should throw on missing property when option enabled', () => {
            const unknownInput = document.createElement('input');
            unknownInput.name = 'unknownField';
            unknownInput.value = 'value';
            form.appendChild(unknownInput);

            expect(() =>
                mapFormToClass(form, new UserDTO(), { throwOnMissingProperty: true })
            ).toThrow('Form field "unknownField" has no matching property in class instance');
        });

        it('should not throw on missing property by default', () => {
            const unknownInput = document.createElement('input');
            unknownInput.name = 'unknownField';
            unknownInput.value = 'value';
            form.appendChild(unknownInput);

            const user = mapFormToClass(form, new UserDTO());

            expect(user.name).toBe('');
        });

        it('should throw on missing field when option enabled', () => {
            const nameInput = document.createElement('input');
            nameInput.name = 'name';
            nameInput.value = 'John';
            form.appendChild(nameInput);

            expect(() =>
                mapFormToClass(form, new UserDTO(), { throwOnMissingField: true })
            ).toThrow('Class property "age" has no matching form field');
        });

        it('should handle select elements', () => {
            class SelectDTO {
                country: string = '';
            }

            const select = document.createElement('select');
            select.name = 'country';

            const option = document.createElement('option');
            option.value = 'us';
            option.selected = true;
            select.appendChild(option);
            form.appendChild(select);

            const dto = mapFormToClass(form, new SelectDTO());

            expect(dto.country).toBe('us');
        });

        it('should handle textarea elements', () => {
            class TextDTO {
                description: string = '';
            }

            const textarea = document.createElement('textarea');
            textarea.name = 'description';
            textarea.value = 'Hello World';
            form.appendChild(textarea);

            const dto = mapFormToClass(form, new TextDTO());

            expect(dto.description).toBe('Hello World');
        });

        it('should handle date inputs', () => {
            class DateDTO {
                birthDate: Date | null = null;
            }

            const input = document.createElement('input');
            input.type = 'date';
            input.name = 'birthDate';
            input.value = '2024-01-15';
            form.appendChild(input);

            const dto = mapFormToClass(form, new DateDTO());

            expect(dto.birthDate).toBeInstanceOf(Date);
            expect(dto.birthDate?.getFullYear()).toBe(2024);
        });

        it('should handle empty date inputs as null', () => {
            class DateDTO {
                birthDate: Date | null = null;
            }

            const input = document.createElement('input');
            input.type = 'date';
            input.name = 'birthDate';
            input.value = '';
            form.appendChild(input);

            const dto = mapFormToClass(form, new DateDTO());

            expect(dto.birthDate).toBeNull();
        });

        it('should handle empty number inputs as null', () => {
            class NumberDTO {
                count: number | null = 0;
            }

            const input = document.createElement('input');
            input.type = 'number';
            input.name = 'count';
            input.value = '';
            form.appendChild(input);

            const dto = mapFormToClass(form, new NumberDTO());

            expect(dto.count).toBeNull();
        });

        it('should handle unchecked checkbox', () => {
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.name = 'active';
            input.checked = false;
            form.appendChild(input);

            const user = mapFormToClass(form, new UserDTO());

            expect(user.active).toBe(false);
        });

        it('should read the checked radio button value, not the last one', () => {
            class GenderDTO {
                gender: string = '';
            }

            const radio1 = document.createElement('input');
            radio1.type = 'radio';
            radio1.name = 'gender';
            radio1.value = 'male';
            radio1.checked = true;
            form.appendChild(radio1);

            const radio2 = document.createElement('input');
            radio2.type = 'radio';
            radio2.name = 'gender';
            radio2.value = 'female';
            form.appendChild(radio2);

            const radio3 = document.createElement('input');
            radio3.type = 'radio';
            radio3.name = 'gender';
            radio3.value = 'other';
            form.appendChild(radio3);

            const dto = mapFormToClass(form, new GenderDTO());

            expect(dto.gender).toBe('male');
        });

        it('should read all selected values from select multiple', () => {
            class ColorsDTO {
                colors: string[] = [];
            }

            const select = document.createElement('select');
            select.name = 'colors';
            select.multiple = true;

            const opt1 = document.createElement('option');
            opt1.value = 'red';
            opt1.selected = true;
            select.appendChild(opt1);

            const opt2 = document.createElement('option');
            opt2.value = 'blue';
            opt2.selected = true;
            select.appendChild(opt2);

            const opt3 = document.createElement('option');
            opt3.value = 'green';
            select.appendChild(opt3);

            form.appendChild(select);

            const dto = mapFormToClass(form, new ColorsDTO());

            expect(dto.colors).toEqual(['red', 'blue']);
        });

        it('should skip disabled fields', () => {
            const nameInput = document.createElement('input');
            nameInput.name = 'name';
            nameInput.value = 'John';
            nameInput.disabled = true;
            form.appendChild(nameInput);

            const user = mapFormToClass(form, new UserDTO());

            expect(user.name).toBe('');
        });
    });
});
