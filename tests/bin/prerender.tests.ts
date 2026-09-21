import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { prerender } = require('../../bin/relaxjs.js');

const prerenderModule = pathToFileURL(path.join(__dirname, 'fakePrerender.mjs')).href;

async function run(args: string[], options: Record<string, unknown> = {}) {
    const lines: string[] = [];
    const code = await prerender(args, {
        prerenderModule,
        project: __dirname,
        log: (l: string) => lines.push(l),
        ...options,
    });
    return { code, lines };
}

describe('prerender command', () => {
    beforeEach(() => {
        (globalThis as any).fakePrerender = {};
    });

    it('serves_dist_of_the_working_directory_by_default_and_follows_the_dist_flag', async () => {
        await run([]);
        expect((globalThis as any).fakePrerender.server).toBe(path.join(__dirname, 'dist'));

        await run(['--dist', 'build/site']);
        expect((globalThis as any).fakePrerender.server).toBe(path.join(__dirname, 'build', 'site'));
    });

    it('passes_the_server_origin_and_sitemap_flag_on_and_closes_the_server', async () => {
        const { code, lines } = await run(['--sitemap', 'urls.xml']);

        const options = (globalThis as any).fakePrerender.options;
        expect(options.origin).toBe('http://fake');
        expect(options.sitemap).toBe(path.join(__dirname, 'urls.xml'));
        expect((globalThis as any).fakePrerender.serverClosed).toBe(true);
        expect(code).toBe(0);
        expect(lines).toEqual(['/a -> a/index.html', '\n2 pages written']);
    });

    it('a_missing_playwright_explains_what_to_install', async () => {
        (globalThis as any).fakePrerender.playwrightMissing = true;

        const { code, lines } = await run([]);

        expect(code).toBe(1);
        expect(lines[0]).toContain('npm install -D playwright && npx playwright install chromium');
        expect((globalThis as any).fakePrerender.serverClosed).toBe(true);
    });

    it('a_failed_render_prints_the_reason_and_exits_with_1', async () => {
        (globalThis as any).fakePrerender.fail = 'No sitemap found at x';

        const { code, lines } = await run([]);

        expect(code).toBe(1);
        expect(lines[lines.length - 1]).toBe('No sitemap found at x');
    });

    it('a_missing_prerender_module_is_reported_rather_than_thrown', async () => {
        const { code, lines } = await run([], {
            prerenderModule: pathToFileURL(path.join(__dirname, 'nope.mjs')).href,
        });

        expect(code).toBe(1);
        expect(lines[0]).toContain('nope.mjs');
    });
});
