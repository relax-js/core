import { describe, it, expect, beforeEach } from 'vitest';
import { h } from '../../src/jsx';
import { onError } from '../../src/errors';
import { captureRelaxErrors } from '../../src/testing';

class TestRowPickedEvent extends Event {
    static readonly type = 'test-row-picked';

    constructor(public readonly rowId: string) {
        super(TestRowPickedEvent.type, { bubbles: true });
    }
}

declare global {
    interface GlobalEventHandlersEventMap {
        [TestRowPickedEvent.type]: TestRowPickedEvent;
    }
}

class TestUserCard extends HTMLElement {
    userName = '';
    nameSeenOnConnect = '';

    connectedCallback() {
        this.nameSeenOnConnect = this.userName;
    }
}
customElements.define('test-user-card', TestUserCard);

class TestNeverDefined extends HTMLElement {}

/**
 * jsdom 26 lacks `customElements.getName`, which every current browser has. Without it the
 * registration check is skipped and the browser's own "Illegal constructor" is what surfaces.
 */
function withGetName(names: Map<Function, string>, run: () => void) {
    const registry = customElements as any;
    const original = registry.getName;
    registry.getName = (type: Function) => names.get(type) ?? null;
    try {
        run();
    } finally {
        registry.getName = original;
    }
}

describe('h', () => {
    beforeEach(() => {
        onError(null as any);
    });

    describe('elements', () => {
        it('expression_is_the_real_dom_element_not_a_description_of_one', () => {
            const list = <ul className="issues" />;

            expect(list).toBeInstanceOf(HTMLUListElement);
            document.body.replaceChildren(list);
            expect(document.querySelector('.issues')).toBe(list);
        });

        it('prop_without_a_dash_is_assigned_to_the_dom_property', () => {
            const input = <input value="Alice" disabled /> as HTMLInputElement;

            expect(input.value).toBe('Alice');
            expect(input.disabled).toBe(true);
        });

        it('prop_with_a_dash_is_set_as_an_attribute', () => {
            const button = <button data-id="42" aria-label="Close" />;

            expect(button.getAttribute('data-id')).toBe('42');
            expect(button.getAttribute('aria-label')).toBe('Close');
        });

        it('attribute_set_to_false_or_null_is_left_out_and_true_is_present_but_empty', () => {
            const div = <div data-open={true} data-hidden={false} data-missing={null} />;

            expect(div.getAttribute('data-open')).toBe('');
            expect(div.hasAttribute('data-hidden')).toBe(false);
            expect(div.hasAttribute('data-missing')).toBe(false);
        });

        it('style_takes_a_css_string', () => {
            const div = <div style="color: red" />;

            expect(div.style.color).toBe('red');
        });

        it('react_spelling_of_a_property_is_reported_instead_of_set_as_an_expando', () => {
            const captured = captureRelaxErrors();
            try {
                // @ts-expect-error onClick is not a DOM property; the DOM spells it onclick
                <button onClick={() => {}} />;
            } finally {
                captured.restore();
            }

            expect(captured.messages()).toHaveLength(1);
            expect(captured.messages()[0]).toContain("<button> has no property 'onClick'");
        });

        it('html_attribute_name_that_differs_from_the_dom_property_is_a_type_error', () => {
            const captured = captureRelaxErrors();
            try {
                // @ts-expect-error the DOM property is htmlFor
                <label for="email" />;
            } finally {
                captured.restore();
            }

            expect(captured.messages()[0]).toContain("'for'");
        });
    });

    describe('children', () => {
        it('text_numbers_elements_and_arrays_are_appended_in_order', () => {
            const items = ['a', 'b'];
            const list = (
                <p>
                    Count: {2}
                    <b>!</b>
                    {items.map((item) => <i>{item}</i>)}
                </p>
            );

            expect(list.innerHTML).toBe('Count: 2<b>!</b><i>a</i><i>b</i>');
        });

        it('null_undefined_and_booleans_render_nothing_so_conditions_can_be_inline', () => {
            const busy = false;
            const div = (
                <div>
                    {busy && <span>Loading</span>}
                    {null}
                    {undefined}
                    {true}
                </div>
            );

            expect(div.childNodes).toHaveLength(0);
        });

        it('text_is_never_parsed_as_html', () => {
            const userInput = '<img src=x onerror="alert(1)">';
            const p = <p>{userInput}</p>;

            expect(p.querySelector('img')).toBeNull();
            expect(p.textContent).toBe(userInput);
        });

        it('object_that_is_not_a_node_is_reported_instead_of_printed_as_object_object', () => {
            const captured = captureRelaxErrors();
            try {
                <p>{{ name: 'Alice' } as any}</p>;
            } finally {
                captured.restore();
            }

            expect(captured.messages()).toHaveLength(1);
            expect(captured.messages()[0]).toContain('<p> was given a object');
        });
    });

    describe('events', () => {
        it('onclick_is_the_dom_property_and_fires_on_click', () => {
            let clicks = 0;
            const button = <button onclick={() => clicks++} />;

            button.click();

            expect(clicks).toBe(1);
        });

        it('on_listens_for_registered_custom_events_with_the_event_class_type', () => {
            let picked = '';
            const row = (
                <tr on={{ 'test-row-picked': (event) => (picked = event.rowId) }} />
            );

            row.dispatchEvent(new TestRowPickedEvent('7'));

            expect(picked).toBe('7');
        });

        it('on_rejects_an_event_name_that_is_not_registered', () => {
            // @ts-expect-error the event is not in GlobalEventHandlersEventMap
            <tr on={{ 'test-unregistered': () => {} }} />;
        });
    });

    describe('components', () => {
        it('function_component_runs_once_with_props_and_children', () => {
            let runs = 0;
            const Panel = (props: { title: string; children?: unknown }) => {
                runs++;
                return (
                    <section>
                        <h2>{props.title}</h2>
                        {props.children as Node[]}
                    </section>
                );
            };

            const panel = (
                <Panel title="Issues">
                    <p>None</p>
                </Panel>
            );

            expect(runs).toBe(1);
            expect(panel.outerHTML).toBe('<section><h2>Issues</h2><p>None</p></section>');
        });

        it('function_component_rejects_a_prop_it_does_not_declare', () => {
            const Badge = (props: { count: number }) => <span>{props.count}</span>;

            // @ts-expect-error label is not a prop of Badge
            <Badge count={1} label="x" />;
        });

        it('custom_element_class_is_created_by_its_registered_tag_with_props_set_before_connect', () => {
            const card = <TestUserCard userName="Alice" />;

            document.body.replaceChildren(card);

            expect(card.tagName.toLowerCase()).toBe('test-user-card');
            expect((card as TestUserCard).nameSeenOnConnect).toBe('Alice');
        });

        it('custom_element_class_rejects_a_prop_that_is_not_a_field', () => {
            const captured = captureRelaxErrors();
            try {
                // @ts-expect-error userNmae is not a field of TestUserCard
                <TestUserCard userNmae="Alice" />;
            } finally {
                captured.restore();
            }
        });

        it('unregistered_custom_element_class_is_reported_by_class_name', () => {
            const captured = captureRelaxErrors();
            try {
                withGetName(new Map(), () => <TestNeverDefined />);
            } finally {
                captured.restore();
            }

            expect(captured.messages()).toHaveLength(1);
            expect(captured.messages()[0]).toContain('TestNeverDefined is not registered');
        });
    });
});
