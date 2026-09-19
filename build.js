const esbuild = require('esbuild');

/**
 * One build for every entry, with code splitting, so a module such as errors.ts or the route
 * table exists once in dist and every entry imports that same instance. Bundling each entry on
 * its own would give `@relax.js/core` and `@relax.js/core/routing` separate copies of shared
 * state, and an onError() handler registered through one would never see errors reported
 * through the other.
 */
const entryPoints = {
    index: 'src/index.ts',
    'html/index': 'src/html/index.ts',
    'http/index': 'src/http/index.ts',
    'forms/index': 'src/forms/index.ts',
    'routing/index': 'src/routing/index.ts',
    'i18n/index': 'src/i18n/index.ts',
    'elements/index': 'src/elements/index.ts',
    'utils/index': 'src/utils/index.ts',
    'di/index': 'src/di/index.ts',
    'collections/index': 'src/collections/Index.ts',
    'testing/index': 'src/testing/index.ts',
    'check/index': 'src/check/index.ts',
};

esbuild
    .build({
        entryPoints,
        outdir: 'dist',
        outExtension: { '.js': '.mjs' },
        format: 'esm',
        splitting: true,
        chunkNames: 'chunks/[name]-[hash]',
        bundle: true,
        external: ['typescript'],
        minify: true,
        target: 'es2022',
        sourcemap: true,
        preserveSymlinks: true,
    })
    .then(() => console.log('Build complete'))
    .catch(() => process.exit(1));
