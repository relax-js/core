import { describe, it, expect, beforeEach } from 'vitest';
import { html } from '../../src/html/html';
import { onError, RelaxError } from '../../src/errors';

describe('html template engine', () => {
    describe('basic rendering', () => {
        it('should render simple text', () => {
            const template = html`<div>Hello World</div>`;
            const result = template({});
            expect(result.fragment.querySelector('div')?.textContent).toBe('Hello World');
        });

        it('should render mustache bindings', () => {
            const template = html`<div>{{name}}</div>`;
            const result = template({ name: 'John' });
            expect(result.fragment.querySelector('div')?.textContent).toBe('John');
        });

        it('should render multiple mustache bindings', () => {
            const template = html`<div>{{greeting}}, {{name}}!</div>`;
            const result = template({ greeting: 'Hello', name: 'World' });
            expect(result.fragment.querySelector('div')?.textContent).toBe('Hello, World!');
        });

        it('should render template literal substitutions', () => {
            const name = 'John';
            const template = html`<div>${name}</div>`;
            const result = template({});
            expect(result.fragment.querySelector('div')?.textContent).toBe('John');
        });

        it('should render function substitutions bound to context', () => {
            const getName = function(this: any) { return this.name; };
            const template = html`<div>${getName}</div>`;
            const result = template({ name: 'John' });
            expect(result.fragment.querySelector('div')?.textContent).toBe('John');
        });
    });

    describe('attribute binding', () => {
        it('should bind mustache to attributes', () => {
            const template = html`<a href="{{url}}">Link</a>`;
            const result = template({ url: 'https://example.com' });
            expect(result.fragment.querySelector('a')?.getAttribute('href')).toBe('https://example.com');
        });

        it('should bind class attribute', () => {
            const template = html`<span class="{{className}}">Text</span>`;
            const result = template({ className: 'active highlight' });
            expect(result.fragment.querySelector('span')?.getAttribute('class')).toBe('active highlight');
        });

        it('should set element properties directly when attribute is a property', () => {
            const template = html`<input value="{{val}}">`;
            const result = template({ val: 'test value' });
            const input = result.fragment.querySelector('input') as HTMLInputElement;
            expect(input?.value).toBe('test value');
        });
    });

    describe('event handlers', () => {
        it('should bind event handlers from substitutions', () => {
            let clicked = false;
            const handleClick = function() { clicked = true; };
            const template = html`<button onclick=${handleClick}>Click</button>`;
            const result = template({});
            const button = result.fragment.querySelector('button') as HTMLButtonElement;
            button.click();
            expect(clicked).toBe(true);
        });

        it('should bind event handler with context', () => {
            let receivedId: string | undefined;
            const handleClick = function(this: any) { receivedId = this.id; };
            const template = html`<button onclick=${handleClick}>Click</button>`;
            const result = template({ id: '42' });
            const button = result.fragment.querySelector('button') as HTMLButtonElement;
            button.click();
            expect(receivedId).toBe('42');
        });
    });

    describe('function calls in mustache', () => {
        it('should call context function without arguments', () => {
            const template = html`<div>{{getName}}</div>`;
            const result = template({
                name: 'John',
                getName() { return this.name; }
            });
            expect(result.fragment.querySelector('div')?.textContent).toBe('John');
        });

        it('should call context function with arguments via pipes', () => {
            const template = html`<div>{{greet|name}}</div>`;
            const result = template({
                name: 'John',
                greet(name: string) { return `Hello, ${name}!`; }
            });
            expect(result.fragment.querySelector('div')?.textContent).toBe('Hello, John!');
        });
    });

    describe('update functionality', () => {
        it('should return update function', () => {
            const template = html`<div>{{name}}</div>`;
            const result = template({ name: 'John' });
            expect(typeof result.update).toBe('function');
        });

        it('should update text content when update is called', () => {
            const template = html`<div>{{name}}</div>`;
            const result = template({ name: 'John' });

            const container = document.createElement('div');
            container.appendChild(result.fragment);
            expect(container.querySelector('div')?.textContent).toBe('John');

            result.update({ name: 'Jane' });
            expect(container.querySelector('div')?.textContent).toBe('Jane');
        });

        it('should update attributes when update is called', () => {
            const template = html`<a href="{{url}}">Link</a>`;
            const result = template({ url: 'https://first.com' });

            const container = document.createElement('div');
            container.appendChild(result.fragment);
            expect(container.querySelector('a')?.getAttribute('href')).toBe('https://first.com');

            result.update({ url: 'https://second.com' });
            expect(container.querySelector('a')?.getAttribute('href')).toBe('https://second.com');
        });

        it('should update multiple bindings', () => {
            const template = html`<div>{{greeting}}, {{name}}!</div>`;
            const result = template({ greeting: 'Hello', name: 'John' });

            const container = document.createElement('div');
            container.appendChild(result.fragment);
            expect(container.querySelector('div')?.textContent).toBe('Hello, John!');

            result.update({ greeting: 'Hi', name: 'Jane' });
            expect(container.querySelector('div')?.textContent).toBe('Hi, Jane!');
        });
    });

    describe('edge cases', () => {
        it('should handle empty template', () => {
            const template = html``;
            const result = template({});
            expect(result.fragment.childNodes.length).toBe(0);
        });

        it('should handle undefined values', () => {
            const template = html`<div>{{missing}}</div>`;
            const result = template({});
            expect(result.fragment.querySelector('div')?.textContent).toBe('undefined');
        });

        it('should handle null values', () => {
            const template = html`<div>{{value}}</div>`;
            const result = template({ value: null });
            expect(result.fragment.querySelector('div')?.textContent).toBe('null');
        });

        it('should handle numeric values', () => {
            const template = html`<div>{{count}}</div>`;
            const result = template({ count: 42 });
            expect(result.fragment.querySelector('div')?.textContent).toBe('42');
        });

        it('should handle zero', () => {
            const template = html`<div>{{count}}</div>`;
            const result = template({ count: 0 });
            expect(result.fragment.querySelector('div')?.textContent).toBe('0');
        });

        it('should handle boolean values', () => {
            const template = html`<div>{{flag}}</div>`;
            const result = template({ flag: true });
            expect(result.fragment.querySelector('div')?.textContent).toBe('true');
        });

        it('should preserve whitespace around expressions', () => {
            const template = html`<div>  {{name}}  </div>`;
            const result = template({ name: 'test' });
            expect(result.fragment.querySelector('div')?.textContent).toBe('  test  ');
        });

        it('should handle nested elements', () => {
            const template = html`
                <div>
                    <span>{{outer}}</span>
                    <div>
                        <span>{{inner}}</span>
                    </div>
                </div>
            `;
            const result = template({ outer: 'Outer', inner: 'Inner' });
            const spans = result.fragment.querySelectorAll('span');
            expect(spans[0]?.textContent).toBe('Outer');
            expect(spans[1]?.textContent).toBe('Inner');
        });

        it('should handle empty attribute values', () => {
            const template = html`<div data-empty="">Content</div>`;
            const result = template({});
            expect(result.fragment.querySelector('div')?.getAttribute('data-empty')).toBe('');
        });
    });

    describe('HTML substitutions', () => {
        it('should render ${} string containing HTML as actual DOM elements', () => {
            const items = ['A', 'B'];
            const tpl = html`
                <div class="list">
                    ${items.map(i => `<button>${i}</button>`).join('')}
                </div>
            `;
            const result = tpl({});
            const buttons = result.fragment.querySelectorAll('button');
            expect(buttons.length).toBe(2);
            expect(buttons[0]?.textContent).toBe('A');
            expect(buttons[1]?.textContent).toBe('B');
        });

        it('should render ${} HTML substitution and update it', () => {
            const getButtons = function(this: any) {
                return this.items.map((i: string) => `<span>${i}</span>`).join('');
            };
            const tpl = html`<div>${getButtons}</div>`;
            const result = tpl({ items: ['X', 'Y'] });

            const container = document.createElement('div');
            container.appendChild(result.fragment);

            expect(container.querySelectorAll('span').length).toBe(2);
            expect(container.querySelectorAll('span')[0]?.textContent).toBe('X');

            result.update({ items: ['A', 'B', 'C'] });
            expect(container.querySelectorAll('span').length).toBe(3);
            expect(container.querySelectorAll('span')[2]?.textContent).toBe('C');
        });
    });

    describe('instance semantics', () => {
        beforeEach(() => {
            onError(null as any);
        });

        it('calling_the_template_function_again_rebinds_the_first_instance_instead_of_adding_one', () => {
            const reported: RelaxError[] = [];
            onError((error, ctx) => {
                reported.push(error);
                ctx.suppress();
            });

            const card = html`<p>{{name}}</p>`;
            const host = document.createElement('div');

            host.appendChild(card({ name: 'Alice' }).fragment);
            host.appendChild(card({ name: 'Bob' }).fragment);

            expect(host.querySelectorAll('p').length).toBe(1);
            expect(host.textContent).toBe('Bob');
            expect(reported).toHaveLength(1);
            expect(reported[0].message).toContain('update(');
        });

        it('binding_a_second_time_is_reported_because_it_silently_replaces_the_first_instance', () => {
            const reported: RelaxError[] = [];
            onError((error, ctx) => {
                reported.push(error);
                ctx.suppress();
            });

            const card = html`<p>{{name}}</p>`;
            card({ name: 'Alice' });
            expect(reported).toHaveLength(0);

            card({ name: 'Bob' });
            card({ name: 'Carol' });

            expect(reported).toHaveLength(2);
            expect(reported[0].context.bindCount).toBe(2);
            expect(reported[1].context.bindCount).toBe(3);
        });

        it('updating_an_instance_in_place_is_the_supported_path_and_reports_nothing', () => {
            const reported: RelaxError[] = [];
            onError((error, ctx) => {
                reported.push(error);
                ctx.suppress();
            });

            const instance = html`<p>{{name}}</p>`({ name: 'Alice' });
            instance.update({ name: 'Bob' });
            instance.update({ name: 'Carol' });

            expect(reported).toHaveLength(0);
        });

        it('evaluating_the_tagged_literal_again_is_what_produces_an_independent_instance', () => {
            const card = (name: string) => html`<p>{{name}}</p>`({ name });
            const host = document.createElement('div');

            host.appendChild(card('Alice').fragment);
            host.appendChild(card('Bob').fragment);

            expect(host.querySelectorAll('p').length).toBe(2);
            expect(host.textContent).toBe('AliceBob');
        });
    });

    describe('mixed syntax', () => {
        it('should handle both ${} and {{}} in same template', () => {
            const staticValue = 'Static';
            const template = html`<div>${staticValue} and {{dynamic}}</div>`;
            const result = template({ dynamic: 'Dynamic' });
            expect(result.fragment.querySelector('div')?.textContent).toBe('Static and Dynamic');
        });
    });

    describe('unresolved expressions are reported', () => {
        beforeEach(() => {
            onError(null as any);
        });

        function capture() {
            const reported: RelaxError[] = [];
            onError((error, ctx) => {
                reported.push(error);
                ctx.suppress();
            });
            return reported;
        }

        it('a_key_missing_from_the_render_context_is_reported', () => {
            const reported = capture();

            html`<div>{{missing}}</div>`({});

            expect(reported).toHaveLength(1);
            expect(reported[0].context.expression).toBe('missing');
        });

        it('a_key_that_exists_and_holds_null_is_a_deliberate_value_and_reports_nothing', () => {
            const reported = capture();

            html`<div>{{value}}</div>`({ value: null });

            expect(reported).toHaveLength(0);
        });

        it('a_resolved_expression_reports_nothing', () => {
            const reported = capture();

            html`<div>{{name}}</div>`({ name: 'John' });

            expect(reported).toHaveLength(0);
        });

        it('an_update_with_a_missing_key_is_reported_too', () => {
            const reported = capture();

            const result = html`<div>{{name}}</div>`({ name: 'John' } as { name?: string });
            result.update({});

            expect(reported).toHaveLength(1);
            expect(reported[0].context.expression).toBe('name');
        });

        it('a_missing_substitution_is_reported_instead_of_being_dropped', () => {
            const reported = capture();

            html`<div>${undefined}</div>`({});

            expect(reported).toHaveLength(1);
        });
    });
});
