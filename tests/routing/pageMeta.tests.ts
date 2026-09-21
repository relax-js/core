import { describe, it, expect, beforeEach } from 'vitest';
import { setPageMeta } from '../../src/routing/pageMeta';

function meta(selector: string): string | null {
    return document.head.querySelector(selector)?.getAttribute('content') ?? null;
}

describe('setPageMeta', () => {
    beforeEach(() => {
        document.head.innerHTML = '';
    });

    it('creates_title_description_canonical_and_open_graph_tags_on_first_call', () => {
        setPageMeta({
            title: 'Red chair',
            description: 'A chair, red.',
            canonical: 'https://shop.example/products/5',
            image: 'https://shop.example/img/5.jpg',
            type: 'product',
        });

        expect(document.title).toBe('Red chair');
        expect(meta('meta[name="description"]')).toBe('A chair, red.');
        expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
            'https://shop.example/products/5'
        );
        expect(meta('meta[property="og:title"]')).toBe('Red chair');
        expect(meta('meta[property="og:description"]')).toBe('A chair, red.');
        expect(meta('meta[property="og:url"]')).toBe('https://shop.example/products/5');
        expect(meta('meta[property="og:image"]')).toBe('https://shop.example/img/5.jpg');
        expect(meta('meta[property="og:type"]')).toBe('product');
        expect(meta('meta[name="twitter:card"]')).toBe('summary_large_image');
    });

    it('og_type_defaults_to_website_and_twitter_card_to_summary_without_an_image', () => {
        setPageMeta({ title: 'Home' });

        expect(meta('meta[property="og:type"]')).toBe('website');
        expect(meta('meta[name="twitter:card"]')).toBe('summary');
    });

    it('canonical_defaults_to_the_current_url_without_the_fragment', () => {
        history.replaceState(null, '', '/products/5?ref=mail#reviews');

        setPageMeta({ title: 'Red chair' });

        expect(meta('meta[property="og:url"]')).toBe('http://localhost:3000/products/5?ref=mail');
        expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
            'http://localhost:3000/products/5?ref=mail'
        );
    });

    it('updates_tags_the_server_emitted_in_place_instead_of_adding_duplicates', () => {
        document.head.innerHTML =
            '<title>Old</title>' +
            '<meta name="description" content="old">' +
            '<meta property="og:title" content="old">';

        setPageMeta({ title: 'New', description: 'new' });

        expect(document.head.querySelectorAll('title').length).toBe(1);
        expect(document.head.querySelectorAll('meta[name="description"]').length).toBe(1);
        expect(document.head.querySelectorAll('meta[property="og:title"]').length).toBe(1);
        expect(document.title).toBe('New');
        expect(meta('meta[name="description"]')).toBe('new');
        expect(meta('meta[property="og:title"]')).toBe('New');
    });

    it('a_later_call_removes_its_own_tags_for_keys_it_no_longer_sets', () => {
        setPageMeta({ title: 'A', description: 'a', image: 'https://x/a.jpg', robots: 'noindex' });
        setPageMeta({ title: 'B' });

        expect(document.head.querySelector('meta[name="description"]')).toBeNull();
        expect(document.head.querySelector('meta[property="og:image"]')).toBeNull();
        expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
        expect(meta('meta[name="twitter:card"]')).toBe('summary');
    });

    it('a_later_call_leaves_server_emitted_tags_alone_when_it_omits_the_key', () => {
        document.head.innerHTML = '<meta name="description" content="from server">';

        setPageMeta({ title: 'A' });

        expect(meta('meta[name="description"]')).toBe('from server');
    });

    it('json_ld_is_written_as_one_script_and_replaced_on_the_next_call', () => {
        setPageMeta({ jsonLd: { '@type': 'Product', name: 'A' } });
        setPageMeta({ jsonLd: [{ '@type': 'Product', name: 'B' }, { '@type': 'Organization' }] });

        const scripts = document.head.querySelectorAll('script[type="application/ld+json"]');
        expect(scripts.length).toBe(1);
        expect(JSON.parse(scripts[0].textContent!)).toEqual([
            { '@type': 'Product', name: 'B' },
            { '@type': 'Organization' },
        ]);

        setPageMeta({ title: 'No structured data' });
        expect(document.head.querySelector('script[type="application/ld+json"]')).toBeNull();
    });
});
