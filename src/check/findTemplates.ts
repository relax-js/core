/**
 * @module findTemplates
 * Locates `compileTemplate(...)` calls and `html\`...\`` literals in a source
 * file and reads what the checker needs from each: the literal template text,
 * where it starts, the types to check against and whether a custom pipe
 * registry is passed.
 */

import ts from 'typescript';

export interface FoundTemplate {
    kind: 'compileTemplate' | 'html';
    node: ts.Node;
    /**
     * The template text as written in the source, without its quotes. In an
     * `html` literal each `${...}` is blanked with spaces so offsets still map
     * to the file.
     */
    text: string;
    /** Source position of the first template character, for mapping offsets to lines. */
    textStart: number;
    viewModel: ts.Type | null;
    functions: ts.Type | null;
    customPipes: boolean;
}

export type SkipReason = 'no type argument' | 'not a literal' | 'no bind call';

export interface SkippedTemplate {
    node: ts.Node;
    reason: SkipReason;
}

export interface FoundTemplates {
    found: FoundTemplate[];
    skipped: SkippedTemplate[];
}

function calleeName(callee: ts.LeftHandSideExpression): string | null {
    if (ts.isIdentifier(callee)) return callee.text;
    if (ts.isPropertyAccessExpression(callee)) return callee.name.text;
    return null;
}

/**
 * A config object that names a `pipeRegistry`, spreads another object, or is
 * not an object literal at all may carry pipes the checker cannot see.
 */
function passesCustomPipes(config: ts.Expression | undefined): boolean {
    if (!config) return false;
    if (!ts.isObjectLiteralExpression(config)) return true;
    return config.properties.some(p =>
        ts.isSpreadAssignment(p) || (p.name !== undefined && ts.isIdentifier(p.name) && p.name.text === 'pipeRegistry'),
    );
}

/**
 * The text between the backticks with every `${...}` replaced by spaces of
 * the same length, so an offset into it is an offset into the file.
 */
function blankedTemplateText(template: ts.TemplateLiteral, sourceFile: ts.SourceFile): string {
    const start = template.getStart(sourceFile) + 1;
    const text = sourceFile.text.slice(start, template.getEnd() - 1);
    if (ts.isNoSubstitutionTemplateLiteral(template)) return text;

    let blanked = text;
    let previousLiteralEnd = template.head.getEnd();
    for (const span of template.templateSpans) {
        const from = previousLiteralEnd - 2 - start;
        const to = span.literal.getStart(sourceFile) + 1 - start;
        blanked = blanked.slice(0, from) + ' '.repeat(to - from) + blanked.slice(to);
        previousLiteralEnd = span.literal.getEnd();
    }
    return blanked;
}

/**
 * The argument of the call that binds an `html` template: the immediate
 * `html\`...\`(model)`, or the first call in the file of the variable or class
 * field the bind function was stored in.
 */
function bindArgument(
    tagged: ts.TaggedTemplateExpression,
    sourceFile: ts.SourceFile,
    checker: ts.TypeChecker,
): ts.Expression | undefined {
    const parent = tagged.parent;
    if (ts.isCallExpression(parent) && parent.expression === tagged) return parent.arguments[0];

    const holder = ts.isVariableDeclaration(parent) || ts.isPropertyDeclaration(parent) ? parent : null;
    if (!holder || !holder.name || !ts.isIdentifier(holder.name)) return undefined;
    const symbol = checker.getSymbolAtLocation(holder.name);
    if (!symbol) return undefined;

    let argument: ts.Expression | undefined;
    const visit = (node: ts.Node) => {
        if (argument) return;
        if (ts.isCallExpression(node)) {
            const callee = node.expression;
            const name = ts.isPropertyAccessExpression(callee) ? callee.name : callee;
            if (checker.getSymbolAtLocation(name) === symbol) {
                argument = node.arguments[0];
                return;
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    return argument;
}

export function findTemplates(sourceFile: ts.SourceFile, checker: ts.TypeChecker): FoundTemplates {
    const result: FoundTemplates = { found: [], skipped: [] };

    const visitCompileTemplate = (node: ts.CallExpression) => {
        const [template, config] = node.arguments;
        if (!template || !(ts.isStringLiteral(template) || ts.isNoSubstitutionTemplateLiteral(template))) {
            result.skipped.push({ node, reason: 'not a literal' });
            return;
        }
        const [viewModelNode, functionsNode] = node.typeArguments ?? [];
        result.found.push({
            kind: 'compileTemplate',
            node,
            text: template.getText(sourceFile).slice(1, -1),
            textStart: template.getStart(sourceFile) + 1,
            viewModel: viewModelNode ? checker.getTypeFromTypeNode(viewModelNode) : null,
            functions: functionsNode ? checker.getTypeFromTypeNode(functionsNode) : null,
            customPipes: passesCustomPipes(config),
        });
    };

    const visitHtml = (node: ts.TaggedTemplateExpression) => {
        const argument = bindArgument(node, sourceFile, checker);
        if (!argument) {
            result.skipped.push({ node, reason: 'no bind call' });
            return;
        }
        result.found.push({
            kind: 'html',
            node,
            text: blankedTemplateText(node.template, sourceFile),
            textStart: node.template.getStart(sourceFile) + 1,
            viewModel: checker.getTypeAtLocation(argument),
            functions: null,
            customPipes: true,
        });
    };

    const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node) && calleeName(node.expression) === 'compileTemplate') {
            visitCompileTemplate(node);
        } else if (ts.isTaggedTemplateExpression(node) && calleeName(node.tag) === 'html') {
            visitHtml(node);
        }
        ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return result;
}
