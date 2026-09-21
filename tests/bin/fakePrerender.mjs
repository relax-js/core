/**
 * Stands in for dist/prerender so the CLI's wiring can be tested without a build or a
 * browser. Calls are shared through `globalThis` because the CLI imports this outside the
 * test runner's module graph.
 */
export async function createStaticServer(dist) {
    globalThis.fakePrerender.server = dist;
    return { origin: 'http://fake', close: async () => (globalThis.fakePrerender.serverClosed = true) };
}

export async function createChromiumRenderer() {
    if (globalThis.fakePrerender.playwrightMissing) {
        throw new Error("Cannot find package 'playwright'");
    }
    return { render: async () => '', close: async () => {} };
}

export async function prerender(options) {
    globalThis.fakePrerender.options = options;
    options.log?.('/a -> a/index.html');
    if (globalThis.fakePrerender.fail) {
        throw new Error(globalThis.fakePrerender.fail);
    }
    return { written: ['a/index.html', 'b/index.html'] };
}
