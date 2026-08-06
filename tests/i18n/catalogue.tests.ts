import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setLocale, loadNamespace, t, onMissingTranslation } from '../../src/i18n/i18n';
import { registerNamespace, registerCatalogue } from '../../src/i18n/catalogue';

describe('catalogue', () => {
    beforeEach(async () => {
        onMissingTranslation(null);
        await setLocale('en');
    });

    describe('unregistered namespaces', () => {
        it('missing_namespace_does_not_break_bootstrap_on_fallback_locale', async () => {
            await setLocale('en');

            await expect(loadNamespace('unregistered-a')).resolves.toBeUndefined();
        });

        it('missing_namespace_does_not_break_bootstrap_on_translated_locale', async () => {
            await setLocale('sv');

            await expect(loadNamespace('unregistered-b')).resolves.toBeUndefined();
        });

        it('missing_namespace_warns_so_the_gap_is_visible', async () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            await setLocale('sv');

            await loadNamespace('unregistered-c');

            expect(warn).toHaveBeenCalled();
            warn.mockRestore();
        });
    });

    describe('registerNamespace', () => {
        it('app_owned_namespace_is_translatable_after_registration', async () => {
            registerNamespace('en', 'shell-a', { title: 'Dashboard' });

            await loadNamespace('shell-a');

            expect(t('shell-a:title')).toBe('Dashboard');
        });

        it('loader_is_not_called_until_the_namespace_is_loaded', async () => {
            const load = vi.fn().mockResolvedValue({ title: 'Dashboard' });
            registerNamespace('en', 'shell-b', load);

            expect(load).not.toHaveBeenCalled();

            await loadNamespace('shell-b');

            expect(load).toHaveBeenCalledTimes(1);
            expect(t('shell-b:title')).toBe('Dashboard');
        });

        it('json_module_default_export_is_unwrapped', async () => {
            registerNamespace('en', 'shell-c', { default: { title: 'Dashboard' } });

            await loadNamespace('shell-c');

            expect(t('shell-c:title')).toBe('Dashboard');
        });

        it('locale_is_normalized_so_region_codes_match', async () => {
            registerNamespace('en-US', 'shell-d', { title: 'Dashboard' });

            await loadNamespace('shell-d');

            expect(t('shell-d:title')).toBe('Dashboard');
        });

        it('registering_again_replaces_the_namespace_so_built_ins_can_be_overridden', async () => {
            registerNamespace('en', 'r-validation', { required: 'Please fill this in.' });

            await loadNamespace('r-validation');

            expect(t('r-validation:required')).toBe('Please fill this in.');
        });

        it('untranslated_namespace_falls_back_to_english', async () => {
            registerNamespace('en', 'shell-e', { title: 'Dashboard' });
            await setLocale('sv');

            await loadNamespace('shell-e');

            expect(t('shell-e:title')).toBe('Dashboard');
        });

        it('registrations_survive_a_locale_switch', async () => {
            registerNamespace('en', 'shell-f', { title: 'Dashboard' });
            registerNamespace('sv', 'shell-f', { title: 'Instrumentpanel' });

            await setLocale('sv');
            await loadNamespace('shell-f');

            expect(t('shell-f:title')).toBe('Instrumentpanel');
        });

        it('failing_loader_is_reported_instead_of_breaking_bootstrap', async () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            registerNamespace('en', 'shell-g', () => Promise.reject(new Error('offline')));

            await expect(loadNamespace('shell-g')).resolves.toBeUndefined();

            expect(warn).toHaveBeenCalledWith(
                expect.stringContaining('shell-g'),
                expect.any(Error),
            );
            warn.mockRestore();
        });
    });

    describe('registerCatalogue', () => {
        it('locale_and_namespace_are_read_from_the_file_path', async () => {
            registerCatalogue({
                './locales/en/shell-h.json': { title: 'Dashboard' },
                './locales/sv/shell-h.json': { title: 'Instrumentpanel' },
            });

            await setLocale('sv');
            await loadNamespace('shell-h');

            expect(t('shell-h:title')).toBe('Instrumentpanel');
        });

        it('eager_glob_modules_are_unwrapped', async () => {
            registerCatalogue({
                './locales/en/shell-i.json': { default: { title: 'Dashboard' } },
            });

            await loadNamespace('shell-i');

            expect(t('shell-i:title')).toBe('Dashboard');
        });

        it('lazy_glob_loaders_are_supported', async () => {
            registerCatalogue({
                './locales/en/shell-j.json': () =>
                    Promise.resolve({ default: { title: 'Dashboard' } }),
            });

            await loadNamespace('shell-j');

            expect(t('shell-j:title')).toBe('Dashboard');
        });

        it('absolute_paths_are_supported', async () => {
            registerCatalogue({
                '/src/i18n/locales/en/shell-k.json': { title: 'Dashboard' },
            });

            await loadNamespace('shell-k');

            expect(t('shell-k:title')).toBe('Dashboard');
        });

        it('entry_without_locale_segment_is_skipped_with_a_warning', async () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

            registerCatalogue({ 'shell-l.json': { title: 'Dashboard' } });

            expect(warn).toHaveBeenCalledWith(expect.stringContaining('shell-l.json'));
            warn.mockRestore();
        });
    });

    describe('required text', () => {
        it('fallback_renders_a_sentence_when_the_key_is_missing', () => {
            const result = t('shell:aiDisclosure', undefined, {
                fallback: 'You are interacting with an AI system.',
            });

            expect(result).toBe('You are interacting with an AI system.');
        });

        it('fallback_supports_interpolation', () => {
            const result = t('shell:aiDisclosure', { name: 'Ada' }, {
                fallback: 'Hello {name}, you are interacting with an AI system.',
            });

            expect(result).toBe('Hello Ada, you are interacting with an AI system.');
        });

        it('translation_wins_over_fallback_when_it_exists', async () => {
            registerNamespace('en', 'shell-m', { aiDisclosure: 'This is an AI assistant.' });

            await loadNamespace('shell-m');

            const result = t('shell-m:aiDisclosure', undefined, {
                fallback: 'You are interacting with an AI system.',
            });

            expect(result).toBe('This is an AI assistant.');
        });

        it('missing_handler_still_fires_when_a_fallback_is_given', () => {
            const handler = vi.fn();
            onMissingTranslation(handler);

            const result = t('shell:aiDisclosure', undefined, { fallback: 'Fallback text.' });

            expect(result).toBe('Fallback text.');
            expect(handler).toHaveBeenCalledWith('aiDisclosure', 'shell', 'en');
        });
    });
});
