import { describe, it, expect, afterEach } from 'vitest';
import { compileTemplate, EngineConfig, FunctionsContext } from '../../src/html/template';
import { createPipeRegistry } from '../../src/pipes';

describe('m.ts template engine', () => {
    describe('text node interpolation', () => {
        it('should substitute simple variables', () => {
            const { content, render } = compileTemplate('Hello, {{name}}!');
            render({ name: 'John' });
            expect(content.textContent).toBe('Hello, John!');
        });

        it('should handle multiple variables in same text node', () => {
            const { content, render } = compileTemplate('{{greeting}}, {{name}}!');
            render({ greeting: 'Hello', name: 'World' });
            expect(content.textContent).toBe('Hello, World!');
        });

        it('should handle nested object properties', () => {
            const { content, render } = compileTemplate(
                'Welcome, {{user.name}}! Score: {{user.stats.score}}'
            );
            render({
                user: {
                    name: 'Alice',
                    stats: { score: 100 }
                }
            });
            expect(content.textContent).toBe('Welcome, Alice! Score: 100');
        });

        it('should return empty string for undefined properties in non-strict mode', () => {
            const { content, render } = compileTemplate('Value: {{missing.property}}');
            render({});
            expect(content.textContent).toBe('Value: ');
        });

        it('should preserve text without expressions', () => {
            const { content, render } = compileTemplate('No expressions here');
            render({});
            expect(content.textContent).toBe('No expressions here');
        });

        it('should handle consecutive expressions', () => {
            const { content, render } = compileTemplate('{{first}}{{second}}{{third}}');
            render({ first: 'A', second: 'B', third: 'C' });
            expect(content.textContent).toBe('ABC');
        });

        it('should preserve whitespace around expressions', () => {
            const { content, render } = compileTemplate('  {{name}}  ');
            render({ name: 'test' });
            expect(content.textContent).toBe('  test  ');
        });

        it('should convert objects to JSON strings', () => {
            const { content, render } = compileTemplate('{{data}}');
            render({ data: { key: 'value' } });
            expect(content.textContent).toBe('{"key":"value"}');
        });

        it('should convert numbers to strings', () => {
            const { content, render } = compileTemplate('{{count}}');
            render({ count: 42 });
            expect(content.textContent).toBe('42');
        });

        it('should convert booleans to strings', () => {
            const { content, render } = compileTemplate('{{active}}');
            render({ active: true });
            expect(content.textContent).toBe('true');
        });

        it('should handle null values as empty string', () => {
            const { content, render } = compileTemplate('{{value}}');
            render({ value: null });
            expect(content.textContent).toBe('');
        });
    });

    describe('attribute interpolation', () => {
        it('should interpolate attribute values', () => {
            const { content, render } = compileTemplate('<a href="{{url}}">Link</a>');
            render({ url: 'https://example.com' });
            expect(content.querySelector('a')?.getAttribute('href')).toBe('https://example.com');
        });

        it('should interpolate multiple attributes', () => {
            const { content, render } = compileTemplate('<img src="{{src}}" alt="{{alt}}">');
            render({ src: 'image.png', alt: 'My Image' });

            const img = content.querySelector('img');
            expect(img?.getAttribute('src')).toBe('image.png');
            expect(img?.getAttribute('alt')).toBe('My Image');
        });

        it('should handle nested property access in attributes', () => {
            const { content, render } = compileTemplate(
                '<a href="{{link.url}}">{{link.text}}</a>'
            );
            render({ link: { url: '/page', text: 'Click here' } });

            const a = content.querySelector('a');
            expect(a?.getAttribute('href')).toBe('/page');
            expect(a?.textContent).toBe('Click here');
        });

        it('should handle class attribute binding', () => {
            const { content, render } = compileTemplate('<span class="{{className}}">Text</span>');
            render({ className: 'active highlight' });
            expect(content.querySelector('span')?.getAttribute('class')).toBe('active highlight');
        });

        it('should handle data attributes', () => {
            const { content, render } = compileTemplate(
                '<div data-id="{{item.id}}" data-name="{{item.name}}"></div>'
            );
            render({ item: { id: '123', name: 'test' } });

            const el = content.querySelector('div');
            expect(el?.getAttribute('data-id')).toBe('123');
            expect(el?.getAttribute('data-name')).toBe('test');
        });
    });

    describe('if conditional', () => {
        it('should show element when condition is truthy', () => {
            const { content, render } = compileTemplate('<span if="show">Visible</span>');
            render({ show: true });
            expect(content.querySelector('span')).not.toBeNull();
        });

        it('should hide element when condition is falsy', () => {
            const { content, render } = compileTemplate('<span if="show">Hidden</span>');
            render({ show: false });
            expect(content.querySelector('span')).toBeNull();
        });

        it('should toggle visibility on re-render', () => {
            const { content, render } = compileTemplate('<span if="visible">Toggle</span>');

            render({ visible: true });
            expect(content.querySelector('span')).not.toBeNull();

            render({ visible: false });
            expect(content.querySelector('span')).toBeNull();

            render({ visible: true });
            expect(content.querySelector('span')).not.toBeNull();
        });

        it('should handle nested property conditions', () => {
            const { content, render } = compileTemplate(
                '<span if="user.isAdmin">Admin Panel</span>'
            );
            render({ user: { isAdmin: true } });
            expect(content.querySelector('span')?.textContent).toBe('Admin Panel');
        });

        it('should bind data inside conditional elements', () => {
            const { content, render } = compileTemplate('<span if="user">{{user.name}}</span>');
            render({ user: { name: 'John' } });
            expect(content.querySelector('span')?.textContent).toBe('John');
        });

        it('should treat empty string as falsy', () => {
            const { content, render } = compileTemplate('<span if="text">Has text</span>');
            render({ text: '' });
            expect(content.querySelector('span')).toBeNull();
        });

        it('should treat non-empty string as truthy', () => {
            const { content, render } = compileTemplate('<span if="text">Has text</span>');
            render({ text: 'hello' });
            expect(content.querySelector('span')).not.toBeNull();
        });

        it('should treat zero as falsy', () => {
            const { content, render } = compileTemplate('<span if="count">Has count</span>');
            render({ count: 0 });
            expect(content.querySelector('span')).toBeNull();
        });

        it('should treat positive numbers as truthy', () => {
            const { content, render } = compileTemplate('<span if="count">Has count</span>');
            render({ count: 1 });
            expect(content.querySelector('span')).not.toBeNull();
        });
    });

    describe('if conditional — multiple updates', () => {
        it('should survive many toggle cycles', () => {
            const { content, render } = compileTemplate('<span if="on">Hi</span>');

            for (let i = 0; i < 10; i++) {
                render({ on: true });
                expect(content.querySelector('span')).not.toBeNull();
                render({ on: false });
                expect(content.querySelector('span')).toBeNull();
            }

            render({ on: true });
            expect(content.querySelector('span')?.textContent).toBe('Hi');
        });

        it('should render latest data when toggled off then on', () => {
            const { content, render } = compileTemplate(
                '<span if="show">{{name}}</span>'
            );

            render({ show: true, name: 'Alice' });
            expect(content.querySelector('span')?.textContent).toBe('Alice');

            render({ show: false, name: 'Alice' });
            expect(content.querySelector('span')).toBeNull();

            render({ show: true, name: 'Bob' });
            expect(content.querySelector('span')?.textContent).toBe('Bob');
        });

        it('should never produce duplicate elements', () => {
            const { content, render } = compileTemplate(`
                <div>
                    <span if="show">Only one</span>
                </div>
            `);

            for (let i = 0; i < 5; i++) {
                render({ show: true });
                expect(content.querySelectorAll('span').length).toBe(1);
                render({ show: false });
                expect(content.querySelectorAll('span').length).toBe(0);
            }
        });

        it('should preserve sibling order across toggles', () => {
            const { content, render } = compileTemplate(`
                <div>
                    <span class="a">A</span>
                    <span class="b" if="show">B</span>
                    <span class="c">C</span>
                </div>
            `);

            render({ show: false });
            let spans = content.querySelectorAll('span');
            expect(spans.length).toBe(2);
            expect(spans[0].textContent).toBe('A');
            expect(spans[1].textContent).toBe('C');

            render({ show: true });
            spans = content.querySelectorAll('span');
            expect(spans.length).toBe(3);
            expect(spans[0].textContent).toBe('A');
            expect(spans[1].textContent).toBe('B');
            expect(spans[2].textContent).toBe('C');

            render({ show: false });
            spans = content.querySelectorAll('span');
            expect(spans.length).toBe(2);
            expect(spans[0].textContent).toBe('A');
            expect(spans[1].textContent).toBe('C');
        });

        it('should toggle multiple independent if-elements', () => {
            const { content, render } = compileTemplate(`
                <div>
                    <span if="a" class="a">A</span>
                    <span if="b" class="b">B</span>
                </div>
            `);

            render({ a: true, b: false });
            expect(content.querySelector('.a')).not.toBeNull();
            expect(content.querySelector('.b')).toBeNull();

            render({ a: false, b: true });
            expect(content.querySelector('.a')).toBeNull();
            expect(content.querySelector('.b')).not.toBeNull();

            render({ a: true, b: true });
            expect(content.querySelector('.a')).not.toBeNull();
            expect(content.querySelector('.b')).not.toBeNull();

            render({ a: false, b: false });
            expect(content.querySelector('.a')).toBeNull();
            expect(content.querySelector('.b')).toBeNull();
        });

        it('should handle nested if-elements across updates', () => {
            const { content, render } = compileTemplate(`
                <div if="outer">
                    <span if="inner">Nested</span>
                </div>
            `);

            render({ outer: true, inner: true });
            expect(content.querySelector('span')?.textContent).toBe('Nested');

            render({ outer: true, inner: false });
            expect(content.querySelector('div')).not.toBeNull();
            expect(content.querySelector('span')).toBeNull();

            render({ outer: false, inner: true });
            expect(content.querySelector('div')).toBeNull();
            expect(content.querySelector('span')).toBeNull();

            render({ outer: true, inner: true });
            expect(content.querySelector('span')?.textContent).toBe('Nested');
        });

        it('should re-render loop inside if after toggle', () => {
            const { content, render } = compileTemplate(`
                <div if="showList">
                    <ul><li loop="item in items">{{item}}</li></ul>
                </div>
            `);

            render({ showList: true, items: ['X', 'Y'] });
            expect(content.querySelectorAll('li').length).toBe(2);

            render({ showList: false, items: ['X', 'Y'] });
            expect(content.querySelectorAll('li').length).toBe(0);

            render({ showList: true, items: ['A', 'B', 'C'] });
            const lis = content.querySelectorAll('li');
            expect(lis.length).toBe(3);
            expect(lis[0].textContent).toBe('A');
            expect(lis[2].textContent).toBe('C');
        });

        it('should keep attribute bindings correct after re-show', () => {
            const { content, render } = compileTemplate(
                '<a if="show" href="{{url}}">Link</a>'
            );

            render({ show: true, url: '/first' });
            expect(content.querySelector('a')?.getAttribute('href')).toBe('/first');

            render({ show: false, url: '/first' });
            expect(content.querySelector('a')).toBeNull();

            render({ show: true, url: '/second' });
            expect(content.querySelector('a')?.getAttribute('href')).toBe('/second');
        });

        it('should handle truthy-value changes without toggling off', () => {
            const { content, render } = compileTemplate(
                '<span if="value">{{value}}</span>'
            );

            render({ value: 'first' });
            expect(content.querySelector('span')?.textContent).toBe('first');

            render({ value: 'second' });
            expect(content.querySelector('span')).not.toBeNull();
        });

        it('should not leave stale DOM when toggling off after many shows', () => {
            const { content, render } = compileTemplate(`
                <div>
                    <p if="visible">{{msg}}</p>
                </div>
            `);

            render({ visible: true, msg: 'one' });
            render({ visible: true, msg: 'two' });
            render({ visible: true, msg: 'three' });

            render({ visible: false, msg: 'three' });
            expect(content.querySelector('p')).toBeNull();
            expect(content.querySelectorAll('p').length).toBe(0);

            render({ visible: true, msg: 'four' });
            expect(content.querySelectorAll('p').length).toBe(1);
            expect(content.querySelector('p')?.textContent).toBe('four');
        });

        it('should handle rapid false→false and true→true transitions', () => {
            const { content, render } = compileTemplate('<span if="ok">Yes</span>');

            render({ ok: false });
            render({ ok: false });
            render({ ok: false });
            expect(content.querySelector('span')).toBeNull();

            render({ ok: true });
            render({ ok: true });
            render({ ok: true });
            expect(content.querySelectorAll('span').length).toBe(1);
        });
    });

    describe('unless conditional', () => {
        it('should show element when condition is falsy', () => {
            const { content, render } = compileTemplate(
                '<span unless="loading">Content Loaded</span>'
            );
            render({ loading: false });
            expect(content.querySelector('span')?.textContent).toBe('Content Loaded');
        });

        it('should hide element when condition is truthy', () => {
            const { content, render } = compileTemplate('<span unless="loading">Content</span>');
            render({ loading: true });
            expect(content.querySelector('span')).toBeNull();
        });

        it('should show element when property is undefined', () => {
            const { content, render } = compileTemplate('<span unless="error">No Errors</span>');
            render({});
            expect(content.querySelector('span')?.textContent).toBe('No Errors');
        });

        it('should toggle visibility on re-render', () => {
            const { content, render } = compileTemplate('<span unless="hidden">Visible</span>');

            render({ hidden: false });
            expect(content.querySelector('span')).not.toBeNull();

            render({ hidden: true });
            expect(content.querySelector('span')).toBeNull();
        });
    });

    describe('loop directive', () => {
        it('should render array items', () => {
            const { content, render } = compileTemplate(
                '<ul><li loop="item in items">{{item}}</li></ul>'
            );
            render({ items: ['Apple', 'Banana', 'Cherry'] });

            const lis = content.querySelectorAll('li');
            expect(lis.length).toBe(3);
            expect(lis[0].textContent).toBe('Apple');
            expect(lis[1].textContent).toBe('Banana');
            expect(lis[2].textContent).toBe('Cherry');
        });

        it('should render object properties from array items', () => {
            const { content, render } = compileTemplate(
                '<ul><li loop="user in users">{{user.name}} ({{user.age}})</li></ul>'
            );
            render({
                users: [
                    { name: 'Alice', age: 25 },
                    { name: 'Bob', age: 30 }
                ]
            });

            const lis = content.querySelectorAll('li');
            expect(lis.length).toBe(2);
            expect(lis[0].textContent).toBe('Alice (25)');
            expect(lis[1].textContent).toBe('Bob (30)');
        });

        it('should handle empty arrays', () => {
            const { content, render } = compileTemplate(
                '<ul><li loop="item in items">{{item}}</li></ul>'
            );
            render({ items: [] });

            const lis = content.querySelectorAll('li');
            expect(lis.length).toBe(0);
        });

        it('should update when array changes', () => {
            const { content, render } = compileTemplate(
                '<ul><li loop="item in items">{{item}}</li></ul>'
            );

            render({ items: ['A', 'B'] });
            expect(content.querySelectorAll('li').length).toBe(2);

            render({ items: ['A', 'B', 'C', 'D'] });
            expect(content.querySelectorAll('li').length).toBe(4);

            render({ items: ['X'] });
            expect(content.querySelectorAll('li').length).toBe(1);
            expect(content.querySelector('li')?.textContent).toBe('X');
        });

        it('should render attributes in loop items', () => {
            const { content, render } = compileTemplate(
                '<ul><li loop="item in items" data-id="{{item.id}}">{{item.name}}</li></ul>'
            );
            render({
                items: [
                    { id: '1', name: 'First' },
                    { id: '2', name: 'Second' }
                ]
            });

            const lis = content.querySelectorAll('li');
            expect(lis[0].getAttribute('data-id')).toBe('1');
            expect(lis[1].getAttribute('data-id')).toBe('2');
        });

        it('should produce exactly one element per iteration with correct attributes', () => {
            const { content, render } = compileTemplate(
                '<ul><li loop="item in items" title="{{item.title}}" data-id="{{item.id}}">{{item.name}}</li></ul>'
            );
            render({
                items: [
                    { id: '1', title: 'First Title', name: 'First' },
                    { id: '2', title: 'Second Title', name: 'Second' },
                    { id: '3', title: 'Third Title', name: 'Third' }
                ]
            });

            const ul = content.querySelector('ul')!;
            const lis = ul.querySelectorAll('li');
            expect(lis.length).toBe(3);

            for (let i = 0; i < lis.length; i++) {
                const li = lis[i];
                const item = [
                    { id: '1', title: 'First Title', name: 'First' },
                    { id: '2', title: 'Second Title', name: 'Second' },
                    { id: '3', title: 'Third Title', name: 'Third' }
                ][i];

                expect(li.getAttribute('data-id')).toBe(item.id);
                expect(li.getAttribute('title')).toBe(item.title);
                expect(li.textContent).toBe(item.name);
                expect(li.childNodes.length).toBe(1);
                expect(li.parentNode).toBe(ul);
            }
        });

        it('should handle loop with nested object access', () => {
            const { content, render } = compileTemplate(
                '<ul><li loop="p in data.products">{{p.name}}</li></ul>'
            );
            render({
                data: {
                    products: [{ name: 'Product A' }, { name: 'Product B' }]
                }
            });

            const lis = content.querySelectorAll('li');
            expect(lis.length).toBe(2);
            expect(lis[0].textContent).toBe('Product A');
        });

        it('should update all item contents on same-length re-render', () => {
            const { content, render } = compileTemplate(
                '<ul><li loop="item in items">{{item}}</li></ul>'
            );

            render({ items: ['A', 'B', 'C'] });
            let lis = content.querySelectorAll('li');
            expect(lis[0].textContent).toBe('A');
            expect(lis[1].textContent).toBe('B');
            expect(lis[2].textContent).toBe('C');

            render({ items: ['X', 'Y', 'Z'] });
            lis = content.querySelectorAll('li');
            expect(lis.length).toBe(3);
            expect(lis[0].textContent).toBe('X');
            expect(lis[1].textContent).toBe('Y');
            expect(lis[2].textContent).toBe('Z');
        });

        it('should update item attributes on same-length re-render', () => {
            const { content, render } = compileTemplate(
                '<ul><li loop="item in items" data-id="{{item.id}}">{{item.name}}</li></ul>'
            );

            render({ items: [{ id: '1', name: 'First' }, { id: '2', name: 'Second' }] });
            let lis = content.querySelectorAll('li');
            expect(lis[0].getAttribute('data-id')).toBe('1');
            expect(lis[0].textContent).toBe('First');

            render({ items: [{ id: '3', name: 'Third' }, { id: '4', name: 'Fourth' }] });
            lis = content.querySelectorAll('li');
            expect(lis.length).toBe(2);
            expect(lis[0].getAttribute('data-id')).toBe('3');
            expect(lis[0].textContent).toBe('Third');
            expect(lis[1].getAttribute('data-id')).toBe('4');
            expect(lis[1].textContent).toBe('Fourth');
        });

        it('should handle shrink then grow correctly', () => {
            const { content, render } = compileTemplate(
                '<ul><li loop="item in items">{{item}}</li></ul>'
            );

            render({ items: ['A', 'B', 'C'] });
            expect(content.querySelectorAll('li').length).toBe(3);

            render({ items: ['X'] });
            let lis = content.querySelectorAll('li');
            expect(lis.length).toBe(1);
            expect(lis[0].textContent).toBe('X');

            render({ items: ['P', 'Q', 'R', 'S'] });
            lis = content.querySelectorAll('li');
            expect(lis.length).toBe(4);
            expect(lis[0].textContent).toBe('P');
            expect(lis[1].textContent).toBe('Q');
            expect(lis[2].textContent).toBe('R');
            expect(lis[3].textContent).toBe('S');
        });

        it('should handle empty then repopulate correctly', () => {
            const { content, render } = compileTemplate(
                '<ul><li loop="item in items">{{item}}</li></ul>'
            );

            render({ items: ['A', 'B'] });
            expect(content.querySelectorAll('li').length).toBe(2);

            render({ items: [] });
            expect(content.querySelectorAll('li').length).toBe(0);

            render({ items: ['X', 'Y', 'Z'] });
            const lis = content.querySelectorAll('li');
            expect(lis.length).toBe(3);
            expect(lis[0].textContent).toBe('X');
            expect(lis[1].textContent).toBe('Y');
            expect(lis[2].textContent).toBe('Z');
        });

        it('should maintain correct DOM order after multiple re-renders', () => {
            const { content, render } = compileTemplate(`
                <div>
                    <span>Before</span>
                    <p loop="item in items">{{item}}</p>
                    <span>After</span>
                </div>
            `);

            render({ items: ['A', 'B'] });
            render({ items: ['X', 'Y', 'Z'] });
            render({ items: ['1'] });

            const div = content.querySelector('div')!;
            const spans = div.querySelectorAll('span');
            const ps = div.querySelectorAll('p');

            expect(spans.length).toBe(2);
            expect(ps.length).toBe(1);

            const visible = Array.from(div.children).filter(
                el => el.tagName === 'SPAN' || el.tagName === 'P'
            );
            expect(visible[0].textContent).toBe('Before');
            expect(visible[1].textContent).toBe('1');
            expect(visible[2].textContent).toBe('After');
        });
    });

    describe('combined directives', () => {
        it('should handle if inside loop', () => {
            const { content, render } = compileTemplate(`
                <ul>
                    <li loop="item in items">
                        <span if="item.active">{{item.name}} (active)</span>
                    </li>
                </ul>
            `);
            render({
                items: [
                    { name: 'A', active: true },
                    { name: 'B', active: false },
                    { name: 'C', active: true }
                ]
            });

            const spans = content.querySelectorAll('span');
            expect(spans.length).toBe(2);
        });

        it('should handle loop inside if', () => {
            const { content, render } = compileTemplate(`
                <div if="showList">
                    <ul><li loop="item in items">{{item}}</li></ul>
                </div>
            `);

            render({ showList: true, items: ['A', 'B', 'C'] });
            expect(content.querySelectorAll('li').length).toBe(3);

            render({ showList: false, items: ['A', 'B', 'C'] });
            expect(content.querySelectorAll('li').length).toBe(0);
        });

        it('should handle complex nested structure', () => {
            const { content, render } = compileTemplate(`
                <div class="container">
                    <h1>{{title}}</h1>
                    <div if="hasUsers">
                        <ul>
                            <li loop="user in users">
                                <span>{{user.name}}</span>
                                <span if="user.isAdmin" class="badge">Admin</span>
                            </li>
                        </ul>
                    </div>
                    <p unless="hasUsers">No users found</p>
                </div>
            `);
            render({
                title: 'User List',
                hasUsers: true,
                users: [
                    { name: 'Alice', isAdmin: true },
                    { name: 'Bob', isAdmin: false },
                    { name: 'Charlie', isAdmin: true }
                ]
            });

            expect(content.querySelector('h1')?.textContent).toBe('User List');
            expect(content.querySelectorAll('li').length).toBe(3);
            expect(content.querySelectorAll('.badge').length).toBe(2);
            expect(content.querySelector('p')).toBeNull();
        });
    });

    describe('error handling', () => {
        it('should call onError callback when path resolution fails in strict mode', () => {
            const errors: string[] = [];
            const config: EngineConfig = {
                strict: true,
                onError: (msg) => errors.push(msg)
            };

            const { render } = compileTemplate('{{missing.property}}', config);

            expect(() => render({})).toThrow();
            expect(errors.length).toBeGreaterThan(0);
        });

        it('should not throw in non-strict mode for missing properties', () => {
            const { content, render } = compileTemplate('{{missing.deeply.nested.property}}');

            expect(() => render({})).not.toThrow();
            expect(content.textContent).toBe('');
        });

        it('should handle invalid loop syntax gracefully', () => {
            const errors: string[] = [];
            const config: EngineConfig = {
                strict: false,
                onError: (msg) => errors.push(msg)
            };

            const { render } = compileTemplate(
                '<li loop="invalid syntax here">{{item}}</li>',
                config
            );
            render({ items: [] });

            expect(errors.length).toBeGreaterThan(0);
        });

        it('should handle non-array loop source', () => {
            const errors: string[] = [];
            const config: EngineConfig = {
                strict: false,
                onError: (msg) => errors.push(msg)
            };

            const { render } = compileTemplate(
                '<ul><li loop="item in notAnArray">{{item}}</li></ul>',
                config
            );
            render({ notAnArray: 'string value' });

            expect(errors.length).toBeGreaterThan(0);
        });
    });

    describe('compileTemplate API', () => {
        it('should return content and render function', () => {
            const result = compileTemplate('<div>{{name}}</div>');

            expect(result.content).toBeInstanceOf(HTMLElement);
            expect(result.render).toBeTypeOf('function');
        });

        it('should accept custom config', () => {
            const errors: string[] = [];
            const config: EngineConfig = {
                strict: true,
                onError: (msg) => errors.push(msg)
            };

            const { render } = compileTemplate('{{missing}}', config);
            expect(() => render({})).toThrow();
        });
    });

    describe('re-rendering and memoization', () => {
        it('should not re-render when same context object is passed', () => {
            const { content, render } = compileTemplate('{{counter}}');
            const ctx = { counter: 1 };

            render(ctx);
            expect(content.textContent).toBe('1');

            ctx.counter = 2;
            render(ctx);
            expect(content.textContent).toBe('1');
        });

        it('should re-render when different context object is passed', () => {
            const { content, render } = compileTemplate('{{counter}}');

            render({ counter: 1 });
            expect(content.textContent).toBe('1');

            render({ counter: 2 });
            expect(content.textContent).toBe('2');
        });
    });

    describe('edge cases', () => {
        it('should handle empty template', () => {
            const { content, render } = compileTemplate('');
            render({});
            expect(content.textContent).toBe('');
        });

        it('should handle deeply nested DOM structure', () => {
            const { content, render } = compileTemplate(`
                <div>
                    <div>
                        <div>
                            <span>{{deeply.nested.value}}</span>
                        </div>
                    </div>
                </div>
            `);
            render({ deeply: { nested: { value: 'Found!' } } });
            expect(content.querySelector('span')?.textContent).toBe('Found!');
        });

        it('should handle special characters in values (XSS prevention)', () => {
            const { content, render } = compileTemplate('{{content}}');
            render({ content: '<script>alert("xss")</script>' });

            expect(content.textContent).toBe('<script>alert("xss")</script>');
            expect(content.querySelector('script')).toBeNull();
        });

        it('should handle Unicode content', () => {
            const { content, render } = compileTemplate('{{message}}');
            render({ message: '你好世界 🌍 مرحبا' });
            expect(content.textContent).toBe('你好世界 🌍 مرحبا');
        });

        it('should handle numeric property names', () => {
            const { content, render } = compileTemplate('{{data.0}} {{data.1}}');
            render({ data: { '0': 'first', '1': 'second' } });
            expect(content.textContent).toBe('first second');
        });

        it('should handle properties with underscores', () => {
            const { content, render } = compileTemplate('{{user_name}} {{_private}}');
            render({ user_name: 'John', _private: 'secret' });
            expect(content.textContent).toBe('John secret');
        });

        it('should handle whitespace-only templates', () => {
            const { content, render } = compileTemplate('   \n\t   ');
            render({});
            expect(content.textContent?.trim()).toBe('');
        });

        it('should handle expressions with extra whitespace', () => {
            const { content, render } = compileTemplate('{{  name  }}');
            render({ name: 'John' });
            expect(content.textContent).toBe('John');
        });

        it('should handle multiple elements', () => {
            const { content, render } = compileTemplate(`
                <div>{{a}}</div>
                <span>{{b}}</span>
                <p>{{c}}</p>
            `);
            render({ a: 'first', b: 'second', c: 'third' });

            expect(content.querySelector('div')?.textContent).toBe('first');
            expect(content.querySelector('span')?.textContent).toBe('second');
            expect(content.querySelector('p')?.textContent).toBe('third');
        });
    });

    describe('type coercion', () => {
        it('should handle zero correctly', () => {
            const { content, render } = compileTemplate('Value: {{num}}');
            render({ num: 0 });
            expect(content.textContent).toBe('Value: 0');
        });

        it('should handle false correctly', () => {
            const { content, render } = compileTemplate('Value: {{flag}}');
            render({ flag: false });
            expect(content.textContent).toBe('Value: false');
        });

        it('should handle empty string correctly', () => {
            const { content, render } = compileTemplate('Value: [{{str}}]');
            render({ str: '' });
            expect(content.textContent).toBe('Value: []');
        });

        it('should handle arrays by JSON stringifying', () => {
            const { content, render } = compileTemplate('{{arr}}');
            render({ arr: [1, 2, 3] });
            expect(content.textContent).toBe('[1,2,3]');
        });
    });

    describe('path resolution', () => {
        it('should handle deeply nested paths', () => {
            const { content, render } = compileTemplate('{{a.b.c.d.e}}');
            render({ a: { b: { c: { d: { e: 'deep' } } } } });
            expect(content.textContent).toBe('deep');
        });

        it('should handle missing intermediate paths gracefully', () => {
            const { content, render } = compileTemplate('{{a.b.c}}');
            render({ a: {} });
            expect(content.textContent).toBe('');
        });

        it('should handle null in path chain', () => {
            const { content, render } = compileTemplate('{{a.b.c}}');
            render({ a: { b: null } });
            expect(content.textContent).toBe('');
        });
    });

    describe('sibling preservation', () => {
        it('should preserve siblings when conditional is hidden', () => {
            const { content, render } = compileTemplate(`
                <span>Before</span>
                <span if="show">Conditional</span>
                <span>After</span>
            `);

            render({ show: false });

            const spans = content.querySelectorAll('span');
            expect(spans.length).toBe(2);
            expect(spans[0].textContent).toBe('Before');
            expect(spans[1].textContent).toBe('After');
        });

        it('should preserve siblings when loop is empty', () => {
            const { content, render } = compileTemplate(`
                <div>
                    <span>Header</span>
                    <p loop="item in items">{{item}}</p>
                    <span>Footer</span>
                </div>
            `);

            render({ items: [] });

            expect(content.querySelectorAll('p').length).toBe(0);
            expect(content.querySelectorAll('span').length).toBe(2);
        });
    });

    describe('pipes', () => {
        it('should apply uppercase pipe', () => {
            const pipeRegistry = createPipeRegistry();
            const { content, render } = compileTemplate('{{name | uppercase}}', { strict: false, pipeRegistry });
            render({ name: 'john' });
            expect(content.textContent).toBe('JOHN');
        });

        it('should apply lowercase pipe', () => {
            const pipeRegistry = createPipeRegistry();
            const { content, render } = compileTemplate('{{name | lowercase}}', { strict: false, pipeRegistry });
            render({ name: 'JOHN' });
            expect(content.textContent).toBe('john');
        });

        it('should apply shorten pipe with argument', () => {
            const pipeRegistry = createPipeRegistry();
            const { content, render } = compileTemplate('{{text | shorten:10}}', { strict: false, pipeRegistry });
            render({ text: 'Hello World This Is Long' });
            expect(content.textContent).toBe('Hello W...');
        });

        it('should chain multiple pipes', () => {
            const pipeRegistry = createPipeRegistry();
            const { content, render } = compileTemplate('{{text | trim | uppercase}}', { strict: false, pipeRegistry });
            render({ text: '  hello  ' });
            expect(content.textContent).toBe('HELLO');
        });

        it('should apply capitalize pipe', () => {
            const pipeRegistry = createPipeRegistry();
            const { content, render } = compileTemplate('{{name | capitalize}}', { strict: false, pipeRegistry });
            render({ name: 'john' });
            expect(content.textContent).toBe('John');
        });

        it('should apply default pipe for falsy values', () => {
            const pipeRegistry = createPipeRegistry();
            const { content, render } = compileTemplate('{{value | default:N/A}}', { strict: false, pipeRegistry });
            render({ value: '' });
            expect(content.textContent).toBe('N/A');
        });

        it('should work with nested property and pipes', () => {
            const pipeRegistry = createPipeRegistry();
            const { content, render } = compileTemplate('{{user.name | uppercase}}', { strict: false, pipeRegistry });
            render({ user: { name: 'john' } });
            expect(content.textContent).toBe('JOHN');
        });

        it('should apply pipes in attributes', () => {
            const pipeRegistry = createPipeRegistry();
            const { content, render } = compileTemplate('<div class="{{cls | uppercase}}"></div>', { strict: false, pipeRegistry });
            render({ cls: 'primary' });
            expect((content.querySelector('div') as HTMLElement).className).toBe('PRIMARY');
        });
    });

    describe('function calls', () => {
        it('should call function without arguments', () => {
            const { content, render } = compileTemplate('Today: {{getDate()}}');
            const fns = {
                getDate: () => '2024-01-15'
            };
            render({}, fns);
            expect(content.textContent).toBe('Today: 2024-01-15');
        });

        it('should call function with string arguments', () => {
            const { content, render } = compileTemplate('{{greet("World")}}');
            const fns = {
                greet: (name: string) => `Hello, ${name}!`
            };
            render({}, fns);
            expect(content.textContent).toBe('Hello, World!');
        });

        it('should call function with number arguments', () => {
            const { content, render } = compileTemplate('Sum: {{add(5, 3)}}');
            const fns = {
                add: (a: number, b: number) => a + b
            };
            render({}, fns);
            expect(content.textContent).toBe('Sum: 8');
        });

        it('should call function with context variable arguments', () => {
            const { content, render } = compileTemplate('{{format(user.name)}}');
            const fns = {
                format: (name: string) => `Mr. ${name}`
            };
            render({ user: { name: 'Smith' } }, fns);
            expect(content.textContent).toBe('Mr. Smith');
        });

        it('should call function with mixed arguments', () => {
            const { content, render } = compileTemplate('{{greet(name, "!")}}');
            const fns = {
                greet: (name: string, suffix: string) => `Hello, ${name}${suffix}`
            };
            render({ name: 'John' }, fns);
            expect(content.textContent).toBe('Hello, John!');
        });

        it('should apply pipes to function result', () => {
            const pipeRegistry = createPipeRegistry();
            const { content, render } = compileTemplate('{{getName() | uppercase}}', { strict: false, pipeRegistry });
            const fns = {
                getName: () => 'john'
            };
            render({}, fns);
            expect(content.textContent).toBe('JOHN');
        });

        it('should handle function returning number', () => {
            const { content, render } = compileTemplate('Total: {{calculate()}}');
            const fns = {
                calculate: () => 42
            };
            render({}, fns);
            expect(content.textContent).toBe('Total: 42');
        });

        it('should handle missing function gracefully in non-strict mode', () => {
            const { content, render } = compileTemplate('Result: {{missing()}}');
            render({}, {});
            expect(content.textContent).toBe('Result: ');
        });

        it('should use functions in loops', () => {
            const { content, render } = compileTemplate(`
                <ul>
                    <li loop="item in items">{{formatItem(item)}}</li>
                </ul>
            `);
            const fns = {
                formatItem: (item: string) => `- ${item}`
            };
            render({ items: ['a', 'b', 'c'] }, fns);
            const items = content.querySelectorAll('li');
            expect(items.length).toBe(3);
            expect(items[0].textContent).toBe('- a');
        });

        it('should use functions in conditionals', () => {
            const { content, render } = compileTemplate(`
                <span if="show">{{getMessage()}}</span>
            `);
            const fns = {
                getMessage: () => 'Visible!'
            };
            render({ show: true }, fns);
            expect(content.querySelector('span')?.textContent).toBe('Visible!');
        });
    });

    describe('array indexing', () => {
        it('should access array element by index', () => {
            const { content, render } = compileTemplate('First: {{items[0]}}');
            render({ items: ['apple', 'banana', 'cherry'] });
            expect(content.textContent).toBe('First: apple');
        });

        it('should access nested array element', () => {
            const { content, render } = compileTemplate('{{users[1].name}}');
            render({
                users: [
                    { name: 'Alice' },
                    { name: 'Bob' },
                    { name: 'Charlie' }
                ]
            });
            expect(content.textContent).toBe('Bob');
        });

        it('should access deeply nested array path', () => {
            const { content, render } = compileTemplate('{{data.rows[0].cells[1].value}}');
            render({
                data: {
                    rows: [
                        { cells: [{ value: 'A1' }, { value: 'B1' }] },
                        { cells: [{ value: 'A2' }, { value: 'B2' }] }
                    ]
                }
            });
            expect(content.textContent).toBe('B1');
        });

        it('should handle array index in attributes', () => {
            const { content, render } = compileTemplate('<a href="{{links[0]}}">Link</a>');
            render({ links: ['https://example.com', 'https://test.com'] });
            expect((content.querySelector('a') as HTMLAnchorElement).href).toBe('https://example.com/');
        });

        it('should handle array index with pipes', () => {
            const pipeRegistry = createPipeRegistry();
            const { content, render } = compileTemplate('{{names[0] | uppercase}}', { strict: false, pipeRegistry });
            render({ names: ['alice', 'bob'] });
            expect(content.textContent).toBe('ALICE');
        });

        it('should handle out of bounds index gracefully', () => {
            const { content, render } = compileTemplate('Value: {{items[99]}}');
            render({ items: ['only one'] });
            expect(content.textContent).toBe('Value: ');
        });

        it('should work with loop source using array index', () => {
            const { content, render } = compileTemplate(`
                <ul>
                    <li loop="item in data.lists[0]">{{item}}</li>
                </ul>
            `);
            render({
                data: {
                    lists: [
                        ['a', 'b', 'c'],
                        ['x', 'y', 'z']
                    ]
                }
            });
            const items = content.querySelectorAll('li');
            expect(items.length).toBe(3);
            expect(items[0].textContent).toBe('a');
        });
    });

    describe('combined features', () => {
        it('should combine array indexing, functions and pipes', () => {
            const pipeRegistry = createPipeRegistry();
            const { content, render } = compileTemplate(
                '{{formatUser(users[0].name) | uppercase}}',
                { strict: false, pipeRegistry }
            );
            const fns = {
                formatUser: (name: string) => `user: ${name}`
            };
            render({ users: [{ name: 'john' }] }, fns);
            expect(content.textContent).toBe('USER: JOHN');
        });

        it('should handle complex template with all features', () => {
            const pipeRegistry = createPipeRegistry();
            const { content, render } = compileTemplate(`
                <div>
                    <h1>{{title | uppercase}}</h1>
                    <p if="showIntro">{{getIntro()}}</p>
                    <ul>
                        <li loop="item in items[0].list">{{item.name | capitalize}}: {{formatPrice(item.price)}}</li>
                    </ul>
                </div>
            `, { strict: false, pipeRegistry });

            const fns = {
                getIntro: () => 'Welcome!',
                formatPrice: (p: number) => `$${p.toFixed(2)}`
            };

            render({
                title: 'products',
                showIntro: true,
                items: [{
                    list: [
                        { name: 'apple', price: 1.5 },
                        { name: 'banana', price: 0.75 }
                    ]
                }]
            }, fns);

            expect(content.querySelector('h1')?.textContent).toBe('PRODUCTS');
            expect(content.querySelector('p')?.textContent).toBe('Welcome!');
            const listItems = content.querySelectorAll('li');
            expect(listItems.length).toBe(2);
            expect(listItems[0].textContent).toBe('Apple: $1.50');
            expect(listItems[1].textContent).toBe('Banana: $0.75');
        });
    });

    /**
     * Reproduces the bug where custom elements with inner templates get
     * duplicate DOM when used inside a loop with mustache attributes.
     *
     * jsdom does not auto-upgrade custom elements during insertBefore like
     * a real browser, so we simulate the browser upgrade sequence manually.
     */
    describe('custom element inside loop', () => {
        const INNER_TEMPLATE = `
            <div>
                <h4>{{text}}</h4>
                <div class="cluster">
                    <span class="badge" loop="tag in tags">{{tag}}</span>
                </div>
            </div>
            <button class="btn-remove">×</button>
        `;

        class TestLoopCard extends HTMLElement {
            static observedAttributes = ['title'];
            private innerTemplate = compileTemplate(INNER_TEMPLATE);
            private text = '';
            private rendered = false;

            constructor() {
                super();
                this.text = this.innerHTML;
            }

            connectedCallback(): void {
                if (this.rendered) return;
                this.rendered = true;
                this.appendChild(this.innerTemplate.content);
                this.updateView();
            }

            attributeChangedCallback(): void {
                if (this.isConnected) {
                    this.updateView();
                }
            }

            private updateView(): void {
                if (this.text === '') {
                    this.text = this.getAttribute('title') || '';
                }
                this.innerTemplate.render({
                    text: this.text,
                    tags: [],
                });
            }
        }

        customElements.define('test-loop-card', TestLoopCard);

        afterEach(() => {
            document.body.innerHTML = '';
        });

        it('insert-before-compile: upgrade sees raw mustache, producing broken DOM', () => {
            // Simulates the BUGGY sequence:
            // 1. Insert element with raw "{{...}}" attributes into live DOM
            // 2. Browser upgrades → connectedCallback sees mustache as title
            // 3. Then attributes are resolved to real values
            const container = document.createElement('div');
            document.body.appendChild(container);

            const card = document.createElement('test-loop-card') as TestLoopCard;
            // Set raw mustache attributes — as if inserted before compile
            card.setAttribute('title', '{{item.title}}');
            card.setAttribute('data-id', '{{item.id}}');
            container.appendChild(card);

            // connectedCallback has fired; title was "{{item.title}}"
            // so the inner <h4> contains the raw mustache string
            const h4 = card.querySelector('h4');
            expect(h4?.textContent).toBe('{{item.title}}');
        });

        it('compile-before-insert: upgrade sees final values, producing correct DOM', () => {
            const { content, render } = compileTemplate(`
                <div class="list">
                    <test-loop-card loop="item in items" title="{{item.title}}" data-id="{{item.id}}"></test-loop-card>
                </div>
            `);

            // With the fix, render resolves attributes while detached.
            render({
                items: [
                    { id: '1', title: 'First' },
                    { id: '2', title: 'Second' },
                ]
            });

            // Append to live DOM — elements upgrade with final attribute values
            document.body.appendChild(content);

            // jsdom may not auto-upgrade; force it
            document.querySelectorAll('test-loop-card').forEach(el => {
                customElements.upgrade(el);
            });

            const cards = document.querySelectorAll('test-loop-card');
            expect(cards.length).toBe(2);

            for (let i = 0; i < cards.length; i++) {
                const card = cards[i];
                const title = ['First', 'Second'][i];

                // Exactly one wrapper div from the inner template
                const wrapperDivs = card.querySelectorAll(':scope > div');
                expect(wrapperDivs.length).toBe(1);

                // The inner <h4> contains the resolved title, not mustache
                const h4 = card.querySelector('h4');
                expect(h4?.textContent).toBe(title);
                expect(h4?.textContent).not.toContain('{{');
                expect(h4?.textContent).not.toContain('<');

                // Attributes on the card are resolved
                expect(card.getAttribute('title')).toBe(title);
                expect(card.getAttribute('data-id')).toBe(String(i + 1));
            }
        });

        it('re-render with content already in live DOM should not duplicate inner template', () => {
            const { content, render } = compileTemplate(`
                <div class="list">
                    <test-loop-card loop="item in items" title="{{item.title}}" data-id="{{item.id}}"></test-loop-card>
                </div>
            `);

            // Simulate real component: insert content into live DOM FIRST
            document.body.appendChild(content);

            // Then render — loop inserts cards into already-connected parent
            render({
                items: [
                    { id: '1', title: 'First' },
                ]
            });

            // Upgrade cards (in real browser this happens during insertBefore)
            document.querySelectorAll('test-loop-card').forEach(el => {
                customElements.upgrade(el);
            });

            let cards = document.querySelectorAll('test-loop-card');
            expect(cards.length).toBe(1);

            // Exactly one wrapper div from the inner template
            let wrapperDivs = cards[0].querySelectorAll(':scope > div');
            expect(wrapperDivs.length).toBe(1);
            expect(cards[0].querySelector('h4')?.textContent).toBe('First');

            // Re-render with new data — simulates parent calling updateView() again
            render({
                items: [
                    { id: '1', title: 'First' },
                    { id: '2', title: 'Added' },
                ]
            });

            // Upgrade newly created cards
            document.querySelectorAll('test-loop-card').forEach(el => {
                customElements.upgrade(el);
            });

            cards = document.querySelectorAll('test-loop-card');
            expect(cards.length).toBe(2);

            for (let i = 0; i < cards.length; i++) {
                const card = cards[i];
                const title = ['First', 'Added'][i];

                // Must have exactly one wrapper div — no duplication
                wrapperDivs = card.querySelectorAll(':scope > div');
                expect(wrapperDivs.length).toBe(1);

                const h4 = card.querySelector('h4');
                expect(h4?.textContent).toBe(title);
                expect(h4?.textContent).not.toContain('<');
            }
        });

        it('auto-upgrade during loop insert should not duplicate inner template', () => {
            // Simulates real browser behavior: insertBefore on a connected
            // parent synchronously upgrades the inserted custom element.
            const origInsertBefore = Node.prototype.insertBefore;
            Node.prototype.insertBefore = function <T extends Node>(newNode: T, refNode: Node | null): T {
                const result = origInsertBefore.call(this, newNode, refNode) as T;
                if (newNode instanceof HTMLElement && (this as Node).isConnected) {
                    if (newNode.tagName?.includes('-')) {
                        customElements.upgrade(newNode);
                    }
                    newNode.querySelectorAll?.('*').forEach(el => {
                        if (el.tagName?.includes('-')) customElements.upgrade(el);
                    });
                }
                return result;
            };

            try {
                const { content, render } = compileTemplate(`
                    <div class="list">
                        <test-loop-card loop="item in items" title="{{item.title}}" data-id="{{item.id}}"></test-loop-card>
                    </div>
                `);

                // Insert into live DOM first — then render triggers loop inserts
                // into the connected parent, triggering synchronous upgrades
                document.body.appendChild(content);

                render({
                    items: [
                        { id: '1', title: 'First' },
                        { id: '2', title: 'Second' },
                    ]
                });

                const cards = document.querySelectorAll('test-loop-card');
                expect(cards.length).toBe(2);

                for (let i = 0; i < cards.length; i++) {
                    const card = cards[i];
                    const title = ['First', 'Second'][i];

                    const wrapperDivs = card.querySelectorAll(':scope > div');
                    expect(wrapperDivs.length).toBe(1);

                    const h4 = card.querySelector('h4');
                    expect(h4?.textContent).toBe(title);
                    expect(h4?.textContent).not.toContain('<');
                }
            } finally {
                Node.prototype.insertBefore = origInsertBefore;
            }
        });

        it('if-wrapped loop: re-render should not duplicate inner template', () => {
            // Matches the real profile structure: section with if wrapping
            // a div with a loop of custom elements
            const origInsertBefore = Node.prototype.insertBefore;
            Node.prototype.insertBefore = function <T extends Node>(newNode: T, refNode: Node | null): T {
                const result = origInsertBefore.call(this, newNode, refNode) as T;
                if (newNode instanceof HTMLElement && (this as Node).isConnected) {
                    if (newNode.tagName?.includes('-')) {
                        customElements.upgrade(newNode);
                    }
                    newNode.querySelectorAll?.('*').forEach(el => {
                        if (el.tagName?.includes('-')) customElements.upgrade(el);
                    });
                }
                return result;
            };

            try {
                const { content, render } = compileTemplate(`
                    <section if="showSection" class="activities">
                        <div class="list">
                            <test-loop-card loop="item in items" title="{{item.title}}" data-id="{{item.id}}"></test-loop-card>
                        </div>
                    </section>
                `);

                document.body.appendChild(content);

                // First render — if condition creates section, loop creates cards
                render({
                    showSection: true,
                    items: [
                        { id: '1', title: 'First' },
                    ]
                });

                let cards = document.querySelectorAll('test-loop-card');
                expect(cards.length).toBe(1);
                expect(cards[0].querySelectorAll(':scope > div').length).toBe(1);
                expect(cards[0].querySelector('h4')?.textContent).toBe('First');

                // Re-render — simulates parent.updateView() after adding an activity
                render({
                    showSection: true,
                    items: [
                        { id: '1', title: 'First' },
                        { id: '2', title: 'Second' },
                    ]
                });

                cards = document.querySelectorAll('test-loop-card');
                expect(cards.length).toBe(2);

                for (let i = 0; i < cards.length; i++) {
                    const card = cards[i];
                    const title = ['First', 'Second'][i];

                    const wrapperDivs = card.querySelectorAll(':scope > div');
                    expect(wrapperDivs.length).toBe(1);

                    const h4 = card.querySelector('h4');
                    expect(h4?.textContent).toBe(title);
                    expect(h4?.textContent).not.toContain('<');
                }
            } finally {
                Node.prototype.insertBefore = origInsertBefore;
            }
        });
    });
});
