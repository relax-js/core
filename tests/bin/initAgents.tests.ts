import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { initAgents, readStamp } = require('../../bin/relaxjs.js');

function fakePackage(root: string, version: string) {
    fs.mkdirSync(path.join(root, 'skills', 'relaxjs'), { recursive: true });
    fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version }));
    fs.writeFileSync(
        path.join(root, 'skills', 'relaxjs', 'SKILL.md'),
        '---\nname: relaxjs\ndescription: test\n---\n\nSee @relax.js/core/docs/GettingStarted.md\n',
    );
}

describe('init-agents', () => {
    let tmp: string;
    let project: string;
    let packageRoot: string;
    const silent = () => {};

    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'relaxjs-init-agents-'));
        project = path.join(tmp, 'project');
        packageRoot = path.join(project, 'node_modules', '@relax.js', 'core');
        fs.mkdirSync(project, { recursive: true });
        fakePackage(packageRoot, '1.7.0');
    });

    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('a_copied_skill_carries_the_version_of_the_package_it_came_from', () => {
        initAgents([], { project, packageRoot, log: silent });

        const copied = path.join(project, '.claude', 'skills', 'relaxjs', 'SKILL.md');
        expect(readStamp(fs.readFileSync(copied, 'utf8'))).toBe('1.7.0');
    });

    it('doc_references_are_rewritten_to_the_installed_package', () => {
        initAgents([], { project, packageRoot, log: silent });

        const copied = fs.readFileSync(
            path.join(project, '.claude', 'skills', 'relaxjs', 'SKILL.md'),
            'utf8',
        );
        expect(copied).toContain('See node_modules/@relax.js/core/docs/GettingStarted.md');
    });

    it('a_skill_copied_from_an_older_package_is_reported_as_behind_after_an_upgrade', () => {
        initAgents([], { project, packageRoot, log: silent });
        fakePackage(packageRoot, '1.8.0');

        const result = initAgents([], { project, packageRoot, log: silent });

        expect(result.written).toEqual([]);
        expect(result.behind).toEqual([{ name: 'relaxjs', version: '1.7.0' }]);
        expect(result.installedVersion).toBe('1.8.0');
    });

    it('a_skill_that_matches_the_installed_version_is_left_alone_and_not_reported', () => {
        initAgents([], { project, packageRoot, log: silent });

        const result = initAgents([], { project, packageRoot, log: silent });

        expect(result.written).toEqual([]);
        expect(result.behind).toEqual([]);
        expect(result.current).toEqual(['relaxjs']);
    });

    it('a_skill_without_a_stamp_is_reported_as_behind_because_its_origin_is_unknown', () => {
        const target = path.join(project, '.claude', 'skills', 'relaxjs', 'SKILL.md');
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, '---\nname: relaxjs\n---\nedited by hand\n');

        const result = initAgents([], { project, packageRoot, log: silent });

        expect(result.behind).toEqual([{ name: 'relaxjs', version: null }]);
    });

    it('force_replaces_a_skill_that_is_behind_and_brings_its_stamp_up_to_date', () => {
        initAgents([], { project, packageRoot, log: silent });
        fakePackage(packageRoot, '1.8.0');

        const result = initAgents(['--force'], { project, packageRoot, log: silent });

        const copied = path.join(project, '.claude', 'skills', 'relaxjs', 'SKILL.md');
        expect(result.written).toEqual(['relaxjs']);
        expect(readStamp(fs.readFileSync(copied, 'utf8'))).toBe('1.8.0');
    });
});
