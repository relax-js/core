/**
 * What crawlers, link previews and the browser tab should know about the current page.
 * Every field is optional; what is left out is not written.
 */
export interface PageMeta {
    title?: string;
    description?: string;

    /**
     * The URL search engines should index for this page, also written as `og:url`.
     * Defaults to the current URL without its fragment.
     */
    canonical?: string;

    /**
     * Absolute URL of the preview image (`og:image`). Link previews ignore relative paths.
     */
    image?: string;

    /**
     * `og:type`, for example `article` or `product`. Defaults to `website`.
     */
    type?: string;

    /**
     * Value for `<meta name="robots">`, for example `noindex`.
     */
    robots?: string;

    /**
     * Structured data written as one `application/ld+json` script.
     */
    jsonLd?: object | object[];
}

const OWNED = 'data-page-meta';

/**
 * Writes the page's `<head>` tags for the route being shown: title, description, canonical
 * link, Open Graph, robots and JSON-LD. Call it from `loadRoute` so each SPA navigation
 * updates what search engines, link previews and the browser tab see.
 *
 * A tag the server already put in `<head>` is updated in place. Tags this function created
 * are removed again on a later call that leaves the field out, while server-emitted tags are
 * kept, so a page without a description of its own falls back to the site's default.
 *
 * @example
 * class ProductPage extends HTMLElement implements LoadRoute<{ id: number }> {
 *     async loadRoute({ id }: { id: number }) {
 *         this.product = await api.getProduct(id);
 *         setPageMeta({
 *             title: this.product.name,
 *             description: this.product.summary,
 *             image: this.product.imageUrl,
 *             type: 'product',
 *         });
 *     }
 * }
 */
export function setPageMeta(meta: PageMeta): void {
    const canonical = meta.canonical ?? currentUrlWithoutFragment();

    if (meta.title !== undefined) {
        document.title = meta.title;
    }

    setTag('meta', { name: 'description' }, 'content', meta.description);
    setTag('meta', { name: 'robots' }, 'content', meta.robots);
    setTag('link', { rel: 'canonical' }, 'href', canonical);
    setTag('meta', { property: 'og:title' }, 'content', meta.title);
    setTag('meta', { property: 'og:description' }, 'content', meta.description);
    setTag('meta', { property: 'og:url' }, 'content', canonical);
    setTag('meta', { property: 'og:image' }, 'content', meta.image);
    setTag('meta', { property: 'og:type' }, 'content', meta.type ?? 'website');
    setTag(
        'meta',
        { name: 'twitter:card' },
        'content',
        meta.image ? 'summary_large_image' : 'summary'
    );
    setJsonLd(meta.jsonLd);
}

function currentUrlWithoutFragment(): string {
    return window.location.href.replace(/#.*$/, '');
}

/**
 * Upserts one head tag identified by its attributes (`name`, `property` or `rel`).
 * `undefined` removes the tag only if this module created it.
 */
function setTag(
    tagName: 'meta' | 'link',
    identity: Record<string, string>,
    valueAttribute: 'content' | 'href',
    value: string | undefined
): void {
    const selector =
        tagName +
        Object.entries(identity)
            .map(([key, val]) => `[${key}="${val}"]`)
            .join('');
    const existing = document.head.querySelector<HTMLElement>(selector);

    if (value === undefined) {
        if (existing?.hasAttribute(OWNED)) {
            existing.remove();
        }
        return;
    }

    if (existing) {
        existing.setAttribute(valueAttribute, value);
        return;
    }

    const element = document.createElement(tagName);
    for (const [key, val] of Object.entries(identity)) {
        element.setAttribute(key, val);
    }
    element.setAttribute(valueAttribute, value);
    element.setAttribute(OWNED, '');
    document.head.appendChild(element);
}

function setJsonLd(data: object | object[] | undefined): void {
    const existing = document.head.querySelector(`script[type="application/ld+json"][${OWNED}]`);
    if (data === undefined) {
        existing?.remove();
        return;
    }

    const script = existing ?? document.createElement('script');
    script.setAttribute('type', 'application/ld+json');
    script.setAttribute(OWNED, '');
    script.textContent = JSON.stringify(data);
    if (!existing) {
        document.head.appendChild(script);
    }
}
