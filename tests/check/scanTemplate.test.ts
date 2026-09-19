import { describe, it, expect } from 'vitest';
import { scanTemplate, TemplateEvent } from '../../src/check/scanTemplate';

function kinds(events: TemplateEvent[]): string[] {
    return events.map(e => (e.kind === 'text' ? `text:${e.text}` : `${e.kind}:${e.tag}`));
}

describe('scanTemplate', () => {
    it('reports_attributes_with_the_offset_of_their_value', () => {
        const text = '<a href="/u/{{id}}" class=plain>x</a>';
        const [open] = scanTemplate(text);
        if (open.kind !== 'open') throw new Error('expected open');
        expect(open.tag).toBe('a');
        expect(open.attributes).toEqual([
            { name: 'href', value: '/u/{{id}}', offset: text.indexOf('/u/') },
            { name: 'class', value: 'plain', offset: text.indexOf('plain') },
        ]);
    });

    it('reports_text_with_its_offset', () => {
        const text = '<p>Hello {{name}}</p>';
        const events = scanTemplate(text);
        expect(events[1]).toEqual({ kind: 'text', text: 'Hello {{name}}', offset: 3 });
    });

    it('void_elements_never_get_a_close_event', () => {
        expect(kinds(scanTemplate('<p><input value="{{v}}"><br>x</p>'))).toEqual([
            'open:p', 'open:input', 'open:br', 'text:x', 'close:p',
        ]);
    });

    it('a_self_closing_tag_opens_and_closes_in_one_event', () => {
        const [open] = scanTemplate('<r-icon name="{{n}}" />');
        expect(open).toMatchObject({ kind: 'open', tag: 'r-icon', selfClosing: true });
    });

    it('close_events_follow_nesting_order', () => {
        expect(kinds(scanTemplate('<ul><li loop="a in b"><b>{{a}}</b></li></ul>'))).toEqual([
            'open:ul', 'open:li', 'open:b', 'text:{{a}}', 'close:b', 'close:li', 'close:ul',
        ]);
    });

    it('comments_are_skipped', () => {
        expect(kinds(scanTemplate('<p><!-- {{not.checked}} -->{{a}}</p>'))).toEqual([
            'open:p', 'text:{{a}}', 'close:p',
        ]);
    });

    it('a_close_tag_without_a_matching_open_is_ignored', () => {
        expect(kinds(scanTemplate('<p>x</span>y</p>'))).toEqual([
            'open:p', 'text:x', 'text:y', 'close:p',
        ]);
    });

    it('a_close_tag_pops_the_elements_left_open_inside_it', () => {
        expect(kinds(scanTemplate('<ul><li>a<li>b</ul>'))).toEqual([
            'open:ul', 'open:li', 'text:a', 'open:li', 'text:b', 'close:li', 'close:li', 'close:ul',
        ]);
    });

    it('attribute_values_may_be_unquoted_or_single_quoted', () => {
        const [open] = scanTemplate("<i if='a.b' data-x=1></i>");
        if (open.kind !== 'open') throw new Error('expected open');
        expect(open.attributes.map(a => [a.name, a.value])).toEqual([['if', 'a.b'], ['data-x', '1']]);
    });

    it('tag_names_are_lower_cased', () => {
        expect(kinds(scanTemplate('<DIV></DIV>'))).toEqual(['open:div', 'close:div']);
    });
});
