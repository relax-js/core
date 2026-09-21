import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
    outputPath,
    prerender,
    readSitemapPaths,
    type PageRenderer,
} from '../../src/prerender';

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemap.org/schemas/sitemap/0.9">
    <url><loc>https://shop.example/</loc></url>
    <url><loc>https://shop.example/products/5</loc><lastmod>2026-01-01</lastmod></url>
    <url><loc>https://shop.example/about/</loc></url>
    <url><loc>https://shop.example/search?q=x</loc></url>
    <url><loc>https://cdn.example/other/</loc></url>
</urlset>`;

describe('readSitemapPaths', () => {
    it('returns_each_loc_as_a_path_without_query_or_trailing_slash', () => {
        expect(readSitemapPaths(sitemap)).toEqual(['/', '/products/5', '/about', '/search']);
    });

    it('ignores_locs_on_a_different_host_than_the_first_one', () => {
        expect(readSitemapPaths(sitemap)).not.toContain('/other');
    });

    it('drops_duplicates', () => {
        const xml = '<urlset><url><loc>https://a/x</loc></url><url><loc>https://a/x/</loc></url></urlset>';
        expect(readSitemapPaths(xml)).toEqual(['/x']);
    });
});

describe('outputPath', () => {
    it('the_root_is_index_html_and_other_paths_get_their_own_folder', () => {
        expect(outputPath('/dist', '/')).toBe(path.join('/dist', 'index.html'));
        expect(outputPath('/dist', '/products/5')).toBe(path.join('/dist', 'products', '5', 'index.html'));
    });
});

describe('prerender', () => {
    let dist: string;
    const rendered: string[] = [];
    let closed = false;
    const renderer: PageRenderer = {
        async render(url) {
            rendered.push(url);
            return `<html><body>rendered ${url}</body></html>`;
        },
        async close() {
            closed = true;
        },
    };

    beforeEach(() => {
        dist = fs.mkdtempSync(path.join(os.tmpdir(), 'relaxjs-prerender-'));
        fs.writeFileSync(path.join(dist, 'index.html'), '<html><body>shell</body></html>');
        rendered.length = 0;
        closed = false;
    });

    afterEach(() => {
        fs.rmSync(dist, { recursive: true, force: true });
    });

    it('writes_one_html_file_per_sitemap_path_and_closes_the_renderer', async () => {
        fs.writeFileSync(path.join(dist, 'sitemap.xml'), sitemap);

        const result = await prerender({ dist, renderer, origin: 'http://127.0.0.1:1234' });

        expect(rendered).toEqual([
            'http://127.0.0.1:1234/products/5',
            'http://127.0.0.1:1234/about',
            'http://127.0.0.1:1234/search',
            'http://127.0.0.1:1234/',
        ]);
        expect(fs.readFileSync(path.join(dist, 'products', '5', 'index.html'), 'utf8')).toContain(
            'rendered http://127.0.0.1:1234/products/5'
        );
        expect(result.written).toEqual([
            path.join(dist, 'products', '5', 'index.html'),
            path.join(dist, 'about', 'index.html'),
            path.join(dist, 'search', 'index.html'),
            path.join(dist, 'index.html'),
        ]);
        expect(closed).toBe(true);
    });

    it('the_shell_index_html_is_only_replaced_when_the_sitemap_lists_the_root', async () => {
        fs.writeFileSync(
            path.join(dist, 'sitemap.xml'),
            '<urlset><url><loc>https://a/products/5</loc></url></urlset>'
        );

        await prerender({ dist, renderer, origin: 'http://127.0.0.1:1234' });

        expect(fs.readFileSync(path.join(dist, 'index.html'), 'utf8')).toBe('<html><body>shell</body></html>');
    });

    it('the_root_is_rendered_last_so_every_other_page_is_served_from_the_untouched_shell', async () => {
        fs.writeFileSync(
            path.join(dist, 'sitemap.xml'),
            '<urlset><url><loc>https://a/</loc></url><url><loc>https://a/b</loc></url></urlset>'
        );

        await prerender({ dist, renderer, origin: 'http://x' });

        expect(rendered).toEqual(['http://x/b', 'http://x/']);
    });

    it('a_missing_sitemap_is_an_error_that_names_the_file', async () => {
        await expect(prerender({ dist, renderer, origin: 'http://x' })).rejects.toThrow('sitemap.xml');
        expect(closed).toBe(true);
    });

    it('the_sitemap_location_can_be_overridden', async () => {
        const custom = path.join(dist, 'urls.xml');
        fs.writeFileSync(custom, '<urlset><url><loc>https://a/c</loc></url></urlset>');

        const result = await prerender({ dist, renderer, origin: 'http://x', sitemap: custom });

        expect(result.written).toEqual([path.join(dist, 'c', 'index.html')]);
    });
});
