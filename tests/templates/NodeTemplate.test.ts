import { describe, it, expect, vi } from 'vitest';
import { Blueprint } from '../../src/templates/NodeTemplate';

describe('Blueprint', () => {
  it('renders simple text binding', () => {
    const template = new Blueprint('<div>Hello {{ name }}</div>');
    const instance = template.createInstance();

    const root = instance.render({ name: 'Oscar' });

    expect(root.textContent).toBe('Hello Oscar');
  });

  it('renders attribute binding', () => {
    const template = new Blueprint('<p title="{{ user.email }}">Email</p>');
    const instance = template.createInstance();
    const root = instance.render({ user: { email: 'test@example.com' } });

    expect(root.getAttribute('title')).toBe('test@example.com');
  });

  it('binds click events to component methods', () => {
    const template = new Blueprint('<button click="sayHi">Click me</button>');
    const spy = vi.fn();

    const component = {
      sayHi: spy
    };

    const instance = template.createInstance(component);
    const root = instance.render({});
    root.click();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('binds multiple dynamic parts', () => {
    const html = `<div><span>{{ a }}</span><b title="{{ b }}">{{ b }}</b></div>`;
    const template = new Blueprint(html);
    const instance = template.createInstance();
    const root = instance.render({ a: 'A', b: 'B' });

    expect(root.querySelector('span')?.textContent).toBe('A');
    expect(root.querySelector('b')?.textContent).toBe('B');
    expect(root.querySelector('b')?.getAttribute('title')).toBe('B');
  });

    it('should bind function to component obj', () => {
    const template = new Blueprint('<button click="myFunc(firstName)">Click</button>');
    let theValue = "";
    const instance = template.createInstance({
      myFunc(value: string){
        theValue = value;
      }
    });

    const root = instance.render({firstName: 'Arne'});
    root.click();

    expect(theValue).toBe('Arne');
  });


  it('does nothing if component method is missing', () => {
    const template = new Blueprint('<button click="missingMethod">Click</button>');
    const instance = template.createInstance(); // no component passed
    const root = instance.render({});

    expect(() => root.querySelector('button')?.click()).not.toThrow();
  });

  it('calls component method in text binding', () => {
  const template = new Blueprint('<div>{{ translate(value) }}</div>');
  const component = {
    translate: (x: number) => `Translated-${x}`
  };
  const instance = template.createInstance(component);
  const root = instance.render({ value: 42 });

  expect(root.textContent).toBe('Translated-42');
});

it('calls component method in attribute binding', () => {
  const template = new Blueprint('<div title="{{ compute(value) }}"></div>');
  const component = {
    compute: (v: string) => v.toUpperCase()
  };
  const instance = template.createInstance(component);
  const root = instance.render({ value: 'lower' });

  expect(root.getAttribute('title')).toBe('LOWER');
});

it('calls component method with nested data in template', () => {
  const template = new Blueprint('<div>{{ wrap(user.name) }}</div>');
  const component = {
    wrap: (x: string) => `[${x}]`
  };
  const instance = template.createInstance(component);
  const root = instance.render({ user: { name: 'Anna' } });

  expect(root.textContent).toBe('[Anna]');
});

});
