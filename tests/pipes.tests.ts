import { describe, it, expect } from 'vitest';
import {
  uppercasePipe,
  lowercasePipe,
  capitalizePipe,
  shortenPipe,
  currencyPipe,
  datePipe,
  joinPipe,
  firstPipe,
  lastPipe,
  keysPipe,
  defaultPipe,
  ternaryPipe,
  createPipeRegistry,
  applyPipes
} from '../src/pipes';
import { getCurrentLocale } from '../src/i18n/i18n';

describe('Text manipulation pipes', () => {
  it('uppercasePipe converts string to uppercase', () => {
    expect(uppercasePipe('hello')).toBe('HELLO');
    expect(uppercasePipe('Hello World')).toBe('HELLO WORLD');
    expect(uppercasePipe('')).toBe('');
    expect(uppercasePipe(123 as any)).toBe('123');
  });

  it('lowercasePipe converts string to lowercase', () => {
    expect(lowercasePipe('HELLO')).toBe('hello');
    expect(lowercasePipe('Hello World')).toBe('hello world');
    expect(lowercasePipe('')).toBe('');
    expect(lowercasePipe(123 as any)).toBe('123');
  });

  it('capitalizePipe capitalizes first character', () => {
    expect(capitalizePipe('hello')).toBe('Hello');
    expect(capitalizePipe('hello world')).toBe('Hello world');
    expect(capitalizePipe('')).toBe('');
    expect(capitalizePipe(123 as any)).toBe('123');
  });

  it('shortenPipe truncates string and adds ellipsis', () => {
    expect(shortenPipe('Hello world', '5')).toBe('He...');
    expect(shortenPipe('Hello', '10')).toBe('Hello');
    expect(shortenPipe('', '5')).toBe('');
  });
});

describe('Formatting pipes', () => {
  it('currencyPipe formats number as USD', () => {
    expect(currencyPipe(1234.56)).toBe('$1,234.56');
    expect(currencyPipe(0)).toBe('$0.00');
    expect(currencyPipe(-1000)).toBe('-$1,000.00');
  });

  it('datePipe formats dates correctly', () => {
    const testDate = new Date('2023-01-15T12:00:00Z');
    const locale = getCurrentLocale();

    // Test ISO format (default)
    expect(datePipe(testDate)).toBe(testDate.toISOString());

    // Test short format
    const shortExpected = testDate.toLocaleDateString(locale);
    expect(datePipe(testDate, 'short')).toBe(shortExpected);

    // Test long format
    const longExpected = testDate.toLocaleDateString(locale, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    expect(datePipe(testDate, 'long')).toBe(longExpected);

    // Test with string date
    expect(datePipe('2023-01-15')).toBe(new Date('2023-01-15').toISOString());
  });
});

describe('Array operation pipes', () => {
  it('joinPipe joins array elements', () => {
    expect(joinPipe(['a', 'b', 'c'])).toBe('a,b,c');
    expect(joinPipe(['a', 'b', 'c'], '-')).toBe('a-b-c');
    expect(joinPipe([])).toBe('');
    expect(joinPipe('not-array' as any)).toBe('not-array');
  });

  it('firstPipe returns first element of array', () => {
    expect(firstPipe(['a', 'b', 'c'])).toBe('a');
    expect(firstPipe([])).toBe('');
    expect(firstPipe('not-array' as any)).toBe('');
  });

  it('lastPipe returns last element of array', () => {
    expect(lastPipe(['a', 'b', 'c'])).toBe('c');
    expect(lastPipe([])).toBe('');
    expect(lastPipe('not-array' as any)).toBe('');
  });
});

describe('Object operation pipes', () => {
  it('keysPipe returns object keys', () => {
    expect(keysPipe({ a: 1, b: 2, c: 3 })).toEqual(['a', 'b', 'c']);
    expect(keysPipe({})).toEqual([]);
    expect(keysPipe(null as any)).toEqual([]);
    expect(keysPipe('not-object' as any)).toEqual([]);
  });
});

describe('Conditional pipes', () => {
  it('defaultPipe returns fallback for falsy values', () => {
    expect(defaultPipe('', 'default')).toBe('default');
    expect(defaultPipe(null as any, 'default')).toBe('default');
    expect(defaultPipe(undefined as any, 'default')).toBe('default');
    expect(defaultPipe(0 as any, 'default')).toBe('default');
    expect(defaultPipe('value', 'default')).toBe('value');
  });

  it('ternaryPipe returns appropriate value based on condition', () => {
    expect(ternaryPipe(true, 'yes', 'no')).toBe('yes');
    expect(ternaryPipe(false, 'yes', 'no')).toBe('no');
    expect(ternaryPipe(1, 'yes', 'no')).toBe('yes');
    expect(ternaryPipe(0, 'yes', 'no')).toBe('no');
    expect(ternaryPipe('', 'yes', 'no')).toBe('no');
    expect(ternaryPipe('value', 'yes', 'no')).toBe('yes');
  });
});

describe('Pipe registry and application', () => {
  it('createPipeRegistry creates map with all pipes', () => {
    const registry = createPipeRegistry();
    
    expect(registry.has('uppercase')).toBe(true);
    expect(registry.has('lowercase')).toBe(true);
    expect(registry.has('nonexistent')).toBe(false);
  });

  it('applyPipes applies single pipe correctly', () => {
    expect(applyPipes('hello', ['uppercase'])).toBe('HELLO');
  });

  it('applyPipes applies multiple pipes in sequence', () => {
    expect(applyPipes('hello world', ['uppercase', 'shorten:5'])).toBe('HE...');
  });

  it('applyPipes handles pipes with arguments', () => {
    expect(applyPipes('original', ['default:fallback'])).toBe('original');
    expect(applyPipes('', ['default:fallback'])).toBe('fallback');
    expect(applyPipes(true, ['ternary:yes:no'])).toBe('yes');
  });

  it('applyPipes returns error message for nonexistent pipe', () => {
    expect(applyPipes('value', ['nonexistent'])).toBe('[Pipe nonexistent not found]');
  });

  it('applyPipes returns error message when pipe throws exception', () => {
    const badRegistry = new Map();
    badRegistry.set('bad', () => { throw new Error('Test error'); });
    
    expect(applyPipes('value', ['bad'], badRegistry))
      .toContain('[Pipe bad, value: value, error: Error: Test error]');
  });

  it('applyPipes works with custom pipe registry', () => {
    const customRegistry = new Map();
    customRegistry.set('double', (value: number) => value * 2);
    
    expect(applyPipes(5, ['double'], customRegistry)).toBe(10);
  });
});