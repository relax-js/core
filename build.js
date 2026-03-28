const esbuild = require('esbuild');

const entryPoints = [
    { entry: 'src/index.ts', out: 'index' },
    { entry: 'src/html/index.ts', out: 'html/index' },
    { entry: 'src/http/index.ts', out: 'http/index' },
    { entry: 'src/forms/index.ts', out: 'forms/index' },
    { entry: 'src/routing/index.ts', out: 'routing/index' },
    { entry: 'src/i18n/index.ts', out: 'i18n/index' },
    { entry: 'src/elements/index.ts', out: 'elements/index' },
    { entry: 'src/utils/index.ts', out: 'utils/index' },
    { entry: 'src/di/index.ts', out: 'di/index' },
    { entry: 'src/collections/Index.ts', out: 'collections/index' },
];

const commonOptions = {
    bundle: true,
    minify: true,
    target: 'es2022',
    sourcemap: true,
    preserveSymlinks: true,
};

async function build() {
    const builds = entryPoints.flatMap(({ entry, out }) => [
        esbuild.build({
            ...commonOptions,
            entryPoints: [entry],
            outfile: `dist/${out}.mjs`,
            format: 'esm',
        }),
        esbuild.build({
            ...commonOptions,
            entryPoints: [entry],
            outfile: `dist/${out}.js`,
            format: 'cjs',
        }),
    ]);

    await Promise.all(builds);
    console.log('Build complete');
}

build().catch(() => process.exit(1));
