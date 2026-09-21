# Crawlable pages

A Relaxjs page is rendered by the browser. Google runs that JavaScript, but on a deferred second pass, and most other readers of a URL do not run it at all: Bing only partly, link previews (Open Graph scrapers), feed readers, archive tools and the crawlers behind LLM search. What they see is the served HTML file. For a public page that means three things have to hold before any JavaScript runs:

1. Links between pages are real `<a href>` elements, so pages are discovered.
2. `<head>` carries the page's title, description, canonical URL and Open Graph tags.
3. The main content is in the body, not produced later by a component.

Nothing here applies to pages behind a login.

## Links

On public pages, link with plain anchors. `startRouting()` listens for clicks on any same-origin `<a href>` whose path matches a defined route and navigates client side; every other anchor (another origin, `target="_blank"`, `download`, `rel="external"`, a URL no route matches, a click with a modifier key) is left to the browser.

```html
<a href="/products/5">Red chair</a>
```

`<r-link>` has no `href` and is invisible to crawlers. Keep it for application UI that is not meant to be indexed.

## Head tags

Call `setPageMeta` from `loadRoute`, where the page's data has just arrived:

```ts
import { setPageMeta, type LoadRoute } from '@relax.js/core/routing';

class ProductPage extends HTMLElement implements LoadRoute<{ id: number }> {
    async loadRoute({ id }: { id: number }) {
        this.product = await api.getProduct(id);
        setPageMeta({
            title: this.product.name,
            description: this.product.summary,
            image: this.product.imageUrl,
            type: 'product',
            jsonLd: { '@context': 'https://schema.org', '@type': 'Product', name: this.product.name },
        });
    }
}
```

It writes `<title>`, `meta[name=description]`, `link[rel=canonical]`, `og:title`, `og:description`, `og:url`, `og:image`, `og:type`, `twitter:card`, `meta[name=robots]` and one `application/ld+json` script. `canonical` defaults to the current URL without its fragment, `type` to `website`.

A tag the server already put in `<head>` is updated in place. On the next navigation, tags `setPageMeta` created for a field the new page leaves out are removed, while server-emitted tags stay, so a site-wide default description survives pages that have none of their own.

## Getting content into the served HTML

Which route to take depends on who serves the page.

### Static host

Generate the HTML at build time. Put a `sitemap.xml` in `dist/` listing every public URL (you want one for search engines anyway), then after `vite build`:

```sh
npm install -D playwright
npx playwright install chromium
npx @relax.js/core prerender
```

`prerender` serves `dist/` locally with SPA fallback, opens each `<loc>` in headless Chromium, waits until `<r-route-target>` has rendered its page and the network is idle, and writes the DOM to `dist/<path>/index.html`. `/` becomes `dist/index.html` and is written last, so the shell every other page boots from stays intact while rendering.

Chromium is not a dependency of `@relax.js/core`; the command tells you what to install when it is missing. `--dist <dir>` and `--sitemap <file>` override the defaults. The same steps are available from code as `prerender()`, `createStaticServer()` and `createChromiumRenderer()` in `@relax.js/core/prerender`.

The written files keep the app's `<script type="module">` tags. In a browser the app boots on top of the prerendered page, `startRouting()` renders the route component and replaces the prerendered body with the live one. Static hosts serve `/products/5/index.html` for `/products/5` as a matter of course; keep the SPA fallback for URLs that are not in the sitemap.

Prerendered pages are as fresh as the last build. For content that changes between builds, rebuild on change or move that page to a server.

### Server-rendered host

When a backend answers each URL, let it write the page: the `<title>` and `<meta>` tags, and the content inside `<r-route-target>`:

```html
<head>
    <title>Red chair</title>
    <meta name="description" content="A chair, red.">
    <meta property="og:title" content="Red chair">
    <script type="module" src="/assets/app.js"></script>
</head>
<body>
    <r-route-target>
        <article>
            <h1>Red chair</h1>
            <p>A chair, red.</p>
        </article>
    </r-route-target>
    <script type="application/json" id="page-data">{"id":5,"name":"Red chair"}</script>
</body>
```

Write plain HTML inside the target, not the page component's own tag: an instance the server wrote would upgrade and run `connectedCallback` without route data before the router replaces it. Crawlers read the HTML as is. In a browser, `startRouting()` creates the route component and replaces what the server put in the target. `setPageMeta` updates the server's head tags in place. To avoid fetching the same data twice, `loadRoute` can read the embedded JSON first:

```ts
async loadRoute({ id }: { id: number }) {
    const embedded = document.getElementById('page-data');
    this.product = embedded ? JSON.parse(embedded.textContent!) : await api.getProduct(id);
    embedded?.remove();
}
```

## Not provided

- Rendering templates in Node. `compileTemplate` and `html` work on the DOM.
- Hydration. The client render replaces the served content; it does not attach to it.
