import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { check } = require('../../bin/relaxjs.js');

const checkerModule = pathToFileURL(path.join(__dirname, 'fakeChecker.mjs')).href;

async function run(args: string[], options: Record<string, unknown> = {}) {
    const lines: string[] = [];
    const code = await check(args, { checkerModule, project: __dirname, log: (l: string) => lines.push(l), ...options });
    return { code, lines };
}

describe('check', () => {
    it('prints_each_finding_in_tsc_line_format_and_exits_with_1', async () => {
        const { code, lines } = await run([]);
        expect(lines[0]).toBe('src/A.ts:3:7 - error: Cannot resolve "x"');
        expect(code).toBe(1);
    });

    it('the_summary_states_what_was_checked_and_why_the_rest_was_skipped', async () => {
        const { lines } = await run([]);
        expect(lines[lines.length - 1]).toBe('\n5 templates checked, 3 skipped (1 no type argument, 2 not a literal)');
    });

    it('a_clean_project_exits_with_0_and_a_summary_without_a_skipped_part', async () => {
        const { code, lines } = await run(['--project', 'clean.json']);
        expect(lines).toEqual(['4 templates checked']);
        expect(code).toBe(0);
    });

    it('tsconfig_defaults_to_the_working_directory_and_follows_project_flag', async () => {
        const calls: string[] = ((globalThis as any).fakeCheckerCalls = []);
        await run([]);
        await run(['--project', 'sub/clean.json']);
        expect(calls).toEqual([
            path.join(__dirname, 'tsconfig.json'),
            path.join(__dirname, 'sub', 'clean.json'),
        ]);
    });

    it('a_missing_checker_module_explains_that_typescript_is_needed', async () => {
        const { code, lines } = await run([], { checkerModule: pathToFileURL(path.join(__dirname, 'nope.mjs')).href });
        expect(code).toBe(1);
        expect(lines[0]).toContain('npm install -D typescript');
    });
});
