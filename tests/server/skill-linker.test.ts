import { mkdirSync, mkdtempSync, writeFileSync, existsSync, lstatSync, readlinkSync, readdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { linkSkills } from '@server/services/skill-linker.js';

function setupTempDirs() {
  const base = mkdtempSync(join(tmpdir(), 'skill-linker-test-'));
  const skillsDir = join(base, 'skills');
  const agentsDir = join(base, '.agents', 'skills');
  mkdirSync(skillsDir, { recursive: true });
  return { base, skillsDir, agentsDir };
}

function createSkill(skillsDir: string, name: string) {
  const dir = join(skillsDir, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'SKILL.md'), `---\nname: ${name}\n---\nContent`);
}

describe('skill-linker', () => {
  it('creates symlinks for each skill directory', () => {
    const { skillsDir, agentsDir } = setupTempDirs();
    createSkill(skillsDir, 'test-skill');
    createSkill(skillsDir, 'another-skill');

    linkSkills(skillsDir, agentsDir);

    expect(existsSync(join(agentsDir, 'test-skill'))).toBe(true);
    expect(existsSync(join(agentsDir, 'another-skill'))).toBe(true);
    expect(lstatSync(join(agentsDir, 'test-skill')).isSymbolicLink()).toBe(true);
  });

  it('symlinks point to the correct source directories', () => {
    const { skillsDir, agentsDir } = setupTempDirs();
    createSkill(skillsDir, 'my-skill');

    linkSkills(skillsDir, agentsDir);

    const target = readlinkSync(join(agentsDir, 'my-skill'));
    expect(target).toBe(join(skillsDir, 'my-skill'));
  });

  it('is idempotent', () => {
    const { skillsDir, agentsDir } = setupTempDirs();
    createSkill(skillsDir, 'repeat-skill');

    linkSkills(skillsDir, agentsDir);
    linkSkills(skillsDir, agentsDir);

    const entries = readdirSync(agentsDir);
    expect(entries).toEqual(['repeat-skill']);
    expect(lstatSync(join(agentsDir, 'repeat-skill')).isSymbolicLink()).toBe(true);
  });

  it('skips non-directory entries in skills/', () => {
    const { skillsDir, agentsDir } = setupTempDirs();
    createSkill(skillsDir, 'real-skill');
    writeFileSync(join(skillsDir, 'README.md'), 'not a skill');

    linkSkills(skillsDir, agentsDir);

    const entries = readdirSync(agentsDir);
    expect(entries).toEqual(['real-skill']);
  });

  it('handles missing skills/ directory gracefully', () => {
    const base = mkdtempSync(join(tmpdir(), 'skill-linker-test-'));
    const missing = join(base, 'no-such-dir');
    const agentsDir = join(base, '.agents', 'skills');

    expect(() => linkSkills(missing, agentsDir)).not.toThrow();
    expect(existsSync(agentsDir)).toBe(false);
  });
});
