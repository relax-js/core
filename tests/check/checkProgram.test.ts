import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import ts from 'typescript';
import { checkProgram, checkProject, formatDiagnostic, CheckResult, TemplateDiagnostic } from '../../src/check';

const fixtures = path.resolve(__dirname, 'fixtures');
const fixture = (name: string) => path.join(fixtures, name).replace(/\\/g, '/');

let result: CheckResult;

beforeAll(() => {
    const files = fs.readdirSync(fixtures).filter(f => f.endsWith('.ts')).map(fixture);
    const program = ts.createProgram(files, {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        strict: true,
        skipLibCheck: true,
        noEmit: true,
        lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
    });
    result = checkProgram(program);
});

/** 1-based line and column of the first occurrence of `needle` in the fixture. */
function at(name: string, needle: string, occurrence = 1): { line: number; column: number } {
    const source = fs.readFileSync(fixture(name), 'utf8');
    let index = -1;
    for (let n = 0; n < occurrence; n++) index = source.indexOf(needle, index + 1);
    if (index === -1) throw new Error(`"${needle}" not in ${name}`);
    const before = source.slice(0, index);
    const line = before.split('\n').length;
    const column = index - before.lastIndexOf('\n');
    return { line, column };
}

function inFile(name: string): TemplateDiagnostic[] {
    return result.diagnostics.filter(d => d.file === fixture(name));
}

function expectFinding(name: string, needle: string, message: string, occurrence = 1) {
    const position = at(name, needle, occurrence);
    const hit = inFile(name).find(d => d.line === position.line && d.column === position.column);
    expect(hit, `no finding at ${name}:${position.line}:${position.column}; got ${inFile(name).map(formatDiagnostic).join('\n')}`).toBeDefined();
    expect(hit!.message).toContain(message);
}

describe('checkProgram', () => {
    it('a_correct_typed_template_has_no_findings', () => {
        expect(inFile('clean.ts').map(formatDiagnostic)).toEqual([]);
    });

    describe('paths', () => {
        it('a_misspelled_root_property_is_reported_against_the_view_model', () => {
            expectFinding('paths.ts', 'usr.name', 'Cannot resolve "usr.name": ViewModel has no property "usr"');
        });

        it('a_misspelled_nested_property_is_reported_against_its_parent_type', () => {
            expectFinding('paths.ts', 'user.naem', 'Profile has no property "naem"');
        });

        it('a_nullable_property_is_looked_through_because_null_renders_empty', () => {
            expect(inFile('paths.ts').some(d => d.message.includes('"user.naem"'))).toBe(true);
            expect(inFile('paths.ts').some(d => d.message.includes('null'))).toBe(false);
        });

        it('a_property_of_a_primitive_is_checked_against_that_primitive', () => {
            expectFinding('paths.ts', 'count.length', 'number has no property "length"');
        });

        it('indexing_a_non_array_is_reported', () => {
            expectFinding('paths.ts', 'count[0]', 'number has no property "0"');
        });

        it('indexing_an_array_gives_the_element_type', () => {
            expect(inFile('paths.ts').some(d => d.message.includes('items[0].length'))).toBe(false);
        });

        it('if_and_unless_are_checked_as_paths', () => {
            expectFinding('paths.ts', 'user.emial', 'Profile has no property "emial"');
            expectFinding('paths.ts', 'items.size', 'string[] has no property "size"');
        });

        it('an_expression_that_is_not_a_path_is_reported', () => {
            expectFinding('paths.ts', 'user name', '"user name" is not a valid path');
        });

        it('paths_inside_attribute_values_are_checked', () => {
            expectFinding('paths.ts', 'user.id', 'Profile has no property "id"');
        });

        it('finding_positions_point_at_the_expression_not_the_call', () => {
            const position = at('paths.ts', 'usr.name');
            const line = fs.readFileSync(fixture('paths.ts'), 'utf8').split('\n')[position.line - 1];
            expect(line.slice(position.column - 1)).toMatch(/^usr\.name/);
        });
    });

    describe('loops', () => {
        it('loop_alias_is_typed_as_the_element_type_of_its_source', () => {
            expectFinding('loops.ts', 'row.idd', 'Row has no property "idd"');
        });

        it('nested_loop_alias_resolves_through_the_outer_alias', () => {
            expectFinding('loops.ts', 'cell.valeu', '{ value: string; } has no property "valeu"');
            expect(inFile('loops.ts').some(d => d.message.includes('cell.value"'))).toBe(false);
        });

        it('a_loop_alias_is_out_of_scope_after_its_element_closes', () => {
            expectFinding('loops.ts', 'row.id}}</tr>', 'ViewModel has no property "row"');
        });

        it('a_loop_over_a_non_array_is_reported', () => {
            expectFinding('loops.ts', 'ch in title', '"title" is not an array: string');
        });

        it('an_invalid_loop_definition_is_reported', () => {
            expectFinding('loops.ts', 'rows">{{title}}', 'Invalid loop syntax: "rows"');
        });

        it('an_unresolvable_loop_source_is_reported_once_and_the_alias_is_not_checked', () => {
            expectFinding('loops.ts', 'row in rowz', 'ViewModel has no property "rowz"');
            expect(inFile('loops.ts').filter(d => d.message.includes('"row.id"'))).toHaveLength(1);
        });
    });

    describe('functions', () => {
        it('a_function_missing_from_the_functions_type_is_reported', () => {
            expectFinding('functions.ts', 'sav(row)', 'Function "sav" not found on Handlers');
            expectFinding('functions.ts', 'saev(row)', 'Function "saev" not found on Handlers');
        });

        it('too_many_arguments_is_reported_with_the_expected_signature', () => {
            expectFinding('functions.ts', 'now(row)', '"now(row)" does not match () => string');
            expectFinding('functions.ts', 'save(row, event)', 'does not match (row: Row) => void');
        });

        it('too_few_arguments_is_reported', () => {
            expectFinding('functions.ts', 'greet(name)}}', 'does not match (name: string, times: number) => string');
        });

        it('an_argument_of_the_wrong_type_is_reported', () => {
            expectFinding('functions.ts', 'greet(row, 2)', 'does not match');
            expectFinding('functions.ts', 'save(event)', 'does not match');
        });

        it('an_unresolvable_argument_path_is_reported_as_a_path_error', () => {
            expectFinding('functions.ts', 'greet(name, nope)', 'ViewModel has no property "nope"');
        });

        it('event_is_only_in_scope_inside_a_handler', () => {
            expectFinding('functions.ts', 'now(event)', '"event" is only available in r-<event> handlers');
            expect(inFile('functions.ts').some(d => d.message.includes('save(row, event)"') && d.message.includes('"event"'))).toBe(false);
        });

        it('literal_arguments_and_matching_paths_pass', () => {
            expect(inFile('functions.ts').some(d => d.line === at('functions.ts', 'now()').line)).toBe(false);
        });
    });

    describe('events', () => {
        it('an_unknown_event_name_is_reported', () => {
            expectFinding('events.ts', 'save()">typo', '"r-clik" is not a known event for <button>');
        });

        it('a_handler_that_is_not_a_call_is_reported', () => {
            expectFinding('events.ts', 'save">not', 'r-click must be a function call, got "save"');
        });

        it('a_custom_event_is_rejected_like_the_runtime_does', () => {
            expectFinding('events.ts', 'go()">custom event', '"r-pageselected" is not a known event for <r-pager>');
        });

        it('a_custom_element_accepts_the_events_every_element_has', () => {
            expect(inFile('events.ts').some(d => d.line === at('events.ts', 'custom element').line)).toBe(false);
        });

        it('functions_are_not_checked_without_a_functions_type', () => {
            expect(inFile('events.ts').some(d => d.message.includes('Function "save"'))).toBe(false);
        });
    });

    describe('pipes', () => {
        it('an_unknown_built_in_pipe_is_reported', () => {
            expectFinding('pipes.ts', 'name | upper}}', 'Pipe "upper" not found');
            expectFinding('pipes.ts', 'name | trim | capitalise', 'Pipe "capitalise" not found');
        });

        it('pipes_are_not_checked_when_a_registry_is_passed', () => {
            expect(inFile('pipes.ts').filter(d => d.message.includes('"upper"'))).toHaveLength(1);
        });
    });

    describe('skipped templates', () => {
        it('an_untyped_template_still_gets_syntax_pipe_and_event_checks', () => {
            expectFinding('skipped.ts', 'name | upper', 'Pipe "upper" not found');
            expectFinding('skipped.ts', '{{unclosed', '"{{" is never closed');
            expectFinding('skipped.ts', 'x()">y', '"r-clik" is not a known event');
            expect(inFile('skipped.ts').some(d => d.message.includes('whatever'))).toBe(false);
        });

        it('a_template_that_is_not_a_literal_is_skipped_with_a_reason', () => {
            const reasons = result.skipped.filter(s => s.file === fixture('skipped.ts')).map(s => `${s.line}:${s.reason}`);
            expect(reasons).toContain(`${at('skipped.ts', 'compileTemplate(`').line}:no type argument`);
            expect(reasons).toContain(`${at('skipped.ts', '(markup)').line}:not a literal`);
            expect(reasons).toContain(`${at('skipped.ts', '${title}').line}:not a literal`);
        });

        it('a_single_quoted_string_literal_is_checked', () => {
            expectFinding('skipped.ts', 'nmae}}</p>\')', '{ name: string; } has no property "nmae"');
        });

        it('the_summary_counts_checked_and_skipped_templates', () => {
            expect(result.templates).toBeGreaterThan(5);
            expect(result.skipped.filter(s => s.file === fixture('skipped.ts'))).toHaveLength(3);
        });
    });

    describe('html tag', () => {
        const file = 'htmlTag.ts';

        it('the_context_type_is_taken_from_the_immediate_bind_call', () => {
            expectFinding(file, 'nmae', 'Cannot resolve "nmae": Card has no property "nmae"');
        });

        it('names_are_flat_properties_so_a_dotted_path_is_reported', () => {
            expectFinding(file, 'user.email}}</p>', '"user.email" is not a property name; html templates take flat names');
        });

        it('function_arguments_are_resolved_and_may_be_dotted', () => {
            expectFinding(file, 'greet|nope', 'Cannot resolve "nope": Card has no property "nope"');
            expect(inFile(file).some(d => d.message.includes('user.email"') && d.message.includes('no property'))).toBe(false);
        });

        it('a_call_that_does_not_fit_the_signature_is_reported', () => {
            expectFinding(file, 'greet|name, name', '"greet(name, name)" does not match (name: string) => string');
            expectFinding(file, 'stamp|name', '"stamp(name)" does not match () => string');
            expectFinding(file, "format|2, 'x'", '"format(2, \'x\')" does not match (a: string, b: number) => string');
        });

        it('arguments_on_a_property_that_is_not_a_function_are_reported', () => {
            expectFinding(file, 'name|name', '"name" on Card is not a function');
        });

        it('a_function_without_arguments_is_called_with_none', () => {
            expect(inFile(file).some(d => d.message.includes('"stamp()"'))).toBe(false);
        });

        it('attribute_values_are_checked_and_substitutions_are_left_alone', () => {
            expectFinding(file, 'titel', 'Card has no property "titel"');
            expect(inFile(file).some(d => d.message.includes('onEdit'))).toBe(false);
        });

        it('an_unclosed_mustache_is_reported', () => {
            expectFinding(file, '{{unclosed', '"{{" is never closed');
        });

        it('a_stored_template_is_checked_against_its_bind_call_in_the_same_file', () => {
            expectFinding(file, 'missing', 'Cannot resolve "missing": { present: number; } has no property "missing"');
        });

        it('a_template_bound_inside_an_arrow_or_a_class_is_checked', () => {
            expectFinding(file, 'lable', 'has no property "lable"');
            expectFinding(file, 'cuont', 'has no property "cuont"');
        });

        it('a_template_with_no_bind_call_in_the_file_is_skipped_with_a_reason', () => {
            const skipped = result.skipped.filter(s => s.file === fixture(file));
            expect(skipped.map(s => `${s.line}:${s.reason}`)).toEqual([
                `${at(file, 'unbound = html').line}:no bind call`,
                `${at(file, 'return html').line}:no bind call`,
            ]);
            expect(inFile(file).some(d => d.message.includes('anything'))).toBe(false);
        });
    });
});

describe('checkProject', () => {
    it('builds_the_program_from_a_tsconfig_and_reports_the_same_findings', () => {
        const fromConfig = checkProject(path.join(fixtures, 'tsconfig.json'));
        expect(fromConfig.diagnostics.map(formatDiagnostic).sort()).toEqual(result.diagnostics.map(formatDiagnostic).sort());
    });
});

describe('formatDiagnostic', () => {
    it('uses_the_tsc_line_format', () => {
        expect(formatDiagnostic({ file: 'src/Foo.ts', line: 42, column: 18, message: 'Cannot resolve "x"' }))
            .toBe('src/Foo.ts:42:18 - error: Cannot resolve "x"');
    });
});
