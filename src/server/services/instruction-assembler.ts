import { readFileSync } from 'fs';
import { join } from 'path';
import { getConfigSchema } from '../../shared/harness-configs/index.js';
import { getHarnessById } from '../../shared/harnesses.js';
import type { HarnessConfigSchema, HarnessConfigSection } from '../../shared/types.js';

const SKILL_DIR = join(
  process.cwd(),
  'agent-workspace/.agents/skills/container-customizer',
);

function readSkillBody(): string {
  const skillPath = join(SKILL_DIR, 'SKILL.md');
  try {
    const raw = readFileSync(skillPath, 'utf-8');
    const fmEnd = raw.indexOf('---', raw.indexOf('---') + 3);
    if (fmEnd === -1) return raw;
    return raw.slice(fmEnd + 3).trim();
  } catch {
    return '';
  }
}

function formatSectionSummary(section: HarnessConfigSection): string {
  const lines: string[] = [];
  lines.push(`### ${section.title}`);
  if (section.description) {
    lines.push(section.description);
  }

  if (section.options?.length) {
    const labels = section.options.map((o) => {
      const suffix = o.default ? ' (default)' : '';
      return `${o.label}${suffix}`;
    });
    lines.push(`Options: ${labels.join(', ')}`);

    for (const opt of section.options) {
      const details: string[] = [];
      if (opt.secrets?.length) {
        details.push(
          `Secrets: ${opt.secrets.map((s) => s.name).join(', ')}`,
        );
      }
      if (opt.fields?.length) {
        details.push(
          `Fields: ${opt.fields.map((f) => f.label).join(', ')}`,
        );
      }
      if (details.length) {
        lines.push(`- **${opt.label}**: ${details.join('; ')}`);
      }
    }
  }

  if (section.fields?.length) {
    for (const field of section.fields) {
      const typeSuffix = field.type === 'secret' ? ' (secret)' : '';
      const defaultSuffix = field.default ? ` [default: ${field.default}]` : '';
      lines.push(`- ${field.label}${typeSuffix}${defaultSuffix}`);
    }
  }

  if (section.dynamic) {
    lines.push('(Repeatable: the user can add multiple entries)');
  }

  return lines.join('\n');
}

function formatConfigSchema(schema: HarnessConfigSchema): string {
  const lines: string[] = [];
  lines.push('## Available Configuration Options');
  lines.push('');
  lines.push(
    'The Configuration tab on the right shows these sections. ' +
    'Walk through them with the user as needed.',
  );

  for (const section of schema.sections) {
    lines.push('');
    lines.push(formatSectionSummary(section));
  }

  return lines.join('\n');
}

export function assembleInstructions(harnessId: string): string {
  const skillBody = readSkillBody();
  const harness = getHarnessById(harnessId);
  const harnessName = harness?.name ?? harnessId;

  const sections: string[] = [];

  if (skillBody) {
    sections.push(skillBody);
  }

  sections.push(
    `## Current Harness: ${harnessName}\n\n` +
    `You are configuring a container for the **${harnessName}** harness.`,
  );

  const configSchema = getConfigSchema(harnessId);
  if (configSchema) {
    sections.push(formatConfigSchema(configSchema));
  }

  sections.push(
    'Begin the conversation. Greet the user and ask about their project ' +
    'and what they want their agent to be able to do.',
  );

  return sections.join('\n\n---\n\n');
}
