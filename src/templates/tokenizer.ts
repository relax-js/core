/**
 * Represents different token types that can be identified by the tokenizer
 * @example
 * // Use to classify what kind of syntax element was found
 * const tokenType = TokenType.Constant;
 */
export enum TokenType {
  Constant = 0,
  FunctionCall = 1,
  Variable = 2,
  Pipe = 3,
}

/**
 * Represents a token with its type and value
 * @example
 * // Creating a token for a number constant
 * const token: Token = { type: TokenType.Constant, value: '42' };
 */
export interface Token {
  type: TokenType;
  value: string;
}

/**
 * Tokenizes an input string into constants, function calls, and variables
 * @example
 * // Basic usage
 * const tokens = tokenize('myVar.property + func(42)');
 * 
 * @example
 * // Handling complex expressions
 * const tokens = tokenize('math.sin(angle) + "hello".length');
 * 
 * @example
 * // Handling pipes
 * const tokens = tokenize('input | transform | display');
 */
export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    let char = input[i];

    // Skip whitespace
    if (/\s/.test(char)) {
      i++;
      continue;
    }

    // Handle pipe operator ("|")
    if (char === '|') {
      i++;

      // Skip whitespace after pipe
      while (i < input.length && /\s/.test(input[i])) {
        i++;
      }

      // Capture the pipe target (everything up to the next whitespace or special character)
      let pipeTarget = '';
      while (i < input.length && !/[\s\(\)\[\]\{\}\|\+\-\*\/\=\;\,\.]/.test(input[i])) {
        pipeTarget += input[i];
        i++;
      }

      tokens.push({ type: TokenType.Pipe, value: pipeTarget });
      continue;
    }

    // Handle string constants
    if (char === '"' || char === "'") {
      const quote = char;
      let value = quote;
      i++;

      while (i < input.length && input[i] !== quote) {
        // Handle escaped quotes
        if (input[i] === '\\' && i + 1 < input.length && input[i + 1] === quote) {
          value += '\\' + quote;
          i += 2;
        } else {
          value += input[i];
          i++;
        }
      }

      if (i < input.length) {
        value += quote;
        i++;
      }

      tokens.push({ type: TokenType.Constant, value });
      continue;
    }

    // Handle numeric constants
    if (/[0-9]/.test(char)) {
      let value = '';
      let hasDecimal = false;

      while (i < input.length && (/[0-9]/.test(input[i]) || (input[i] === '.' && !hasDecimal))) {
        if (input[i] === '.') {
          hasDecimal = true;
        }
        value += input[i];
        i++;
      }

      tokens.push({ type: TokenType.Constant, value });
      continue;
    }

    // Handle identifiers (variables and function calls with property/array access)
    if (/[a-zA-Z_$]/.test(char)) {
      let value = '';
      let isFunctionCall = false;

      // Capture identifier, including dots and bracket access
      while (i < input.length) {
        if (/[a-zA-Z0-9_$.]/.test(input[i])) {
          value += input[i];
          i++;
        } else if (input[i] === '[') {
          // Include array index expression like [0] or ['key']
          let bracketCount = 1;
          value += input[i++];
          while (i < input.length && bracketCount > 0) {
            if (input[i] === '[') bracketCount++;
            if (input[i] === ']') bracketCount--;
            value += input[i++];
          }
        } else {
          break;
        }
      }

      // Skip whitespace to check for function call
      let wsCount = 0;
      while (i < input.length && /\s/.test(input[i])) {
        wsCount++;
        i++;
      }

      // Check if this is a function call
      if (i < input.length && input[i] === '(') {
        isFunctionCall = true;

        value += '(';
        i++;

        let parenCount = 1;
        while (i < input.length && parenCount > 0) {
          if (input[i] === '(') parenCount++;
          if (input[i] === ')') parenCount--;
          value += input[i++];
        }
      } else {
        // Restore skipped whitespace
        i -= wsCount;
      }

      const lastToken = tokens[tokens.length - 1];
      const isDotAfterConstant = input[i - value.length - 1] === '.' && lastToken?.type === TokenType.Constant;

      tokens.push({
        type: isFunctionCall || isDotAfterConstant ? TokenType.FunctionCall : TokenType.Variable,
        value
      });
      continue;
    }

    // Handle operators and other characters
    i++;
  }

  return tokens;
}





/** Functions */

export type ArgToken =
  | { type: 'number'; value: number }
  | { type: 'string'; value: string }
  | { type: 'identifier'; value: string };

export function tokenizeArgs(input: string): ArgToken[] {
  const tokens: ArgToken[] = [];

  const start = input.indexOf('(');
  const end = input.lastIndexOf(')');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Invalid function call syntax');
  }

  const argsStr = input.slice(start + 1, end);
  let i = 0;

  while (i < argsStr.length) {
    const char = argsStr[i];

    if (/\s/.test(char)) {
      i++;
      continue;
    }

    if (char === '"' || char === "'") {
      const quoteType = char;
      let value = '';
      i++;
      while (i < argsStr.length && argsStr[i] !== quoteType) {
        if (argsStr[i] === '\\') {
          i++;
          if (i < argsStr.length) {
            value += argsStr[i];
          }
        } else {
          value += argsStr[i];
        }
        i++;
      }
      if (i >= argsStr.length) {
        throw new Error('Unterminated string in arguments');
      }

      i++; // skip closing quote
      tokens.push({ type: 'string', value });
      continue;
    }


    if (/[0-9]/.test(char)) {
      let numStr = '';
      while (i < argsStr.length && /[0-9.]/.test(argsStr[i])) {
        numStr += argsStr[i];
        i++;
      }
      tokens.push({ type: 'number', value: parseFloat(numStr) });
      continue;
    }

    if (/[a-zA-Z_]/.test(char)) {
      let ident = '';
      while (i < argsStr.length && /[a-zA-Z0-9_\.]/.test(argsStr[i])) {
        ident += argsStr[i];
        i++;
      }
      tokens.push({ type: 'identifier', value: ident });
      continue;
    }

    if (char === ',') {
      i++;
      continue;
    }

    throw new Error(`Unexpected character in arguments: ${char}`);
  }

  return tokens;
}






/** For STRING/MUSTACHE */

export type MustacheTokenType = 'string' | 'mustache';

/**
 * Represents a token extracted from a template string
 * @typedef {Object} MustahceToken
 * @property {MustacheTokenType} type - Either 'string' for plain text or 'mustache' for mustache expressions
 * @property {string} value - The actual content of the token
 */
export interface MustacheToken {
  type: MustacheTokenType;
  value: string;
}

/**
 * Tokenizes a template string into an array of string and mustache tokens
 * @param {string} template - The template string containing text and mustache expressions
 * @returns {MustacheToken[]} An array of tokens representing the parsed template
 *
 * @example
 * // Returns tokens for a simple greeting template
 * tokenizeTemplate("Hello, {{name}}!");
 * // [
 * //   { type: 'string', value: 'Hello, ' },
 * //   { type: 'mustache', value: '{{name}}' },
 * //   { type: 'string', value: '!' }
 * // ]
 */
export function tokenizeMustache(template: string): MustacheToken[] {
  const tokens: MustacheToken[] = [];
  let currentIndex = 0;

  while (currentIndex < template.length) {
    const openTagIndex = template.indexOf('{{', currentIndex);

    if (openTagIndex === -1) {
      tokens.push(createStringToken(template.slice(currentIndex)));
      break;
    }

    if (openTagIndex > currentIndex) {
      tokens.push(createStringToken(template.slice(currentIndex, openTagIndex)));
    }

    const { value: mustache, endIndex, balanced } = extractMustache(template, openTagIndex);
    if (!balanced) {
      throw new Error(`Unclosed mustache tag starting at index ${openTagIndex}, template: ${template}`);
    }
    tokens.push(createMustacheToken(mustache));
    currentIndex = endIndex;
  }

  return tokens;
}

function createStringToken(value: string): MustacheToken {
  return { type: 'string', value };
}

function createMustacheToken(value: string): MustacheToken {
  return { type: 'mustache', value };
}

function extractMustache(template: string, startIndex: number): {
  value: string;
  endIndex: number;
  balanced: boolean;
} {
  const open = '{{';
  const close = '}}';
  let i = startIndex + open.length;
  let depth = 1;

  while (i < template.length && depth > 0) {
    if (template.slice(i, i + open.length) === open) {
      depth++;
      i += open.length;
    } else if (template.slice(i, i + close.length) === close) {
      depth--;
      i += close.length;
    } else {
      i++;
    }
  }

  const balanced = depth === 0;
  const endIndex = balanced ? i : template.length;
  const value = template.slice(startIndex, endIndex);

  return { value, endIndex, balanced };
}
