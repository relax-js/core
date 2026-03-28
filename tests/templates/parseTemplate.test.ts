import { describe, it, expect } from 'vitest';
import { compileMustard } from '../../src/templates/parseTemplate';
import { defaultPipes, PipeRegistry } from '../../src/pipes';

describe('compileTemplate', () => {
  // Simple variable substitution
  it('should substitute simple variables', () => {
    const template = 'Hello, {{name}}!';
    const parsedTemplate = compileMustard(template);

    expect(parsedTemplate({ name: 'John' }, null)).toBe('Hello, John!');
    expect(parsedTemplate({ name: 'Alice' }, null)).toBe('Hello, Alice!');
  });

  it('should handle multiple variables', () => {
    const template = '{{greeting}}, {{name}}!';
    const parsedTemplate = compileMustard(template);

    expect(parsedTemplate({ greeting: 'Hello', name: 'John' }, null)).toBe('Hello, John!');
    expect(parsedTemplate({ greeting: 'Hi', name: 'Alice' }, null)).toBe('Hi, Alice!');
  });

  // Nested variable access
  it('should handle nested object properties', () => {
    const template = 'Welcome, {{user.name}}! Your score is {{user.stats.score}}.';
    const parsedTemplate = compileMustard(template);

    expect(parsedTemplate({
      user: {
        name: 'John',
        stats: { score: 85 }
      }
    })).toBe('Welcome, John! Your score is 85.');
  });

  it('should return empty string for undefined nested properties', () => {
    const template = 'Data: {{user.profile.image}}';
    const parsedTemplate = compileMustard(template);

    expect(parsedTemplate({ user: { profile: {} } })).toBe('Data: ');
    expect(parsedTemplate({ user: {} })).toBe('Data: ');
  });

  // Pipe transformations
  it('should apply simple pipe transformations', () => {
    const template = 'Hello, {{name | uppercase}}!';
    const parsedTemplate = compileMustard(template);

    expect(parsedTemplate({
      name: 'john',
      uppercase: (value: string) => value.toUpperCase()
    })).toBe('Hello, JOHN!');
  });

  it('should chain multiple pipes', () => {
    const template = '{{text | trim | uppercase | shorten:10}}';
    const parsedTemplate = compileMustard(template);

    expect(parsedTemplate({
      text: '  hello world  ',
    })).toBe('HELLO W...');
  });

  // Function calls
  it('should handle function calls without arguments', () => {
    const template = 'Today is {{currentDate()}}';
    const parsedTemplate = compileMustard(template);

    expect(parsedTemplate({}, {
      currentDate: () => '2023-10-15'
    })).toBe('Today is 2023-10-15');
  });

  it('should handle function calls with string arguments', () => {
    const template = '{{formatDate("2023-10-15", "short")}}';
    const parsedTemplate = compileMustard(template);

    expect(parsedTemplate({}, {
      formatDate: (dateStr: string, format: string) => {
        return format === 'short' ? '10/15/2023' : dateStr;
      }
    })).toBe('10/15/2023');
  });

  it('should handle function calls with number arguments', () => {
    const template = 'Result: {{add(5, 3)}}';
    const parsedTemplate = compileMustard(template);

    expect(parsedTemplate({}, {
      add: (a: number, b: number) => a + b
    })).toBe('Result: 8');
  });

  it('should handle function calls with variable arguments', () => {
    const template = 'Formatted: {{format(name, "bold")}}';
    const parsedTemplate = compileMustard(template);

    expect(parsedTemplate({
      name: 'John',
    }, {
      format: (text: string, style: string) => {
        return style === 'bold' ? `<b>${text}</b>` : text;
      }
    })).toBe('Formatted: <b>John</b>');
  });


  // Complex combinations
  it('should handle complex combinations of variables, pipes and functions', () => {
    const pipeRegistry: PipeRegistry = {
      lookup(name) {
        if (name === 'formatMoney') return (value: number) => `$${value.toFixed(2)}`;
        return defaultPipes.lookup(name);
      },
      get(name) {
        const pipe = this.lookup(name);
        if (!pipe) throw Error(`Pipe '${name}' not found.`);
        return pipe;
      },
      has(name) {
        return name === 'formatMoney' || defaultPipes.has(name);
      }
    };

    const template = 'Hello, {{user.name | uppercase}}! You have {{calculateTotal(user.items) | formatMoney}} in your cart.';
    const parsedTemplate = compileMustard(template, { pipeRegistry });

    expect(parsedTemplate({
      user: {
        name: 'john',
        items: [10, 20, 30]
      },
    }, {
      calculateTotal: (items: number[]) => items.reduce((sum, item) => sum + item, 0),
    })).toBe('Hello, JOHN! You have $60.00 in your cart.');
  });

  it('should handle functions and pipes combined', () => {
    const template = '{{getGreeting() | uppercase}} {{user.name | lowercase | shorten:5}}!';
    const parsedTemplate = compileMustard(template);

    expect(parsedTemplate({
      user: { name: 'ELIZABETH' },
    },
      {
        getGreeting: () => 'hello',
      })).toBe('HELLO el...!');
  });

  // Error cases
  it('should handle missing variables gracefully', () => {
    const template = 'Hello, {{name}}!';
    const parsedTemplate = compileMustard(template);

    expect(parsedTemplate({})).toBe('Hello, !');
  });

  it('should handle missing functions gracefully', () => {
    const template = 'Today is {{currentDate()}}';
    const parsedTemplate = compileMustard(template);

    expect(() => parsedTemplate({}, {func(){}})).toThrow("Resolved 'currentDate'");
  });

  it('should handle unbalanced brackets with error', () => {
    const malformedTemplate = 'This {{has}} unbalanced {{brackets';

    expect(() => compileMustard(malformedTemplate)).toThrow('Unclosed m');
  });

  it('should handle malformed pipe syntax with error', () => {
    const malformedTemplate = '{{name | }}';

    expect(() => compileMustard(malformedTemplate, { pipeRegistry: defaultPipes })).toThrowError("Pipe symbol was provided");
  });

  it('should handle malformed function call syntax with error', () => {
    const malformedTemplate = '{{greet(}}';

    expect(() => compileMustard(malformedTemplate)).toThrow('Invalid function call syntax');
  });

  // Edge cases
  it('should handle empty template strings', () => {
    expect(compileMustard('')({})).toBe('');
  });

  it('should handle template strings without any expressions', () => {
    const template = 'Just a regular string without expressions';
    expect(compileMustard(template)({})).toBe('Just a regular string without expressions');
  });

  it('should handle consecutive expressions', () => {
    const template = '{{first}}{{second}}';
    const parsedTemplate = compileMustard(template);

    expect(parsedTemplate({ first: 'Hello', second: 'World' })).toBe('HelloWorld');
  });

  it('should preserve whitespace in the template', () => {
    const template = '  {{name}}  ';
    const parsedTemplate = compileMustard(template);

    expect(parsedTemplate({ name: 'John' })).toBe('  John  ');
  });

  it('should correctly parse array indexing', () => {
    const template = 'First item: {{items[0]}}';
    const parsedTemplate = compileMustard(template);

    expect(parsedTemplate({ items: ['apple', 'banana', 'cherry'] })).toBe('First item: apple');
  });

  it('should handle nested array and object access', () => {
    const template = 'Data: {{users[0].profile.address.city}}';
    const parsedTemplate = compileMustard(template);

    expect(parsedTemplate({
      users: [
        { profile: { address: { city: 'New York' } } },
        { profile: { address: { city: 'Los Angeles' } } }
      ]
    })).toBe('Data: New York');
  });
});