import { readFileSync } from 'fs';
import { join } from 'path';

const RESOURCES_DIR = join(process.cwd(), 'src/server/resources');

function readResourceFile(relativePath: string): string {
  const fullPath = join(RESOURCES_DIR, relativePath);
  try {
    return readFileSync(fullPath, 'utf-8');
  } catch {
    return '';
  }
}

export function assembleInstructions(harnessId: string): string {
  const systemPrompt = readResourceFile('core/system-prompt.md');
  const securityGuidance = readResourceFile('core/security-guidance.md');
  const harnessResource = readResourceFile(`harnesses/${harnessId}.md`);

  const sections = [systemPrompt];

  if (harnessResource) {
    sections.push(harnessResource);
  } else {
    sections.push(
      `# Harness: ${harnessId}\n\nNo specific harness documentation available. ` +
      `Ask the user about their base image and requirements.`,
    );
  }

  sections.push(securityGuidance);

  sections.push(
    '---\n\n' +
    'Begin the conversation. Greet the user and ask about their project ' +
    'and what they want their agent to be able to do.',
  );

  return sections.join('\n\n---\n\n');
}
