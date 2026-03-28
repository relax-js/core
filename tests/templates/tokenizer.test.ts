import { describe, it, expect, test } from 'vitest';
import { tokenize, TokenType,  MustacheToken, tokenizeMustache, tokenizeArgs } from '../../src/templates/tokenizer';

describe('Tokenizer', () => {
  it('should tokenize numeric constants', () => {
    const input = '42 3.14';
    const tokens = tokenize(input);
    
    expect(tokens).toEqual([
      { type: TokenType.Constant, value: '42' },
      { type: TokenType.Constant, value: '3.14' }
    ]);
  });

  it('should tokenize string constants', () => {
    const input = '"hello world" \'single quoted\'';
    const tokens = tokenize(input);
    
    expect(tokens).toEqual([
      { type: TokenType.Constant, value: '"hello world"' },
      { type: TokenType.Constant, value: '\'single quoted\'' }
    ]);
  });

  it('should handle escaped quotes in strings', () => {
    const input = '"escaped \\"quote\\" here"';
    const tokens = tokenize(input);
    
    expect(tokens).toEqual([
      { type: TokenType.Constant, value: '"escaped \\"quote\\" here"' }
    ]);
  });

  it('should tokenize variables', () => {
    const input = 'myVar counter';
    const tokens = tokenize(input);
    
    expect(tokens).toEqual([
      { type: TokenType.Variable, value: 'myVar' },
      { type: TokenType.Variable, value: 'counter' }
    ]);
  });

  it('should tokenize variables with dot notation', () => {
    const input = 'object.property user.profile.name';
    const tokens = tokenize(input);
    
    expect(tokens).toEqual([
      { type: TokenType.Variable, value: 'object.property' },
      { type: TokenType.Variable, value: 'user.profile.name' }
    ]);
  });

  it('should tokenize function calls', () => {
    const input = 'calculate() greet("John")';
    const tokens = tokenize(input);
    
    expect(tokens).toEqual([
      { type: TokenType.FunctionCall, value: 'calculate()' },
      { type: TokenType.FunctionCall, value: 'greet("John")' }
    ]);
  });

  it('should tokenize functions with nested calls', () => {
    const input = 'outer(inner(42))';
    const tokens = tokenize(input);
    
    expect(tokens).toEqual([
      { type: TokenType.FunctionCall, value: 'outer(inner(42))' }
    ]);
  });

  it('should tokenize mixed expressions', () => {
    const input = 'a = 10 + func(b.value) + "test".length';
    const tokens = tokenize(input);
    
    expect(tokens).toEqual([
      { type: TokenType.Variable, value: 'a' },
      { type: TokenType.Constant, value: '10' },
      { type: TokenType.FunctionCall, value: 'func(b.value)' },
      { type: TokenType.Constant, value: '"test"' },
      { type: TokenType.FunctionCall, value: 'length' }
    ]);
  });

  it('should handle method calls on objects', () => {
    const input = 'object.method(42)';
    const tokens = tokenize(input);
    
    expect(tokens).toEqual([
      { type: TokenType.FunctionCall, value: 'object.method(42)' }
    ]);
  });

  it('should handle complex nested expressions', () => {
    const input = 'math.max(user.age, calculate(profile.data.years))';
    const tokens = tokenize(input);
    
    expect(tokens).toEqual([
      { type: TokenType.FunctionCall, value: 'math.max(user.age, calculate(profile.data.years))' }
    ]);
  });
});




describe('tokenizeArgs', () => {
    it('should parse number, string, and identifier', () => {
      const tokens = tokenizeArgs(`myFunc(42, "hello", x)`);
      expect(tokens).toEqual([
        { type: 'number', value: 42 },
        { type: 'string', value: 'hello' },
        { type: 'identifier', value: 'x' }
      ]);
    });
  
    it('should handle single-quoted strings', () => {
      const tokens = tokenizeArgs(`f('world', y)`);
      expect(tokens).toEqual([
        { type: 'string', value: 'world' },
        { type: 'identifier', value: 'y' }
      ]);
    });
  
    it('should handle float numbers', () => {
      const tokens = tokenizeArgs(`f(3.14, z)`);
      expect(tokens).toEqual([
        { type: 'number', value: 3.14 },
        { type: 'identifier', value: 'z' }
      ]);
    });
  
    it('should handle escaped quotes inside strings', () => {
      const tokens = tokenizeArgs(`f("he said \\"hi\\"", name)`);
      expect(tokens).toEqual([
        { type: 'string', value: 'he said "hi"' },
        { type: 'identifier', value: 'name' }
      ]);
    });
  
    it('should ignore whitespace', () => {
      const tokens = tokenizeArgs(` f (  1 ,  "x" ,   var_123 ) `);
      expect(tokens).toEqual([
        { type: 'number', value: 1 },
        { type: 'string', value: 'x' },
        { type: 'identifier', value: 'var_123' }
      ]);
    });
  
    it('should throw on invalid input', () => {
      expect(() => tokenizeArgs(`missingParen 1, 2, 3`)).toThrow();
      expect(() => tokenizeArgs(`bad("string)`)).toThrow();
    });
  });



  

describe('tokenizeMustache', () => {
  test('should MustacheTokenize a simple template', () => {
    const template = 'Hello, {{name}}!';
    const expected: MustacheToken[] = [
      { type: 'string', value: 'Hello, ' },
      { type: 'mustache', value: '{{name}}' },
      { type: 'string', value: '!' }
    ];
    
    expect(tokenizeMustache(template)).toEqual(expected);
  });
  
  test('should handle templates with multiple mustache expressions', () => {
    const template = '{{greeting}}, {{name}}! Welcome to {{place}}.';
    const expected: MustacheToken[] = [
      { type: 'mustache', value: '{{greeting}}' },
      { type: 'string', value: ', ' },
      { type: 'mustache', value: '{{name}}' },
      { type: 'string', value: '! Welcome to ' },
      { type: 'mustache', value: '{{place}}' },
      { type: 'string', value: '.' }
    ];
    
    expect(tokenizeMustache(template)).toEqual(expected);
  });
  
  test('should handle templates with no mustache expressions', () => {
    const template = 'Plain text without any expressions';
    const expected: MustacheToken[] = [
      { type: 'string', value: 'Plain text without any expressions' }
    ];
    
    expect(tokenizeMustache(template)).toEqual(expected);
  });
  
  test('should handle empty template strings', () => {
    const template = '';
    const expected: MustacheToken[] = [];
    
    expect(tokenizeMustache(template)).toEqual(expected);
  });
  
  test('should handle templates that start with mustache expressions', () => {
    const template = '{{start}} is at the beginning';
    const expected: MustacheToken[] = [
      { type: 'mustache', value: '{{start}}' },
      { type: 'string', value: ' is at the beginning' }
    ];
    
    expect(tokenizeMustache(template)).toEqual(expected);
  });
  
  test('should handle templates that end with mustache expressions', () => {
    const template = 'The end is {{end}}';
    const expected: MustacheToken[] = [
      { type: 'string', value: 'The end is ' },
      { type: 'mustache', value: '{{end}}' }
    ];
    
    expect(tokenizeMustache(template)).toEqual(expected);
  });
  
  test('should handle adjacent mustache expressions', () => {
    const template = 'Adjacent{{first}}{{second}}expressions';
    const expected: MustacheToken[] = [
      { type: 'string', value: 'Adjacent' },
      { type: 'mustache', value: '{{first}}' },
      { type: 'mustache', value: '{{second}}' },
      { type: 'string', value: 'expressions' }
    ];
    
    expect(tokenizeMustache(template)).toEqual(expected);
  });
  
  test('should handle nested curly braces (not analyzing mustache code)', () => {
    const template = 'Nested {{outer{{inner}}}}';
    const expected: MustacheToken[] = [
      { type: 'string', value: 'Nested ' },
      { type: 'mustache', value: '{{outer{{inner}}}}' }
    ];
    
    expect(tokenizeMustache(template)).toEqual(expected);
  });
  
  test('should inform of unlosed tags', () => {
    const template = 'Unclosed {{tag';
    const expected: MustacheToken[] = [
      { type: 'string', value: 'Unclosed ' },
      { type: 'string', value: '{{tag' }
    ];
    
    expect(() => tokenizeMustache(template)).toThrow('Unclosed');
  });
  
  test('should handle templates with only mustache expressions', () => {
    const template = '{{justMustache}}';
    const expected: MustacheToken[] = [
      { type: 'mustache', value: '{{justMustache}}' }
    ];
    
    expect(tokenizeMustache(template)).toEqual(expected);
  });
});