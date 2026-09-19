/**
 * Stands in for dist/check so the CLI's output and exit code can be tested without a build.
 * The CLI loads it through Node's own `import()`, outside the test runner's module graph, so
 * the calls it saw are shared through `globalThis` rather than an export.
 */
import * as path from 'path';

export function checkProject(tsconfig) {
    (globalThis.fakeCheckerCalls ??= []).push(tsconfig);
    if (tsconfig.endsWith('clean.json')) {
        return { diagnostics: [], templates: 4, skipped: [] };
    }
    const absolute = path.resolve('src/A.ts').split(path.sep).join('/');
    return {
        diagnostics: [{ file: absolute, line: 3, column: 7, message: 'Cannot resolve "x"' }],
        templates: 5,
        skipped: [
            { file: 'src/A.ts', line: 1, reason: 'no type argument' },
            { file: 'src/B.ts', line: 9, reason: 'not a literal' },
            { file: 'src/C.ts', line: 2, reason: 'not a literal' },
        ],
    };
}

export function formatDiagnostic(d) {
    return `${d.file}:${d.line}:${d.column} - error: ${d.message}`;
}
