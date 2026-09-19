/**
 * @module checkTemplate
 * Checks one template text against the types of its `compileTemplate<T, F>`
 * call. Every finding carries an offset into the template text; mapping that
 * to a file position is the caller's job.
 */

import ts from 'typescript';
import {
    HTML_MUSTACHE,
    INTERPOLATION,
    PATH,
    ParsedExpression,
    parseExpression,
    parseHtmlExpression,
    parseLoop,
} from '../html/expressions';
import { defaultPipes } from '../pipes';
import { scanTemplate, ScannedAttribute } from './scanTemplate';

export interface Finding {
    offset: number;
    message: string;
}

/** Types from lib.dom the checker needs, or null when the program has no DOM lib. */
export interface LibTypes {
    /** The element type a tag renders as: `HTMLElementTagNameMap[tag]`, else `HTMLElement`. */
    elementType(tag: string): ts.Type | null;
    event: ts.Type | null;
}

export interface CheckEnvironment {
    checker: ts.TypeChecker;
    /** The view model type `T`, or null when the call gave no type argument. */
    viewModel: ts.Type | null;
    /** The functions type `F`, or null when the call gave no second type argument. */
    functions: ts.Type | null;
    /** True when the call passes a pipe registry, so pipe names cannot be verified. */
    customPipes: boolean;
    lib: LibTypes;
}

/** A `loop` alias in scope; `type` is null when its source could not be resolved. */
interface Binding {
    name: string;
    type: ts.Type | null;
}

/** The type a path resolved to (`any` when checking cannot continue), or the reason it did not. */
type Resolution = { type: ts.Type } | { error: string } | { unknown: true };

const UNKNOWN: Resolution = { unknown: true };

/**
 * Finds the `lib.dom` types once per program. Symbols in scope of any source
 * file include the globals, which is where `HTMLElementTagNameMap` lives.
 */
export function resolveLibTypes(checker: ts.TypeChecker, anySourceFile: ts.SourceFile): LibTypes {
    const globals = new Map<string, ts.Symbol>();
    for (const symbol of checker.getSymbolsInScope(anySourceFile, ts.SymbolFlags.Type)) {
        globals.set(symbol.name, symbol);
    }
    const declared = (name: string): ts.Type | null => {
        const symbol = globals.get(name);
        return symbol ? checker.getDeclaredTypeOfSymbol(symbol) : null;
    };

    const tagNameMap = declared('HTMLElementTagNameMap');
    const htmlElement = declared('HTMLElement');
    const cache = new Map<string, ts.Type | null>();

    return {
        event: declared('Event'),
        elementType(tag) {
            if (!cache.has(tag)) {
                const entry = tagNameMap && checker.getPropertyOfType(tagNameMap, tag);
                cache.set(tag, entry ? checker.getTypeOfSymbol(entry) : htmlElement);
            }
            return cache.get(tag)!;
        },
    };
}

export function checkTemplate(text: string, env: CheckEnvironment): Finding[] {
    const findings: Finding[] = [];
    const scopes: Binding[][] = [];
    const scope = (): Binding[] => scopes.flat();

    for (const event of scanTemplate(text)) {
        if (event.kind === 'text') {
            checkInterpolation(event.text, event.offset, scope(), env, false, findings);
            continue;
        }
        if (event.kind === 'close') {
            scopes.pop();
            continue;
        }

        const bindings: Binding[] = [];
        const loop = event.attributes.find(a => a.name === 'loop');
        if (loop) bindings.push(...checkLoop(loop, scope(), env, findings));
        const inner = scope().concat(bindings);

        for (const attr of event.attributes) {
            if (attr.name === 'loop') continue;
            if (attr.name === 'if' || attr.name === 'unless') {
                report(resolvePath(attr.value, inner, env, false), attr.offset, findings);
            } else if (attr.name.startsWith('r-')) {
                checkHandler(event.tag, attr, inner, env, findings);
            } else {
                checkInterpolation(attr.value, attr.offset, inner, env, false, findings);
            }
        }

        if (!event.selfClosing) scopes.push(bindings);
    }

    return findings;
}

/**
 * Checks an `html` tagged literal: `{{name}}` is a flat property of the bound
 * context and `{{fn|args}}` a call on one of its functions. Substitutions are
 * already blanked out of the text, and the tag has no loops, conditionals,
 * pipes or handlers.
 */
export function checkHtmlTemplate(text: string, env: CheckEnvironment): Finding[] {
    const findings: Finding[] = [];
    for (const event of scanTemplate(text)) {
        if (event.kind === 'text') {
            checkHtmlInterpolation(event.text, event.offset, env, findings);
        } else if (event.kind === 'open') {
            for (const attr of event.attributes) checkHtmlInterpolation(attr.value, attr.offset, env, findings);
        }
    }
    return findings;
}

function checkHtmlInterpolation(raw: string, base: number, env: CheckEnvironment, findings: Finding[]): void {
    if (!raw.includes('{{')) return;
    const mustache = new RegExp(HTML_MUSTACHE.source, 'g');
    let consumed = 0;
    let match: RegExpExecArray | null;

    while ((match = mustache.exec(raw)) !== null) {
        reportUnclosed(raw.slice(consumed, match.index), base + consumed, findings);
        const expression = parseHtmlExpression(match[0])!;
        const leading = match[0].indexOf(expression.name);
        checkHtmlExpression(expression, base + match.index + leading, env, findings);
        consumed = match.index + match[0].length;
    }
    reportUnclosed(raw.slice(consumed), base + consumed, findings);
}

function reportUnclosed(literal: string, offset: number, findings: Finding[]): void {
    const unclosed = literal.indexOf('{{');
    if (unclosed !== -1) findings.push({ offset: offset + unclosed, message: '"{{" is never closed' });
}

function checkHtmlExpression(
    expression: { name: string; args: string[] },
    offset: number,
    env: CheckEnvironment,
    findings: Finding[],
): void {
    const { checker } = env;
    const { name, args } = expression;

    if (!/^\w+$/.test(name)) {
        findings.push({ offset, message: `"${name}" is not a property name; html templates take flat names` });
        return;
    }

    const resolvedArgs = args.map(arg => resolveArgument(arg, [], env, false));
    let argumentsResolved = true;
    for (const arg of resolvedArgs) {
        report(arg, offset, findings);
        if (!('type' in arg)) argumentsResolved = false;
    }

    const property = resolvePath(name, [], env, false);
    report(property, offset, findings);
    if (!('type' in property)) return;

    const type = property.type.getNonNullableType();
    if (type.flags & ts.TypeFlags.Any) return;
    const signatures = checker.getSignaturesOfType(type, ts.SignatureKind.Call);

    if (signatures.length === 0) {
        if (args.length > 0) {
            findings.push({ offset, message: `"${name}" on ${checker.typeToString(env.viewModel!)} is not a function` });
        }
        return;
    }

    if (!argumentsResolved) return;
    const argTypes = resolvedArgs.map(arg => (arg as { type: ts.Type }).type);
    if (signatures.some(signature => accepts(signature, argTypes, checker))) return;

    const expected = signatures
        .map(s => checker.signatureToString(s, undefined, ts.TypeFormatFlags.WriteArrowStyleSignature))
        .join(' | ');
    findings.push({ offset, message: `"${name}(${args.join(', ')})" does not match ${expected}` });
}

function report(resolution: Resolution, offset: number, findings: Finding[]): void {
    if ('error' in resolution) findings.push({ offset, message: resolution.error });
}

/** Walks the `{{expr}}` segments of text or an attribute value. */
function checkInterpolation(
    raw: string,
    base: number,
    scope: Binding[],
    env: CheckEnvironment,
    allowEvent: boolean,
    findings: Finding[],
): void {
    if (!raw.includes('{{')) return;

    let offset = base;
    for (const part of raw.split(INTERPOLATION)) {
        if (part.startsWith('{{') && part.endsWith('}}')) {
            const inner = part.slice(2, -2);
            const start = offset + 2 + (inner.length - inner.trimStart().length);
            checkExpression(inner.trim(), start, scope, env, allowEvent, findings);
        } else {
            const unclosed = part.indexOf('{{');
            if (unclosed !== -1) findings.push({ offset: offset + unclosed, message: '"{{" is never closed' });
        }
        offset += part.length;
    }
}

function checkExpression(
    expr: string,
    offset: number,
    scope: Binding[],
    env: CheckEnvironment,
    allowEvent: boolean,
    findings: Finding[],
): void {
    const parsed = parseExpression(expr);

    if (parsed.type === 'function') {
        checkCall(parsed, offset, scope, env, allowEvent, findings);
    } else {
        report(resolvePath(parsed.path!, scope, env, allowEvent), offset, findings);
    }

    if (!env.customPipes) {
        for (const pipe of parsed.pipes) {
            const name = pipe.split(':')[0].trim();
            if (!defaultPipes.has(name)) findings.push({ offset, message: `Pipe "${name}" not found` });
        }
    }
}

function checkLoop(attr: ScannedAttribute, scope: Binding[], env: CheckEnvironment, findings: Finding[]): Binding[] {
    const loop = parseLoop(attr.value);
    if (!loop) {
        findings.push({ offset: attr.offset, message: `Invalid loop syntax: "${attr.value}"` });
        return [];
    }

    const source = resolvePath(loop.source, scope, env, false);
    report(source, attr.offset, findings);
    if (!('type' in source)) return [{ name: loop.alias, type: null }];

    const { checker } = env;
    const type = source.type.getNonNullableType();
    if (type.flags & ts.TypeFlags.Any) return [{ name: loop.alias, type }];

    if (!checker.isArrayType(type) && !checker.isTupleType(type)) {
        findings.push({
            offset: attr.offset,
            message: `"${loop.source}" is not an array: ${checker.typeToString(type)}`,
        });
        return [{ name: loop.alias, type: null }];
    }

    return [{ name: loop.alias, type: checker.getIndexTypeOfType(type, ts.IndexKind.Number) ?? null }];
}

function checkHandler(
    tag: string,
    attr: ScannedAttribute,
    scope: Binding[],
    env: CheckEnvironment,
    findings: Finding[],
): void {
    const eventName = attr.name.slice(2);
    const element = env.lib.elementType(tag);
    if (element && !env.checker.getPropertyOfType(element, `on${eventName}`)) {
        findings.push({ offset: attr.offset, message: `"${attr.name}" is not a known event for <${tag}>` });
        return;
    }

    const parsed = parseExpression(attr.value);
    if (parsed.type !== 'function') {
        findings.push({
            offset: attr.offset,
            message: `${attr.name} must be a function call, got "${attr.value}"`,
        });
        return;
    }

    checkCall(parsed, attr.offset, scope, env, true, findings);
}

function checkCall(
    parsed: ParsedExpression,
    offset: number,
    scope: Binding[],
    env: CheckEnvironment,
    allowEvent: boolean,
    findings: Finding[],
): void {
    const { checker } = env;
    const args: Resolution[] = parsed.fnArgs!.map(arg => resolveArgument(arg, scope, env, allowEvent));
    let argumentsResolved = true;
    for (const arg of args) {
        report(arg, offset, findings);
        if (!('type' in arg)) argumentsResolved = false;
    }

    if (!env.functions) return;

    const property = checker.getPropertyOfType(env.functions, parsed.fnName!);
    if (!property) {
        findings.push({
            offset,
            message: `Function "${parsed.fnName}" not found on ${checker.typeToString(env.functions)}`,
        });
        return;
    }

    const fnType = checker.getTypeOfSymbol(property).getNonNullableType();
    if (fnType.flags & ts.TypeFlags.Any) return;

    const signatures = checker.getSignaturesOfType(fnType, ts.SignatureKind.Call);
    if (signatures.length === 0) {
        findings.push({
            offset,
            message: `"${parsed.fnName}" on ${checker.typeToString(env.functions)} is not a function`,
        });
        return;
    }

    if (!argumentsResolved) return;
    const argTypes = args.map(arg => (arg as { type: ts.Type }).type);
    if (signatures.some(signature => accepts(signature, argTypes, checker))) return;

    const call = `${parsed.fnName}(${parsed.fnArgs!.join(', ')})`;
    const expected = signatures
        .map(s => checker.signatureToString(s, undefined, ts.TypeFormatFlags.WriteArrowStyleSignature))
        .join(' | ');
    findings.push({ offset, message: `"${call}" does not match ${expected}` });
}

function accepts(signature: ts.Signature, args: ts.Type[], checker: ts.TypeChecker): boolean {
    const params = signature.getParameters();
    const declarationOf = (param: ts.Symbol): ts.ParameterDeclaration | undefined =>
        param.valueDeclaration && ts.isParameter(param.valueDeclaration) ? param.valueDeclaration : undefined;
    const last = params.length > 0 ? declarationOf(params[params.length - 1]) : undefined;
    const rest = last?.dotDotDotToken !== undefined;
    const required = params.filter(p => {
        const decl = declarationOf(p);
        return decl && !decl.questionToken && !decl.initializer && !decl.dotDotDotToken;
    }).length;

    if (args.length < required) return false;
    if (!rest && args.length > params.length) return false;

    return args.every((arg, i) => {
        const fixed = rest ? params.length - 1 : params.length;
        let paramType: ts.Type;
        if (i < fixed) {
            paramType = checker.getTypeOfSymbol(params[i]);
        } else {
            const restType = checker.getTypeOfSymbol(params[params.length - 1]);
            paramType = checker.getIndexTypeOfType(restType, ts.IndexKind.Number) ?? checker.getAnyType();
        }
        return checker.isTypeAssignableTo(arg, paramType);
    });
}

function resolveArgument(arg: string, scope: Binding[], env: CheckEnvironment, allowEvent: boolean): Resolution {
    const { checker } = env;
    if ((arg.startsWith('"') && arg.endsWith('"')) || (arg.startsWith("'") && arg.endsWith("'"))) {
        return { type: checker.getStringType() };
    }
    if (arg !== '' && !isNaN(Number(arg))) {
        return { type: checker.getNumberType() };
    }
    return resolvePath(arg, scope, env, allowEvent);
}

/**
 * Resolves a context path the way the runtime does: `[n]` becomes a segment,
 * a loop alias shadows the view model, nullish is looked through because
 * `null` renders as empty. `any` ends the walk; there is nothing to check.
 */
function resolvePath(path: string, scope: Binding[], env: CheckEnvironment, allowEvent: boolean): Resolution {
    const { checker } = env;
    if (!PATH.test(path)) return { error: `"${path}" is not a valid path` };

    const segments = path.replace(/\[(\d+)\]/g, '.$1').split('.');
    const root = segments[0];
    const rootError = (owner: string) => ({ error: `Cannot resolve "${path}": ${owner} has no property "${root}"` });

    let current: ts.Type;
    const binding = [...scope].reverse().find(b => b.name === root);
    if (binding) {
        if (!binding.type) return UNKNOWN;
        current = binding.type;
    } else if (env.viewModel && checker.getPropertyOfType(env.viewModel, root)) {
        current = checker.getTypeOfSymbol(checker.getPropertyOfType(env.viewModel, root)!);
    } else if (root === 'event') {
        if (!allowEvent) return { error: `"event" is only available in r-<event> handlers` };
        if (!env.lib.event) return UNKNOWN;
        current = env.lib.event;
    } else if (env.viewModel) {
        const viaIndex = propertyType(env.viewModel, root, checker);
        if (!viaIndex) return rootError(checker.typeToString(env.viewModel));
        current = viaIndex;
    } else {
        return UNKNOWN;
    }

    for (const key of segments.slice(1)) {
        if (current.flags & ts.TypeFlags.Any) return { type: current };
        const next = propertyType(current, key, checker);
        if (!next) {
            const owner = checker.typeToString(current.getNonNullableType());
            return { error: `Cannot resolve "${path}": ${owner} has no property "${key}"` };
        }
        current = next;
    }

    return { type: current };
}

function propertyType(type: ts.Type, key: string, checker: ts.TypeChecker): ts.Type | undefined {
    const t = type.getNonNullableType();
    if (t.flags & ts.TypeFlags.Any) return t;

    if (/^\d+$/.test(key)) {
        if (checker.isArrayType(t) || checker.isTupleType(t)) {
            return checker.getIndexTypeOfType(t, ts.IndexKind.Number);
        }
        const byNumber = checker.getIndexTypeOfType(t, ts.IndexKind.Number);
        if (byNumber) return byNumber;
    }

    const property = checker.getPropertyOfType(t, key);
    if (property) return checker.getTypeOfSymbol(property);

    return checker.getIndexTypeOfType(t, ts.IndexKind.String);
}
