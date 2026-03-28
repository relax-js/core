import { describe, it, expect } from 'vitest';
import { Template } from '../../src/html/TreeBinder';

describe('Template', () => {
    it('should_render_text_bindings', () => {
        const template = new Template('<p>Hello {{ name }}</p>');
        const result = template.render({ name: 'World' });
        expect(result.querySelector('p')!.textContent).toBe('Hello World');
    });

    it('should_render_nested_property_bindings', () => {
        const template = new Template('<span>{{ user.name }}</span>');
        const result = template.render({ user: { name: 'Alice' } });
        expect(result.querySelector('span')!.textContent).toBe('Alice');
    });

    it('should_render_attribute_bindings', () => {
        const template = new Template('<a href="{{ url }}">link</a>');
        const result = template.render({ url: '/home' });
        expect(result.querySelector('a')!.getAttribute('href')).toBe('/home');
    });

    it('should_render_multiple_bindings_in_same_text', () => {
        const template = new Template('<p>{{ first }} {{ last }}</p>');
        const result = template.render({ first: 'John', last: 'Doe' });
        expect(result.querySelector('p')!.textContent).toBe('John Doe');
    });

    it('should_leave_static_content_untouched', () => {
        const template = new Template('<p>Static text</p>');
        const result = template.render({});
        expect(result.querySelector('p')!.textContent).toBe('Static text');
    });

    it('should_produce_independent_clones_on_each_render', () => {
        const template = new Template('<span>{{ val }}</span>');
        const r1 = template.render({ val: 'A' });
        const r2 = template.render({ val: 'B' });
        expect(r1.querySelector('span')!.textContent).toBe('A');
        expect(r2.querySelector('span')!.textContent).toBe('B');
    });
});
