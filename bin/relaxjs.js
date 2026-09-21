#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const DOC_PREFIX = '@relax.js/core/docs/';
const STAMP = /^<!-- @relax\.js\/core (\S+) -->$/m;

/**
 * Path the copied skills should use to reach the installed documentation.
 * Relative to the project when the package sits under it, absolute otherwise.
 */
function resolveDocsReference(project, docsDir) {
    const relative = path.relative(project, docsDir).split(path.sep).join('/');
    return relative.startsWith('..') ? docsDir.split(path.sep).join('/') : relative;
}

/**
 * Version of the package a copied skill was taken from, or `null` when the file
 * carries no stamp. A skill in `.claude/skills` is a snapshot, and without the
 * stamp nothing can tell whether it still describes the installed library.
 */
function readStamp(content) {
    const match = content.match(STAMP);
    return match ? match[1] : null;
}

function stamp(content, version) {
    const marker = `<!-- @relax.js/core ${version} -->`;
    const frontmatterEnd = content.indexOf('\n---', 3);
    if (content.startsWith('---') && frontmatterEnd !== -1) {
        const cut = frontmatterEnd + '\n---'.length;
        return content.slice(0, cut) + '\n' + marker + content.slice(cut);
    }
    return marker + '\n' + content;
}

function initAgents(args, options = {}) {
    const force = args.includes('--force');
    const project = options.project ?? process.cwd();
    const packageRoot = options.packageRoot ?? path.join(__dirname, '..');
    const log = options.log ?? console.log;

    const skillsDir = path.join(packageRoot, 'skills');
    const docsDir = path.join(packageRoot, 'docs');
    if (!fs.existsSync(skillsDir)) {
        throw new Error(`No skills found in the package (looked in ${skillsDir})`);
    }

    const installedVersion = JSON.parse(
        fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'),
    ).version;
    const docsReference = resolveDocsReference(project, docsDir) + '/';
    const targetRoot = path.join(project, '.claude', 'skills');
    const written = [];
    const current = [];
    const behind = [];

    for (const name of fs.readdirSync(skillsDir)) {
        const source = path.join(skillsDir, name, 'SKILL.md');
        if (!fs.existsSync(source)) continue;

        const target = path.join(targetRoot, name, 'SKILL.md');
        if (fs.existsSync(target) && !force) {
            const version = readStamp(fs.readFileSync(target, 'utf8'));
            if (version === installedVersion) {
                current.push(name);
            } else {
                behind.push({ name, version });
            }
            continue;
        }

        const content = fs.readFileSync(source, 'utf8').split(DOC_PREFIX).join(docsReference);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, stamp(content, installedVersion));
        written.push(name);
    }

    if (written.length) {
        log(`Wrote ${written.length} skill(s) from @relax.js/core ${installedVersion} to .claude/skills:`);
        for (const name of written) log(`  ${name}`);
    } else {
        log('No skills written.');
    }

    if (current.length) {
        log(`\n${current.length} skill(s) already match @relax.js/core ${installedVersion}.`);
    }

    if (behind.length) {
        log(`\n${behind.length} skill(s) are behind the installed @relax.js/core ${installedVersion}, use --force to replace:`);
        for (const { name, version } of behind) {
            log(`  ${name} (${version ? `from ${version}` : 'no version stamp'})`);
        }
    }

    log(`\nDocumentation referenced at ${docsReference}`);

    return { installedVersion, written, current, behind };
}

/**
 * Runs the static template checker over the project's tsconfig and prints the
 * findings in tsc's line format. Exit code 1 when anything was found.
 */
async function check(args, options = {}) {
    const log = options.log ?? console.log;
    const projectFlag = args.indexOf('--project');
    const tsconfig = path.resolve(
        options.project ?? process.cwd(),
        projectFlag !== -1 && args[projectFlag + 1] ? args[projectFlag + 1] : 'tsconfig.json',
    );

    let checker;
    try {
        checker = await import(options.checkerModule ?? '../dist/check/index.mjs');
    } catch (error) {
        log(`The checker needs the typescript package: npm install -D typescript (${error.message})`);
        return 1;
    }

    const result = checker.checkProject(tsconfig);
    const cwd = process.cwd();
    for (const diagnostic of result.diagnostics) {
        const file = path.relative(cwd, diagnostic.file).split(path.sep).join('/') || diagnostic.file;
        log(checker.formatDiagnostic({ ...diagnostic, file }));
    }

    const byReason = ['no type argument', 'not a literal', 'no bind call']
        .map(reason => [result.skipped.filter(s => s.reason === reason).length, reason])
        .filter(([count]) => count > 0)
        .map(([count, reason]) => `${count} ${reason}`);
    const skipped = result.skipped.length
        ? `, ${result.skipped.length} skipped (${byReason.join(', ')})`
        : '';
    log(`${result.diagnostics.length ? '\n' : ''}${result.templates} templates checked${skipped}`);

    return result.diagnostics.length ? 1 : 0;
}

function flagValue(args, flag) {
    const index = args.indexOf(flag);
    return index !== -1 && args[index + 1] ? args[index + 1] : undefined;
}

/**
 * Renders every URL in the site's sitemap with headless Chromium and writes the HTML into
 * dist, so crawlers get the content without running the app. Chromium comes from the
 * project's own playwright install; the library does not depend on it.
 */
async function prerender(args, options = {}) {
    const log = options.log ?? console.log;
    const project = options.project ?? process.cwd();
    const dist = path.resolve(project, flagValue(args, '--dist') ?? 'dist');
    const sitemapFlag = flagValue(args, '--sitemap');
    const sitemap = sitemapFlag ? path.resolve(project, sitemapFlag) : undefined;

    let module;
    try {
        module = await import(options.prerenderModule ?? '../dist/prerender/index.mjs');
    } catch (error) {
        log(`Could not load the prerender module: ${error.message}`);
        return 1;
    }

    const server = await module.createStaticServer(dist);
    try {
        let renderer;
        try {
            renderer = await module.createChromiumRenderer();
        } catch (error) {
            log(
                `The prerender command needs a browser: npm install -D playwright && npx playwright install chromium (${error.message})`,
            );
            return 1;
        }

        const result = await module.prerender({ dist, origin: server.origin, renderer, sitemap, log });
        log(`\n${result.written.length} page${result.written.length === 1 ? '' : 's'} written`);
        return 0;
    } catch (error) {
        log(error.message);
        return 1;
    } finally {
        await server.close();
    }
}

module.exports = { initAgents, readStamp, check, prerender };

if (require.main === module) {
    const [command, ...args] = process.argv.slice(2);

    if (command === 'init-agents') {
        initAgents(args);
    } else if (command === 'check') {
        check(args).then(code => {
            process.exitCode = code;
        });
    } else if (command === 'prerender') {
        prerender(args).then(code => {
            process.exitCode = code;
        });
    } else {
        console.log('Usage: npx @relax.js/core <command>');
        console.log('  init-agents [--force]');
        console.log('    Copies the Relaxjs agent skills into .claude/skills of this project.');
        console.log('    Run it again after upgrading to see which copies are behind.');
        console.log('  check [--project <tsconfig.json>]');
        console.log('    Checks every compileTemplate<T, F>(`...`) template against its types.');
        console.log('  prerender [--dist <dir>] [--sitemap <file>]');
        console.log('    Writes dist/<path>/index.html for every URL in dist/sitemap.xml, rendered');
        console.log('    with headless Chromium (needs playwright installed in the project).');
        process.exitCode = command ? 1 : 0;
    }
}
