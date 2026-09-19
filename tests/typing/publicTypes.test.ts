import { describe, it, expect } from 'vitest';
import * as path from 'path';
import ts from 'typescript';

/**
 * Compiles one fixture under the library's strict settings and returns its
 * diagnostics as text. Vitest does not typecheck, so a public type that
 * rejects the natural way of using it would otherwise go unnoticed.
 */
function diagnosticsOf(fixture: string): string[] {
    const file = path.resolve(__dirname, 'fixtures', fixture).replace(/\\/g, '/');
    const program = ts.createProgram([file], {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        strict: true,
        skipLibCheck: true,
        noEmit: true,
        lib: ['lib.es2020.d.ts', 'lib.dom.d.ts'],
    });
    return ts
        .getPreEmitDiagnostics(program)
        .filter((d) => d.file?.fileName === file)
        .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
}

describe('public types', () => {
    it('route_parameters_can_be_declared_as_an_interface', () => {
        expect(diagnosticsOf('loadRouteWithInterface.ts')).toEqual([]);
    });

    it('a_fake_server_response_callback_receives_a_typed_request', () => {
        expect(diagnosticsOf('fakeServerCallback.ts')).toEqual([]);
    });
});
