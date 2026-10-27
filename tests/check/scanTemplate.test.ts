import { describe, it, expect } from 'vitest';
import { scanTemplate, TemplateEvent } from '../../src/check/scanTemplate';

function kinds(events: TemplateEvent[]): string[] {
    return events.map(e =>
        e.kind === 'text' ? `text:${e.text}` : e.kind === 'reshape' ? 'reshape' : `${e.kind}:${e.tag}`
    );
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

    it('a_block_element_closes_an_open_paragraph_like_the_browser_does', () => {
        const events = scanTemplate('<p loop="u in users"><div>{{u.name}}</div></p>');

        expect(kinds(events)).toEqual([
            'open:p', 'reshape', 'close:p', 'open:div', 'text:{{u.name}}', 'close:div',
        ]);
        expect(events[1]).toMatchObject({ kind: 'reshape', offset: 21 });
    });

    it('a_paragraph_followed_by_another_paragraph_closes_quietly', () => {
        expect(kinds(scanTemplate('<p>a<p>b'))).toEqual([
            'open:p', 'text:a', 'close:p', 'open:p', 'text:b', 'close:p',
        ]);
    });

    it('a_block_element_inside_a_button_in_a_paragraph_leaves_the_paragraph_open', () => {
        expect(kinds(scanTemplate('<p><button><div>x</div></button></p>'))).toEqual([
            'open:p', 'open:button', 'open:div', 'text:x', 'close:div', 'close:button', 'close:p',
        ]);
    });

    it('a_table_row_outside_a_table_is_reported_because_the_browser_drops_it', () => {
        const events = scanTemplate('<my-grid><tr loop="r in rows"><td>{{r}}</td></tr></my-grid>');

        expect(kinds(events).filter(k => k === 'reshape')).toHaveLength(2);
        expect(events.find(e => e.kind === 'reshape')).toMatchObject({ offset: 9 });
    });

    it('a_table_row_inside_a_table_is_not_reported', () => {
        expect(kinds(scanTemplate('<table><tr><td>x</td></tr></table>'))).not.toContain('reshape');
    });

    it('a_table_row_at_the_root_of_an_html_template_is_kept_by_the_browser', () => {
        expect(kinds(scanTemplate('<tr><td>x</td></tr>', 'template'))).not.toContain('reshape');
        expect(kinds(scanTemplate('<tr><td>x</td></tr>'))).toContain('reshape');
    });

    it('tag_names_are_lower_cased', () => {
        expect(kinds(scanTemplate('<DIV></DIV>'))).toEqual(['open:div', 'close:div']);
    });
});
