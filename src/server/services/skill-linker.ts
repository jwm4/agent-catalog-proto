import { existsSync, mkdirSync, readdirSync, symlinkSync, unlinkSync, lstatSync } from 'fs';
import { join, resolve } from 'path';

export function linkSkills(skillsSource?: string, agentsTarget?: string): void {
  const srcDir = skillsSource ?? join(process.cwd(), 'skills');
  const tgtDir = agentsTarget ?? join(process.cwd(), '.agents', 'skills');

  if (!existsSync(srcDir)) {
    console.warn('[skills] No skills/ directory found, skipping skill linking');
    return;
  }

  mkdirSync(tgtDir, { recursive: true });

  const entries = readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const linkPath = join(tgtDir, entry.name);
    const targetPath = resolve(srcDir, entry.name);

    if (existsSync(linkPath)) {
      const stat = lstatSync(linkPath);
      if (stat.isSymbolicLink()) {
        unlinkSync(linkPath);
      } else {
        continue;
      }
    }

    symlinkSync(targetPath, linkPath);
  }

  console.log(`[skills] Linked ${entries.filter((e) => e.isDirectory()).length} skills to ${tgtDir}`);
}
