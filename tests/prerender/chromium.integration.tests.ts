import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createChromiumRenderer, createStaticServer, prerender, type StaticServer } from '../../src/prerender';

/**
 * Runs against a real Chromium. Needs `npm i -D playwright && npx playwright install chromium`
 * and RELAXJS_PRERENDER_BROWSER=1, otherwise the suite is skipped.
 */
const enabled = process.env.RELAXJS_PRERENDER_BROWSER === '1';

const shell = `<!DOCTYPE html>
<html><head><title>Shell</title></head>
<body>
<r-route-target></r-route-target>
<script type="module">
    const data = await (await fetch('/page.json')).json();
    document.title = data.title;
    const page = document.createElement('article');
    page.textContent = data.body + ' at ' + location.pathname;
    document.querySelector('r-route-target').replaceChildren(page);
</script>
</body></html>`;

describe.skipIf(!enabled)('prerender with Chromium', () => {
    let dist: string;
    let server: StaticServer;

    beforeAll(async () => {
        dist = fs.mkdtempSync(path.join(os.tmpdir(), 'relaxjs-chromium-'));
        fs.writeFileSync(path.join(dist, 'index.html'), shell);
        fs.writeFileSync(path.join(dist, 'page.json'), JSON.stringify({ title: 'Red chair', body: 'A chair' }));
        fs.writeFileSync(
            path.join(dist, 'sitemap.xml'),
            '<urlset><url><loc>https://a/</loc></url><url><loc>https://a/products/5</loc></url></urlset>'
        );
        server = await createStaticServer(dist);
    });

    afterAll(async () => {
        await server.close();
        fs.rmSync(dist, { recursive: true, force: true });
    });

    it('the_written_html_contains_what_the_page_rendered_after_its_data_arrived', async () => {
        const renderer = await createChromiumRenderer();

        await prerender({ dist, origin: server.origin, renderer });

        const product = fs.readFileSync(path.join(dist, 'products', '5', 'index.html'), 'utf8');
        expect(product).toContain('<title>Red chair</title>');
        expect(product).toContain('A chair at /products/5');
        expect(product).toContain('<script type="module">');
        expect(fs.readFileSync(path.join(dist, 'index.html'), 'utf8')).toContain('A chair at /');
    }, 60_000);
});
