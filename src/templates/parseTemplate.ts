import { defaultPipes, PipeFunction, PipeRegistry } from "../pipes";
import { createAccessor } from "./accessorParser";
import {
  MustacheToken,
  Token,
  tokenize,
  tokenizeArgs,
  tokenizeMustache,
  TokenType,
} from "./tokenizer";

export type RenderTemplate = (data: Record<string, any>, component?: any) => string;
type ResolveValue = (data: Record<string, any>, component?: any) => any;
type ResolveFunctionValue = (data: Record<string, any>, component: any) => any;
type RenderPart = (data: Record<string, any>, component: any) => string;

export interface TemplateParserOptions {
  pipeRegistry?: PipeRegistry;
}

interface ExpressionChain {
  source: ResolveValue;
  pipes: PipeFunction[];
}

export function compileMustard(template: string, options?: TemplateParserOptions): RenderTemplate {
  const segments: RenderPart[] = tokenizeMustache(template).map(token =>
    token.type === "string"
      ? (_data, _component) => token.value
      : compileExpression(token, options)
  );

  return (data, component) => segments.map(fn => fn(data, component)).join("");
}

function compileExpression(token: MustacheToken, options?: TemplateParserOptions): RenderPart {
  const tokens = tokenize(token.value);
  const chain = buildExpressionChain(tokens, token.value, options?.pipeRegistry);
  return renderFromChain(chain);
}

function buildExpressionChain(
  tokens: Token[],
  sourceText: string,
  pipeRegistry?: PipeRegistry
): ExpressionChain {
  let chain: ExpressionChain | null = null;
  if (!pipeRegistry){
    pipeRegistry = defaultPipes;
  }

  for (const token of tokens) {
    switch (token.type) {
      case TokenType.Constant:
        throw Error(`Constants not supported: ${token.value}`);

      case TokenType.Variable: {
        const accessor = createAccessor(token.value);
        chain = { source: accessor, pipes: [] };
        break;
      }

      case TokenType.FunctionCall: {
        const func = resolveFunction(token.value);
        chain = {
          source: func,
          pipes: []
        };
        break;
      }

      case TokenType.Pipe: {
        if (!chain) throw Error(`Pipe '${token.value}' has no input expression in: ${sourceText}`);
        if (!token.value || token.value === ''){
          throw Error('Pipe symbol was provided, but no pipes. Template: ' + sourceText);
        }

        const [pipeName, ...args] = token.value.split(':').map((p) => p.trim());
        const pipe = pipeRegistry.lookup(pipeName);
        if (!pipe) throw Error(`Pipe not found: ${pipeName}`);
        chain.pipes.push(value => pipe(value, args));
        break;
      }
    }
  }

  if (!chain) throw Error(`Invalid expression: ${sourceText}`);
  return chain;
}

function renderFromChain(chain: ExpressionChain): RenderPart {
  return (data, component) => {
    const initial = chain.source(data, component);
    const result = chain.pipes.reduce((acc, fn) => fn(acc), initial);
    return result != null ? result.toString() : "";
  };
}

function resolveFunction(expression: string): ResolveFunctionValue {
  const pos = expression.indexOf("(");
  if (pos === -1) throw Error(`Invalid function: ${expression}`);

  const args = tokenizeArgs(expression);
  const resolvedArgs: ((data: Record<string, any>) => any)[] = args.map(arg => {
    if (arg.type === "number" || arg.type === "string") return () => arg.value;
    if (arg.type === "identifier") return data => createAccessor(arg.value)(data);
    throw Error(`Unsupported argument type: ${(arg as any).type}`);
  });

  const name = expression.substring(0, pos);
  const fnAccessor = createAccessor(name);

  return (data, component) => {
    if (!component) throw Error(`Component context is required for calling '${name}'`);
    const fn = fnAccessor(component);
    if (typeof fn !== "function") throw Error(`Resolved '${name}' is not a function`);
    const evaluatedArgs = resolvedArgs.map(argFn => argFn(data));
    return fn.apply(component, evaluatedArgs);
  };
}
