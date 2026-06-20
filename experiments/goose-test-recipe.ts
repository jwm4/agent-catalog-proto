import { spawn } from 'child_process';
import { join } from 'path';

const PROJECT_ROOT = join(import.meta.dirname, '..');
const RECIPE_PATH = join(PROJECT_ROOT, 'recipes/opencode-customizer.yaml');

const proc = spawn('goose', [
  'run',
  '--interactive',
  '--no-profile',
  '--no-session',
  '--output-format', 'stream-json',
  '--quiet',
  '--recipe', RECIPE_PATH,
  '--params', 'harness_id=opencode',
  '--params', 'base_image=quay.io/aipcc/agentic-ci/opencode-runner:latest',
], {
  stdio: ['pipe', 'pipe', 'pipe'],
  cwd: PROJECT_ROOT,
});

let buffer = '';
let turnCount = 0;

function parseLines(): void {
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      handleEvent(event);
    } catch {
      // skip unparsable lines (progress bars etc)
    }
  }
}

function handleEvent(event: { type: string; [key: string]: unknown }): void {
  if (event.type === 'message') {
    const msg = event.message as {
      role: string;
      content: Array<{ type: string; text?: string; name?: string; input?: unknown }>;
    };

    for (const block of msg.content) {
      if (block.type === 'text' && block.text) {
        process.stdout.write(block.text);
      } else if (block.type === 'tool_use') {
        console.log(`\n  [TOOL CALL: ${block.name}(${JSON.stringify(block.input)})]`);
      } else if (block.type === 'tool_result') {
        console.log(`  [TOOL RESULT: ${block.name}]`);
      } else {
        console.log(`  [content block: ${block.type}]`);
      }
    }
  } else if (event.type === 'complete') {
    turnCount++;
    console.log(`\n[Turn ${turnCount} complete, tokens: ${event.total_tokens}]`);

    if (turnCount === 1) {
      console.log('\n--- Sending first user message ---');
      proc.stdin!.write('I want to set up a Python data science environment. Add numpy and pandas via pip. Keep your response under 3 sentences.\n');
    } else if (turnCount === 2) {
      console.log('\n--- Sending follow-up (testing memory + tool calls) ---');
      proc.stdin!.write('Also add pytest. List all packages you have added so far.\n');
    } else {
      console.log('\n=== Test complete ===');
      proc.kill();
      process.exit(0);
    }
  } else {
    // Log other event types
    const preview = JSON.stringify(event).slice(0, 200);
    if (!preview.includes('progress')) {
      console.log(`[event: ${event.type}] ${preview}`);
    }
  }
}

proc.stdout!.on('data', (chunk: Buffer) => {
  buffer += chunk.toString();
  parseLines();
});

proc.stderr!.on('data', (chunk: Buffer) => {
  const text = chunk.toString().trim();
  if (text) {
    console.error('[stderr]', text.slice(0, 500));
  }
});

proc.on('exit', (code) => {
  console.log(`[goose exited: ${code}]`);
  process.exit(code || 0);
});

console.log('--- Testing with recipe + tool calls ---');
console.log(`Recipe: ${RECIPE_PATH}\n`);

setTimeout(() => {
  console.error('\nTimed out after 120s');
  proc.kill();
  process.exit(1);
}, 120000);
