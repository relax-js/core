import { describe, it, expect, vi } from 'vitest';
import { compileTemplate } from '../../src/html/template';

function fire(el: Element, type: string): void {
    el.dispatchEvent(new Event(type, { bubbles: true }));
}

describe('compileTemplate r-<event> handling', () => {
    it('r_click_calls_function_from_functions_context', () => {
        const save = vi.fn();
        const { content, render } = compileTemplate('<button r-click="save()">Save</button>');
        render({}, { save });

        fire(content.querySelector('button')!, 'click');

        expect(save).toHaveBeenCalledTimes(1);
    });

    it('r_change_wires_the_change_event_on_an_input', () => {
        const onChange = vi.fn();
        const { content, render } = compileTemplate('<input r-change="onChange()">');
        render({}, { onChange });

        fire(content.querySelector('input')!, 'change');

        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('r_keypress_wires_the_keypress_event', () => {
        const onKey = vi.fn();
        const { content, render } = compileTemplate('<input r-keypress="onKey()">');
        render({}, { onKey });

        fire(content.querySelector('input')!, 'keypress');

        expect(onKey).toHaveBeenCalledTimes(1);
    });

    it('multiple_r_event_attributes_on_one_element_are_all_wired', () => {
        const onInput = vi.fn();
        const onBlur = vi.fn();
        const { content, render } = compileTemplate(
            '<input r-input="onInput()" r-blur="onBlur()">'
        );
        render({}, { onInput, onBlur });

        const input = content.querySelector('input')!;
        fire(input, 'input');
        fire(input, 'blur');

        expect(onInput).toHaveBeenCalledTimes(1);
        expect(onBlur).toHaveBeenCalledTimes(1);
    });

    it('unknown_event_name_is_reported_and_not_wired', () => {
        const onError = vi.fn();
        const handler = vi.fn();
        const { content, render } = compileTemplate('<button r-frobnicate="handler()">x</button>', {
            strict: false,
            onError,
        });
        render({}, { handler });

        fire(content.querySelector('button')!, 'frobnicate');

        expect(onError).toHaveBeenCalled();
        expect(handler).not.toHaveBeenCalled();
    });

    it('r_click_passes_object_argument_to_handler', () => {
        const removeRow = vi.fn();
        const { content, render } = compileTemplate('<button r-click="removeRow(row)">x</button>');
        const row = { id: 1, name: 'Apple' };
        render({ row }, { removeRow });

        fire(content.querySelector('button')!, 'click');

        expect(removeRow).toHaveBeenCalledWith(row);
    });

    it('r_click_passes_nested_object_argument_to_handler', () => {
        const pick = vi.fn();
        const { content, render } = compileTemplate('<button r-click="pick(row.owner)">x</button>');
        const owner = { id: 'o-9' };
        render({ row: { owner } }, { pick });

        fire(content.querySelector('button')!, 'click');

        expect(pick).toHaveBeenCalledWith(owner);
    });

    it('r_click_inside_loop_passes_correct_per_row_object', () => {
        const pick = vi.fn();
        const { content, render } = compileTemplate(`
            <ul>
                <li loop="row in rows">
                    <button r-click="pick(row)">{{row.name}}</button>
                </li>
            </ul>
        `);
        const rows = [
            { id: 'a', name: 'Apple' },
            { id: 'b', name: 'Banana' },
        ];
        render({ rows }, { pick });

        fire(content.querySelectorAll('button')[1], 'click');

        expect(pick).toHaveBeenCalledWith(rows[1]);
    });

    it('event_keyword_resolves_to_the_native_dom_event', () => {
        const capture = vi.fn();
        const { content, render } = compileTemplate('<button r-click="capture(event)">x</button>');
        render({}, { capture });

        fire(content.querySelector('button')!, 'click');

        expect(capture.mock.calls[0][0]).toBeInstanceOf(Event);
    });

    it('string_and_number_literals_are_passed_as_arguments', () => {
        const pick = vi.fn();
        const { content, render } = compileTemplate('<button r-click="pick(\'apple\', 3)">x</button>');
        render({}, { pick });

        fire(content.querySelector('button')!, 'click');

        expect(pick).toHaveBeenCalledWith('apple', 3);
    });

    it('clicking_a_child_element_still_triggers_the_handler', () => {
        const open = vi.fn();
        const { content, render } = compileTemplate(
            '<button r-click="open()"><span class="icon">*</span></button>'
        );
        render({}, { open });

        fire(content.querySelector('span.icon')!, 'click');

        expect(open).toHaveBeenCalledTimes(1);
    });

    it('handler_still_works_after_re_render_adds_rows', () => {
        const pick = vi.fn();
        const { content, render } = compileTemplate(`
            <ul>
                <li loop="row in rows">
                    <button r-click="pick(row)">{{row.name}}</button>
                </li>
            </ul>
        `);
        const fns = { pick };

        render({ rows: [{ id: 'a', name: 'Apple' }] }, fns);
        const banana = { id: 'b', name: 'Banana' };
        render({ rows: [{ id: 'a', name: 'Apple' }, banana] }, fns);

        fire(content.querySelectorAll('button')[1], 'click');

        expect(pick).toHaveBeenCalledWith(banana);
    });

    it('handler_passes_latest_row_data_after_slot_is_reused', () => {
        const pick = vi.fn();
        const { content, render } = compileTemplate(`
            <ul>
                <li loop="row in rows">
                    <button r-click="pick(row)">{{row.name}}</button>
                </li>
            </ul>
        `);
        const fns = { pick };

        render({ rows: [{ id: 'a', name: 'Apple' }] }, fns);
        const updated = { id: 'a', name: 'Apricot' };
        render({ rows: [updated] }, fns);

        fire(content.querySelector('button')!, 'click');

        expect(pick).toHaveBeenCalledWith(updated);
    });

    it('r_event_attribute_is_removed_from_rendered_output', () => {
        const { content, render } = compileTemplate('<button r-click="save()">Save</button>');
        render({}, { save: () => {} });

        expect(content.querySelector('button')!.hasAttribute('r-click')).toBe(false);
    });

    it('unknown_function_does_not_throw_in_non_strict_mode', () => {
        const { content, render } = compileTemplate('<button r-click="missing()">x</button>');
        render({}, {});

        expect(() => fire(content.querySelector('button')!, 'click')).not.toThrow();
    });

    it('unknown_function_is_reported_through_onError_when_the_event_fires', () => {
        const onError = vi.fn();
        const { content, render } = compileTemplate('<button r-click="missing()">x</button>', {
            strict: false,
            onError,
        });
        render({}, {});

        fire(content.querySelector('button')!, 'click');

        expect(onError).toHaveBeenCalled();
    });

    it('strict_mode_throws_when_r_event_names_an_unknown_event', () => {
        expect(() =>
            compileTemplate('<button r-frobnicate="handler()">x</button>', { strict: true })
        ).toThrow();
    });

    it('r_event_with_a_non_function_expression_is_reported', () => {
        const onError = vi.fn();
        compileTemplate('<button r-click="row.field">x</button>', {
            strict: false,
            onError,
        });

        expect(onError).toHaveBeenCalled();
    });

    it('handler_is_not_invoked_before_the_first_render', () => {
        const save = vi.fn();
        const { content } = compileTemplate('<button r-click="save()">Save</button>');

        fire(content.querySelector('button')!, 'click');

        expect(save).not.toHaveBeenCalled();
    });

    it('a_valid_r_event_still_wires_when_a_sibling_r_attribute_is_invalid', () => {
        const save = vi.fn();
        const { content, render } = compileTemplate(
            '<button r-frobnicate="bad()" r-click="save()">Save</button>',
            { strict: false }
        );
        render({}, { save });

        fire(content.querySelector('button')!, 'click');

        expect(save).toHaveBeenCalledTimes(1);
    });
});
