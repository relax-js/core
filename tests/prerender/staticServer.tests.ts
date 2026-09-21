import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createStaticServer, type StaticServer } from '../../src/prerender';

describe('createStaticServer', () => {
    let dist: string;
    let server: StaticServer;

    beforeAll(async () => {
        dist = fs.mkdtempSync(path.join(os.tmpdir(), 'relaxjs-static-'));
        fs.writeFileSync(path.join(dist, 'index.html'), '<html>shell</html>');
        fs.mkdirSync(path.join(dist, 'assets'));
        fs.writeFileSync(path.join(dist, 'assets', 'app.js'), 'console.log(1)');
        fs.writeFileSync(path.join(dist, 'sitemap.xml'), '<urlset></urlset>');
        server = await createStaticServer(dist);
    });

    afterAll(async () => {
        await server.close();
        fs.rmSync(dist, { recursive: true, force: true });
    });

    it('serves_files_with_a_content_type_from_the_extension', async () => {
        const response = await fetch(server.origin + '/assets/app.js');
        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('javascript');
        expect(await response.text()).toBe('console.log(1)');
    });

    it('falls_back_to_index_html_for_a_route_path', async () => {
        const response = await fetch(server.origin + '/products/5');
        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('text/html');
        expect(await response.text()).toBe('<html>shell</html>');
    });

    it('a_missing_file_with_an_extension_is_404_not_the_shell', async () => {
        const response = await fetch(server.origin + '/assets/missing.js');
        expect(response.status).toBe(404);
    });

    it('does_not_serve_files_outside_dist', async () => {
        const response = await fetch(server.origin + '/../package.json');
        expect(response.status).not.toBe(200);
    });
});
