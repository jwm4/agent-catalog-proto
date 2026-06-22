import { readFileSync } from 'fs';
import { join } from 'path';
import { getConfigSchema } from '../../shared/harness-configs/index.js';
import { getHarnessById } from '../../shared/harnesses.js';
import type { HarnessConfigSchema, HarnessConfigSection } from '../../shared/types.js';

const RESOURCES_DIR = join(process.cwd(), 'src/server/resources');

function readResourceFile(relativePath: string): string {
  const fullPath = join(RESOURCES_DIR, relativePath);
  try {
    return readFileSync(fullPath, 'utf-8');
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
  const systemPrompt = readResourceFile('core/system-prompt.md');
  const securityGuidance = readResourceFile('core/security-guidance.md');

  const sections = [systemPrompt];

  const harness = getHarnessById(harnessId);
  const harnessName = harness?.name ?? harnessId;
  sections.push(
    `## Current Harness: ${harnessName}\n\n` +
    `You are configuring a container for the **${harnessName}** harness. ` +
    `Detailed harness setup guidance is available via the ${harnessId}-harness skill.`,
  );

  const configSchema = getConfigSchema(harnessId);
  if (configSchema) {
    sections.push(formatConfigSchema(configSchema));
  }

  sections.push(securityGuidance);

  sections.push(
    '---\n\n' +
    'Begin the conversation. Greet the user and ask about their project ' +
    'and what they want their agent to be able to do.',
  );

  return sections.join('\n\n---\n\n');
}
