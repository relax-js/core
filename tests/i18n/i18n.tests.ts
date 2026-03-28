import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    setLocale,
    loadNamespace,
    loadNamespaces,
    t,
    getCurrentLocale,
    onMissingTranslation,
    LocaleChangeEvent,
} from '../../src/i18n/i18n';
import {
    defaultFormatICU,
    setMessageFormatter,
} from '../../src/i18n/icu';

describe('i18n', () => {
    beforeEach(async () => {
        await setLocale('en');
    });

    describe('setLocale', () => {
        it('should set the locale and load common namespace', async () => {
            await setLocale('en');

            expect(getCurrentLocale()).toBe('en');
        });

        it('should normalize locale codes with region', async () => {
            await setLocale('en-US');

            expect(getCurrentLocale()).toBe('en');
        });

        it('should normalize uppercase locale codes', async () => {
            await setLocale('EN');

            expect(getCurrentLocale()).toBe('en');
        });

        it('should normalize mixed case locale codes', async () => {
            await setLocale('En-Us');

            expect(getCurrentLocale()).toBe('en');
        });

        it('should switch between locales', async () => {
            await setLocale('en');
            expect(getCurrentLocale()).toBe('en');

            await setLocale('sv');
            expect(getCurrentLocale()).toBe('sv');
        });

        it('should clear translations when switching locales', async () => {
            await setLocale('en');
            const enGreeting = t('greeting', { name: 'Test' });

            await setLocale('sv');
            const svGreeting = t('greeting', { name: 'Test' });

            expect(enGreeting).toBe('Hello, Test!');
            expect(svGreeting).toBe('Hej, Test!');
        });
    });

    describe('loadNamespace', () => {
        it('should load additional namespaces', async () => {
            await loadNamespace('r-pipes');

            const today = t('r-pipes:today');

            expect(today).toBe('today');
        });

        it('should not reload already loaded namespaces', async () => {
            await loadNamespace('r-pipes');
            await loadNamespace('r-pipes');

            const today = t('r-pipes:today');
            expect(today).toBe('today');
        });

        it('should fall back to default locale for missing namespace', async () => {
            await setLocale('sv');
            await loadNamespace('r-validation');

            const required = t('r-validation:required');

            expect(required).not.toBe('r-validation:required');
        });

        it('should handle namespace loading for Swedish locale', async () => {
            await setLocale('sv');
            await loadNamespace('r-pipes');

            const today = t('r-pipes:today');

            expect(today).toBe('idag');
        });
    });

    describe('t (translate)', () => {
        describe('basic translation', () => {
            it('should translate key without namespace (defaults to common)', async () => {
                const result = t('greeting', { name: 'World' });

                expect(result).toBe('Hello, World!');
            });

            it('should translate key with explicit namespace', async () => {
                await loadNamespace('r-pipes');

                const result = t('r-pipes:today');

                expect(result).toBe('today');
            });

            it('should return the key if translation not found', () => {
                const result = t('nonexistent:key');

                expect(result).toBe('nonexistent:key');
            });

            it('should return simple key if not found in common', () => {
                const result = t('missingKey');

                expect(result).toBe('missingKey');
            });
        });

        describe('interpolation', () => {
            it('should interpolate simple values', async () => {
                const result = t('greeting', { name: 'Alice' });

                expect(result).toBe('Hello, Alice!');
            });

            it('should handle missing interpolation values gracefully', async () => {
                const result = t('greeting', {});

                expect(result).toBe('Hello, {name}!');
            });
        });

        describe('pluralization', () => {
            it('should handle singular count', async () => {
                const result = t('items', { count: 1 });

                expect(result).toBe('1 item');
            });

            it('should handle plural count', async () => {
                const result = t('items', { count: 5 });

                expect(result).toBe('5 items');
            });

            it('should handle zero count', async () => {
                const result = t('items', { count: 0 });

                expect(result).toBe('0 items');
            });
        });

        describe('pipes namespace', () => {
            beforeEach(async () => {
                await loadNamespace('r-pipes');
            });

            it('should translate today', () => {
                const result = t('r-pipes:today');

                expect(result).toBe('today');
            });

            it('should translate yesterday', () => {
                const result = t('r-pipes:yesterday');

                expect(result).toBe('yesterday');
            });

            it('should handle daysAgo singular', () => {
                const result = t('r-pipes:daysAgo', { count: 1 });

                expect(result).toBe('1 day ago');
            });

            it('should handle daysAgo plural', () => {
                const result = t('r-pipes:daysAgo', { count: 3 });

                expect(result).toBe('3 days ago');
            });

            it('should handle pieces with zero (exact =0 match)', () => {
                const result = t('r-pipes:pieces', { count: 0 });

                expect(result).toBe('none');
            });

            it('should handle pieces singular', () => {
                const result = t('r-pipes:pieces', { count: 1 });

                expect(result).toBe('one');
            });

            it('should handle pieces plural', () => {
                const result = t('r-pipes:pieces', { count: 5 });

                expect(result).toBe('5 pcs');
            });
        });

        describe('Swedish locale', () => {
            beforeEach(async () => {
                await setLocale('sv');
            });

            it('should translate greeting in Swedish', async () => {
                const result = t('greeting', { name: 'Erik' });

                expect(result).toBe('Hej, Erik!');
            });

            it('should translate items singular in Swedish', async () => {
                const result = t('items', { count: 1 });

                expect(result).toBe('1 sak');
            });

            it('should translate items plural in Swedish', async () => {
                const result = t('items', { count: 5 });

                expect(result).toBe('5 saker');
            });

            it('should translate pipes namespace in Swedish', async () => {
                await loadNamespace('r-pipes');

                expect(t('r-pipes:today')).toBe('idag');
                expect(t('r-pipes:yesterday')).toBe('igår');
            });
        });
    });

    describe('getCurrentLocale', () => {
        it('should return the current locale', async () => {
            await setLocale('en');

            expect(getCurrentLocale()).toBe('en');
        });

        it('should return normalized locale', async () => {
            await setLocale('en-GB');

            expect(getCurrentLocale()).toBe('en');
        });
    });

    describe('namespace isolation', () => {
        it('should not mix translations between namespaces', async () => {
            await loadNamespace('r-pipes');

            expect(t('greeting', { name: 'Test' })).toBe('Hello, Test!');
            expect(t('r-pipes:today')).toBe('today');
        });

        it('should handle multiple namespaces loaded', async () => {
            await loadNamespace('r-pipes');
            await loadNamespace('r-validation');

            expect(t('greeting', { name: 'Test' })).toBe('Hello, Test!');
            expect(t('r-pipes:today')).toBe('today');
            expect(t('r-validation:required')).not.toBe('r-validation:required');
        });
    });

    describe('error handling', () => {
        it('should return key for missing namespace', () => {
            const result = t('nonexistent:key');

            expect(result).toBe('nonexistent:key');
        });

        it('should return key for missing key in loaded namespace', async () => {
            await loadNamespace('r-pipes');

            const result = t('r-pipes:nonexistent');

            expect(result).toBe('r-pipes:nonexistent');
        });

        it('should handle invalid interpolation gracefully', async () => {
            const result = t('greeting', { name: null });

            expect(result).toBe('Hello, null!');
        });
    });

    describe('loadNamespaces', () => {
        it('should load multiple namespaces in parallel', async () => {
            await loadNamespaces(['r-pipes', 'r-validation']);

            expect(t('r-pipes:today')).toBe('today');
            expect(t('r-validation:required')).not.toBe('r-validation:required');
        });

        it('should handle empty array', async () => {
            await loadNamespaces([]);
        });

        it('should skip already-loaded namespaces', async () => {
            await loadNamespace('r-pipes');
            await loadNamespaces(['r-pipes', 'r-validation']);

            expect(t('r-pipes:today')).toBe('today');
            expect(t('r-validation:required')).not.toBe('r-validation:required');
        });
    });

    describe('LocaleChangeEvent', () => {
        it('should dispatch localechange on document after setLocale', async () => {
            const handler = vi.fn();
            document.addEventListener('localechange', handler);

            await setLocale('sv');

            expect(handler).toHaveBeenCalledOnce();
            const event = handler.mock.calls[0][0] as LocaleChangeEvent;
            expect(event.locale).toBe('sv');
            expect(event.type).toBe('localechange');

            document.removeEventListener('localechange', handler);
        });

        it('should dispatch with normalized locale', async () => {
            const handler = vi.fn();
            document.addEventListener('localechange', handler);

            await setLocale('en-US');

            const event = handler.mock.calls[0][0] as LocaleChangeEvent;
            expect(event.locale).toBe('en');

            document.removeEventListener('localechange', handler);
        });

        it('should dispatch after translations are loaded', async () => {
            let translationInHandler = '';
            const handler = (e: LocaleChangeEvent) => {
                translationInHandler = t('greeting', { name: 'Test' });
            };
            document.addEventListener('localechange', handler);

            await setLocale('sv');

            expect(translationInHandler).toBe('Hej, Test!');

            document.removeEventListener('localechange', handler);
        });
    });

    describe('onMissingTranslation', () => {
        beforeEach(() => {
            onMissingTranslation(null);
        });

        it('should call handler when key is missing', () => {
            const handler = vi.fn();
            onMissingTranslation(handler);

            t('nonexistent:key');

            expect(handler).toHaveBeenCalledWith('key', 'nonexistent', 'en');
        });

        it('should call handler for missing common key', () => {
            const handler = vi.fn();
            onMissingTranslation(handler);

            t('missingKey');

            expect(handler).toHaveBeenCalledWith('missingKey', 'r-common', 'en');
        });

        it('should not call handler when key exists', () => {
            const handler = vi.fn();
            onMissingTranslation(handler);

            t('greeting', { name: 'Test' });

            expect(handler).not.toHaveBeenCalled();
        });

        it('should remove handler when passed null', () => {
            const handler = vi.fn();
            onMissingTranslation(handler);
            onMissingTranslation(null);

            t('missingKey');

            expect(handler).not.toHaveBeenCalled();
        });
    });

    describe('ICU select', () => {
        it('should select matching branch', () => {
            const result = defaultFormatICU(
                '{role, select, admin {Full access} editor {Can edit} other {Read only}}',
                { role: 'admin' },
            );

            expect(result).toBe('Full access');
        });

        it('should fall back to other when no match', () => {
            const result = defaultFormatICU(
                '{role, select, admin {Full access} other {Read only}}',
                { role: 'viewer' },
            );

            expect(result).toBe('Read only');
        });

        it('should handle select with surrounding text', () => {
            const result = defaultFormatICU(
                '{gender, select, male {He} female {She} other {They}} went home.',
                { gender: 'female' },
            );

            expect(result).toBe('She went home.');
        });

        it('should handle select combined with interpolation', () => {
            const result = defaultFormatICU(
                '{name} has {role, select, admin {full} other {limited}} access.',
                { name: 'Alice', role: 'admin' },
            );

            expect(result).toBe('Alice has full access.');
        });
    });

    describe('ICU plural exact match (=N)', () => {
        it('should match =0 over plural category', () => {
            const result = defaultFormatICU(
                '{count, plural, =0 {none} one {# item} other {# items}}',
                { count: 0 },
            );

            expect(result).toBe('none');
        });

        it('should match =1 over plural category', () => {
            const result = defaultFormatICU(
                '{count, plural, =1 {exactly one} one {# thing} other {# things}}',
                { count: 1 },
            );

            expect(result).toBe('exactly one');
        });

        it('should match =2 for specific value', () => {
            const result = defaultFormatICU(
                '{count, plural, =0 {none} =2 {a pair} one {#} other {#}}',
                { count: 2 },
            );

            expect(result).toBe('a pair');
        });

        it('should use # in exact match', () => {
            const result = defaultFormatICU(
                '{count, plural, =0 {# items (empty)} other {# items}}',
                { count: 0 },
            );

            expect(result).toBe('0 items (empty)');
        });

        it('should fall through to category when no exact match', () => {
            const result = defaultFormatICU(
                '{count, plural, =0 {none} one {# item} other {# items}}',
                { count: 1 },
            );

            expect(result).toBe('1 item');
        });
    });
});
