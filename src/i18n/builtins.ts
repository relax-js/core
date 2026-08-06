/**
 * @module i18n/builtins
 * Registers the namespaces that ship with Relaxjs.
 *
 * English is imported directly so it is always present in the bundle and can act
 * as the fallback for every other locale. The remaining locales are loaded the
 * first time they are selected.
 */

import { registerNamespace } from './catalogue';
import enCommon from './locales/en/r-common.json';
import enPipes from './locales/en/r-pipes.json';
import enValidation from './locales/en/r-validation.json';

/**
 * Fills the catalogue with `r-common`, `r-pipes`, and `r-validation`.
 *
 * Called once when the i18n module loads. An application may replace any of these
 * afterwards by registering the same locale and namespace again.
 */
export function registerBuiltinNamespaces(): void {
    registerNamespace('en', 'r-common', enCommon);
    registerNamespace('en', 'r-pipes', enPipes);
    registerNamespace('en', 'r-validation', enValidation);

    registerNamespace('sv', 'r-common', () => import('./locales/sv/r-common.json'));
    registerNamespace('sv', 'r-pipes', () => import('./locales/sv/r-pipes.json'));
    registerNamespace('sv', 'r-validation', () => import('./locales/sv/r-validation.json'));
}
