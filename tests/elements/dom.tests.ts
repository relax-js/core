import { describe, it, expect, beforeEach } from 'vitest';
import { selectOne, formError } from '../../src/elements/dom';

// jsdom doesn't provide CSS.escape
if (typeof CSS === 'undefined') {
    (globalThis as any).CSS = { escape: (s: string) => s };
}

describe('selectOne', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('should_find_element_by_css_selector', () => {
        document.body.innerHTML = '<div class="target">found</div>';
        const el = selectOne('.target');
        expect(el.textContent).toBe('found');
    });

    it('should_find_element_by_id_selector', () => {
        document.body.innerHTML = '<input id="email" />';
        const el = selectOne('#email');
        expect(el.tagName).toBe('INPUT');
    });

    it('should_find_element_by_name_when_id_not_found', () => {
        document.body.innerHTML = '<input name="email" />';
        const el = selectOne('#email');
        expect(el.tagName).toBe('INPUT');
    });

    it('should_throw_when_no_element_matches', () => {
        expect(() => selectOne('.missing')).toThrow("No element found matching '.missing'");
    });

    it('should_search_within_parent_element', () => {
        document.body.innerHTML = `
            <div id="parent"><span class="child">inner</span></div>
            <span class="child">outer</span>
        `;
        const parent = document.getElementById('parent')!;
        const el = selectOne('.child', parent);
        expect(el.textContent).toBe('inner');
    });
});

describe('formError', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('should_set_validation_error_on_input', () => {
        document.body.innerHTML = '<input id="email" />';
        const input = document.getElementById('email') as HTMLInputElement;
        formError('#email', 'Required');
        expect(input.validationMessage).toBe('Required');
    });

    it('should_clear_validation_error', () => {
        document.body.innerHTML = '<input id="email" />';
        const input = document.getElementById('email') as HTMLInputElement;
        formError('#email', 'Required');
        formError('#email', '');
        expect(input.validationMessage).toBe('');
    });

    it('should_set_validation_error_on_select', () => {
        document.body.innerHTML = '<select id="country"></select>';
        formError('#country', 'Pick one');
        const select = document.getElementById('country') as HTMLSelectElement;
        expect(select.validationMessage).toBe('Pick one');
    });

    it('should_set_validation_error_on_textarea', () => {
        document.body.innerHTML = '<textarea id="notes"></textarea>';
        formError('#notes', 'Too short');
        const textarea = document.getElementById('notes') as HTMLTextAreaElement;
        expect(textarea.validationMessage).toBe('Too short');
    });

    it('should_throw_for_non_form_element', () => {
        document.body.innerHTML = '<div id="box"></div>';
        expect(() => formError('#box', 'error')).toThrow('is not a form field');
    });
});
