import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    defaultFormatICU,
    setMessageFormatter,
    formatICU,
    MessageFormatter,
} from '../../src/i18n/icu';

describe('ICU Message Format', () => {
    let originalFormatter: MessageFormatter;

    beforeEach(() => {
        originalFormatter = formatICU;
    });

    afterEach(() => {
        setMessageFormatter(originalFormatter);
    });

    describe('defaultFormatICU', () => {
        describe('simple interpolation', () => {
            it('should replace single placeholder', () => {
                const result = defaultFormatICU('Hello, {name}!', { name: 'World' });

                expect(result).toBe('Hello, World!');
            });

            it('should replace multiple placeholders', () => {
                const result = defaultFormatICU('{greeting}, {name}!', {
                    greeting: 'Hello',
                    name: 'John',
                });

                expect(result).toBe('Hello, John!');
            });

            it('should handle numeric values', () => {
                const result = defaultFormatICU('You have {count} messages', { count: 42 });

                expect(result).toBe('You have 42 messages');
            });

            it('should keep placeholder if value is missing', () => {
                const result = defaultFormatICU('Hello, {name}!', {});

                expect(result).toBe('Hello, {name}!');
            });

            it('should handle undefined values', () => {
                const result = defaultFormatICU('Value: {value}', { value: undefined });

                expect(result).toBe('Value: {value}');
            });

            it('should convert values to strings', () => {
                const result = defaultFormatICU('Boolean: {flag}, Number: {num}', {
                    flag: true,
                    num: 3.14,
                });

                expect(result).toBe('Boolean: true, Number: 3.14');
            });

            it('should handle empty string value', () => {
                const result = defaultFormatICU('Name: {name}', { name: '' });

                expect(result).toBe('Name: ');
            });

            it('should handle zero value', () => {
                const result = defaultFormatICU('Count: {count}', { count: 0 });

                expect(result).toBe('Count: 0');
            });
        });

        describe('pluralization', () => {
            it('should use "one" category for count of 1', () => {
                const result = defaultFormatICU(
                    '{count, plural, one {# item} other {# items}}',
                    { count: 1 },
                    'en'
                );

                expect(result).toBe('1 item');
            });

            it('should use "other" category for count greater than 1', () => {
                const result = defaultFormatICU(
                    '{count, plural, one {# item} other {# items}}',
                    { count: 5 },
                    'en'
                );

                expect(result).toBe('5 items');
            });

            it('should use "other" category for count of 0', () => {
                const result = defaultFormatICU(
                    '{count, plural, one {# item} other {# items}}',
                    { count: 0 },
                    'en'
                );

                expect(result).toBe('0 items');
            });

            it('should replace # with the count value', () => {
                const result = defaultFormatICU(
                    '{n, plural, one {You have # message} other {You have # messages}}',
                    { n: 3 },
                    'en'
                );

                expect(result).toBe('You have 3 messages');
            });

            it('should replace # in plural content with count value', () => {
                const result = defaultFormatICU(
                    '{count, plural, one {# item in cart} other {# items in cart}}',
                    { count: 7 },
                    'en'
                );

                expect(result).toBe('7 items in cart');
            });

            it('should fall back to "other" category when specific category not found', () => {
                const result = defaultFormatICU(
                    '{count, plural, other {# things}}',
                    { count: 1 },
                    'en'
                );

                expect(result).toBe('1 things');
            });

            it('should handle different locales with different plural rules', () => {
                const enResult = defaultFormatICU(
                    '{count, plural, one {# sak} other {# saker}}',
                    { count: 1 },
                    'en'
                );

                expect(enResult).toBe('1 sak');

                const svResult = defaultFormatICU(
                    '{count, plural, one {# sak} other {# saker}}',
                    { count: 2 },
                    'sv'
                );

                expect(svResult).toBe('2 saker');
            });

            it('should handle days ago plural', () => {
                const result = defaultFormatICU(
                    '{count, plural, one {# day ago} other {# days ago}}',
                    { count: 3 },
                    'en'
                );

                expect(result).toBe('3 days ago');
            });

            it('should handle singular day ago', () => {
                const result = defaultFormatICU(
                    '{count, plural, one {# day ago} other {# days ago}}',
                    { count: 1 },
                    'en'
                );

                expect(result).toBe('1 day ago');
            });
        });

        describe('mixed content', () => {
            it('should handle text with plural and simple interpolation', () => {
                const result = defaultFormatICU(
                    'Hello {name}, you have {count, plural, one {# new message} other {# new messages}}',
                    { name: 'John', count: 5 },
                    'en'
                );

                expect(result).toBe('Hello John, you have 5 new messages');
            });

            it('should handle message without any placeholders', () => {
                const result = defaultFormatICU('Simple text', {});

                expect(result).toBe('Simple text');
            });
        });

        describe('edge cases', () => {
            it('should handle empty message', () => {
                const result = defaultFormatICU('', {});

                expect(result).toBe('');
            });

            it('should handle empty values object', () => {
                const result = defaultFormatICU('No placeholders here', {});

                expect(result).toBe('No placeholders here');
            });

            it('should default to "en" locale when not specified', () => {
                const result = defaultFormatICU(
                    '{count, plural, one {# item} other {# items}}',
                    { count: 1 }
                );

                expect(result).toBe('1 item');
            });

            it('should handle large numbers', () => {
                const result = defaultFormatICU(
                    '{count, plural, one {# item} other {# items}}',
                    { count: 1000000 },
                    'en'
                );

                expect(result).toBe('1000000 items');
            });

            it('should handle negative numbers', () => {
                const result = defaultFormatICU('Value: {num}', { num: -5 });

                expect(result).toBe('Value: -5');
            });

            it('should handle decimal numbers', () => {
                const result = defaultFormatICU('Price: {price}', { price: 19.99 });

                expect(result).toBe('Price: 19.99');
            });
        });
    });

    describe('setMessageFormatter', () => {
        it('should replace the default formatter', () => {
            const customFormatter: MessageFormatter = (message, values) => {
                return `CUSTOM: ${message}`;
            };

            setMessageFormatter(customFormatter);

            const result = formatICU('Test message', {});

            expect(result).toBe('CUSTOM: Test message');
        });

        it('should receive all parameters', () => {
            let receivedMessage: string = '';
            let receivedValues: Record<string, any> = {};
            let receivedLocale: string = '';

            const customFormatter: MessageFormatter = (message, values, locale) => {
                receivedMessage = message;
                receivedValues = values ?? {};
                receivedLocale = locale ?? '';
                return 'formatted';
            };

            setMessageFormatter(customFormatter);
            formatICU('Hello {name}', { name: 'Test' }, 'sv');

            expect(receivedMessage).toBe('Hello {name}');
            expect(receivedValues).toEqual({ name: 'Test' });
            expect(receivedLocale).toBe('sv');
        });

        it('should allow reverting to default formatter', () => {
            const customFormatter: MessageFormatter = () => 'CUSTOM';

            setMessageFormatter(customFormatter);
            expect(formatICU('Test', {})).toBe('CUSTOM');

            setMessageFormatter(defaultFormatICU);
            expect(formatICU('Hello, {name}!', { name: 'World' })).toBe('Hello, World!');
        });
    });

    describe('formatICU export', () => {
        it('should initially be the default formatter', () => {
            const result = formatICU('Hello, {name}!', { name: 'World' });

            expect(result).toBe('Hello, World!');
        });
    });
});
