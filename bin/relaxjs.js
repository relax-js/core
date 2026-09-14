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

module.exports = { initAgents, readStamp };

if (require.main === module) {
    const [command, ...args] = process.argv.slice(2);

    if (command === 'init-agents') {
        initAgents(args);
    } else {
        console.log('Usage: npx @relax.js/core init-agents [--force]');
        console.log('  Copies the Relaxjs agent skills into .claude/skills of this project.');
        console.log('  Run it again after upgrading to see which copies are behind.');
        process.exitCode = command ? 1 : 0;
    }
}
