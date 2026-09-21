/**
 * Writes a static HTML file per public URL of a client-rendered site, so crawlers that do not
 * run JavaScript still see the page's content and meta tags.
 *
 * The site's own `sitemap.xml` decides which URLs are rendered. Each one is opened in headless
 * Chromium against a local server that serves `dist/` with SPA fallback, and the rendered DOM
 * is saved as `dist/<path>/index.html`. The app's script tags stay in the file, so the page
 * boots normally in a browser and the route component takes over.
 *
 * Reached through `npx @relax.js/core prerender` after `vite build`. Chromium is not a
 * dependency of the library: install `playwright` and its Chromium in the project first.
 */
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';

/**
 * Produces the final HTML of one URL. The CLI uses Chromium; tests substitute a fake.
 */
export interface PageRenderer {
    render(url: string): Promise<string>;
    close(): Promise<void>;
}

export interface PrerenderOptions {
    /** Absolute path of the built site. */
    dist: string;

    /** Origin of a server that serves `dist`, for example `http://127.0.0.1:4173`. */
    origin: string;

    renderer: PageRenderer;

    /** Defaults to `<dist>/sitemap.xml`. */
    sitemap?: string;

    log?: (line: string) => void;
}

export interface PrerenderResult {
    written: string[];
}

/**
 * Renders every path in the sitemap and writes the result under `dist`. The root path is
 * written last because `dist/index.html` is also the SPA fallback the server hands out for
 * every other path while rendering, and it has to stay the plain shell until the end.
 */
export async function prerender(options: PrerenderOptions): Promise<PrerenderResult> {
    const { dist, origin, renderer } = options;
    const log = options.log ?? (() => {});
    const sitemapFile = options.sitemap ?? path.join(dist, 'sitemap.xml');
    const written: string[] = [];

    try {
        if (!fs.existsSync(sitemapFile)) {
            throw new Error(
                `No sitemap found at ${sitemapFile}. The prerender command renders the URLs listed in it.`
            );
        }

        const paths = readSitemapPaths(fs.readFileSync(sitemapFile, 'utf8'));
        const ordered = [...paths.filter(p => p !== '/'), ...paths.filter(p => p === '/')];
        for (const pathname of ordered) {
            const html = await renderer.render(origin + pathname);
            const file = outputPath(dist, pathname);
            fs.mkdirSync(path.dirname(file), { recursive: true });
            fs.writeFileSync(file, html);
            written.push(file);
            log(`${pathname} -> ${path.relative(dist, file).split(path.sep).join('/')}`);
        }
    } finally {
        await renderer.close();
    }

    return { written };
}

/**
 * Paths of the `<loc>` entries that share the first entry's host, without query string,
 * fragment or trailing slash, and without duplicates.
 */
export function readSitemapPaths(xml: string): string[] {
    const paths: string[] = [];
    let host: string | undefined;
    for (const match of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
        const url = new URL(match[1]);
        host ??= url.host;
        if (url.host !== host) continue;
        const pathname = url.pathname.replace(/\/+$/, '') || '/';
        if (!paths.includes(pathname)) paths.push(pathname);
    }
    return paths;
}

/**
 * File a static host serves for the path: `/` is `index.html`, `/a/b` is `a/b/index.html`.
 */
export function outputPath(dist: string, pathname: string): string {
    const segments = pathname.split('/').filter(Boolean);
    return path.join(dist, ...segments, 'index.html');
}

export interface StaticServer {
    origin: string;
    close(): Promise<void>;
}

const CONTENT_TYPES: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.txt': 'text/plain; charset=utf-8',
};

/**
 * Serves `dist` on a random local port the way a static host with SPA fallback does: an
 * existing file is served as is, any other extensionless path gets `index.html`.
 */
export function createStaticServer(dist: string): Promise<StaticServer> {
    const root = path.resolve(dist);
    const server = http.createServer((request, response) => {
        const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
        const requested = path.resolve(root, '.' + pathname);
        if (!requested.startsWith(root)) {
            response.writeHead(403).end();
            return;
        }

        let file = requested;
        if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
            if (path.extname(pathname)) {
                response.writeHead(404).end();
                return;
            }
            file = path.join(root, 'index.html');
        }

        response.writeHead(200, {
            'content-type': CONTENT_TYPES[path.extname(file)] ?? 'application/octet-stream',
        });
        fs.createReadStream(file).pipe(response);
    });

    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            if (!address || typeof address === 'string') {
                reject(new Error('Static server did not get a TCP port'));
                return;
            }
            resolve({
                origin: `http://127.0.0.1:${address.port}`,
                close: () => new Promise((done, fail) => server.close(err => (err ? fail(err) : done()))),
            });
        });
    });
}

interface ChromiumPage {
    goto(url: string, options?: { waitUntil?: string }): Promise<unknown>;
    waitForFunction(fn: string, arg?: unknown, options?: { timeout?: number }): Promise<unknown>;
    waitForLoadState(state: string): Promise<void>;
    content(): Promise<string>;
    close(): Promise<void>;
}

interface ChromiumBrowser {
    newPage(): Promise<ChromiumPage>;
    close(): Promise<void>;
}

interface PlaywrightModule {
    chromium: { launch(): Promise<ChromiumBrowser> };
}

/**
 * The renderer the CLI uses. Loads `playwright` at call time so the library itself has no
 * dependency on it; the caller decides what a failed import means.
 */
export async function createChromiumRenderer(): Promise<PageRenderer> {
    const moduleName = 'playwright';
    const playwright = (await import(moduleName)) as PlaywrightModule;
    const browser = await playwright.chromium.launch();
    return {
        async render(url) {
            const page = await browser.newPage();
            try {
                await page.goto(url, { waitUntil: 'networkidle' });
                await page.waitForFunction(
                    '!!document.querySelector("r-route-target")?.firstElementChild',
                    undefined,
                    { timeout: 30_000 }
                );
                await page.waitForLoadState('networkidle');
                return await page.content();
            } finally {
                await page.close();
            }
        },
        close: () => browser.close(),
    };
}
