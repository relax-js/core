/**
 * @module check
 * Static checking of `compileTemplate` templates against their `<T, F>` type
 * arguments, using the TypeScript compiler API. This is what
 * `npx @relax.js/core check` runs; call it directly from a build script or a
 * test to get the findings as data.
 *
 * @example
 * import { checkProject, formatDiagnostic } from '@relax.js/core/check';
 *
 * const result = checkProject('tsconfig.json');
 * for (const d of result.diagnostics) console.log(formatDiagnostic(d));
 * // src/UserCard.ts:14:23 - error: Cannot resolve "user.naem": Profile has no property "naem"
 */

import ts from 'typescript';
import { checkHtmlTemplate, checkTemplate, resolveLibTypes } from './checkTemplate';
import { findTemplates, SkipReason } from './findTemplates';

export interface TemplateDiagnostic {
    file: string;
    /** 1-based. */
    line: number;
    /** 1-based. */
    column: number;
    message: string;
}

export interface SkippedTemplate {
    file: string;
    line: number;
    /** Why the template got less than a full check. */
    reason: SkipReason;
}

export type { SkipReason };

export interface CheckResult {
    diagnostics: TemplateDiagnostic[];
    /** Templates whose text was checked, including the untyped ones. */
    templates: number;
    skipped: SkippedTemplate[];
}

/**
 * Checks every `compileTemplate` call in the program's own source files.
 * Declaration files and anything under `node_modules` are left out.
 */
export function checkProgram(program: ts.Program): CheckResult {
    const checker = program.getTypeChecker();
    const result: CheckResult = { diagnostics: [], templates: 0, skipped: [] };
    const sourceFiles = program
        .getSourceFiles()
        .filter(sf => !sf.isDeclarationFile && !sf.fileName.includes('/node_modules/'));
    if (sourceFiles.length === 0) return result;

    const lib = resolveLibTypes(checker, sourceFiles[0]);

    for (const sourceFile of sourceFiles) {
        const lineOf = (pos: number) => sourceFile.getLineAndCharacterOfPosition(pos).line + 1;
        const { found, skipped } = findTemplates(sourceFile, checker);

        for (const template of skipped) {
            result.skipped.push({ file: sourceFile.fileName, line: lineOf(template.node.getStart(sourceFile)), reason: template.reason });
        }

        for (const template of found) {
            result.templates++;
            if (!template.viewModel) {
                result.skipped.push({ file: sourceFile.fileName, line: lineOf(template.node.getStart(sourceFile)), reason: 'no type argument' });
            }

            const env = {
                checker,
                viewModel: template.viewModel,
                functions: template.functions,
                customPipes: template.customPipes,
                lib,
            };
            const findings = template.kind === 'html'
                ? checkHtmlTemplate(template.text, env)
                : checkTemplate(template.text, env);

            for (const finding of findings) {
                const { line, character } = sourceFile.getLineAndCharacterOfPosition(template.textStart + finding.offset);
                result.diagnostics.push({
                    file: sourceFile.fileName,
                    line: line + 1,
                    column: character + 1,
                    message: finding.message,
                });
            }
        }
    }

    return result;
}

/** Builds the program a `tsconfig.json` describes and checks it. */
export function checkProject(tsconfigPath: string): CheckResult {
    const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
    if (configFile.error) {
        throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n'));
    }
    const basePath = tsconfigPath.replace(/[\\/][^\\/]*$/, '') || '.';
    const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, basePath);
    const program = ts.createProgram(parsed.fileNames, parsed.options);
    return checkProgram(program);
}

/** One finding in the line format `tsc` uses, so editors and agents read it the same way. */
export function formatDiagnostic(diagnostic: TemplateDiagnostic): string {
    return `${diagnostic.file}:${diagnostic.line}:${diagnostic.column} - error: ${diagnostic.message}`;
}
