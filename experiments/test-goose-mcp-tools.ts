/**
 * Experiment: Does goose run --interactive show tool_use blocks
 * when an MCP extension is attached?
 *
 * Uses --with-extension to add our containerspec MCP server.
 * Asks goose to call addPackage and setEnvVar.
 */

import { spawn } from 'child_process';
import { join } from 'path';

const PROJECT_ROOT = join(import.meta.dirname, '..');

const SYSTEM = `You are a container customization assistant. You have tools to modify a container specification. When the user asks to install packages, use the addPackage tool. When asked to set environment variables, use the setEnvVar tool. Keep responses concise.`;

const MCP_EXT = `SESSION_ID=test-123 BACKEND_URL=http://localhost:3001 HARNESS_ID=opencode BASE_IMAGE=quay.io/test:latest npx tsx ${join(PROJECT_ROOT, 'src/mcp-server/index.ts')}`;

const proc = spawn('goose', [
  'run',
  '--interactive',
  '--no-profile',
  '--no-session',
  '--output-format', 'stream-json',
  '--quiet',
  '--system', SYSTEM,
  '--with-extension', MCP_EXT,
  '--text', 'Install numpy and pandas via pip.',
], {
  stdio: ['pipe', 'pipe', 'pipe'],
  cwd: PROJECT_ROOT,
});

let buffer = '';
let turnCount = 0;
let sawToolUse = false;

function parseLines(): void {
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      handleEvent(event);
    } catch {
      // skip
    }
  }
}

function handleEvent(event: { type: string; [key: string]: unknown }): void {
  if (event.type === 'message') {
    const msg = event.message as {
      role: string;
      content: Array<{
        type: string;
        text?: string;
        name?: string;
        input?: unknown;
        id?: string;
        tool_use_id?: string;
        content?: unknown;
      }>;
    };

    for (const block of msg.content) {
      if (block.type === 'text' && block.text) {
        process.stdout.write(block.text);
      } else if (block.type === 'tool_use') {
        sawToolUse = true;
        console.log(`\n  >>> TOOL_USE: ${block.name}(${JSON.stringify(block.input)})`);
      } else if (block.type === 'tool_result') {
        console.log(`  <<< TOOL_RESULT: ${JSON.stringify(block).slice(0, 300)}`);
      } else {
        console.log(`  [${block.type}]: ${JSON.stringify(block).slice(0, 200)}`);
      }
    }
  } else if (event.type === 'complete') {
    turnCount++;
    console.log(`\n[Turn ${turnCount} complete, tokens: ${event.total_tokens}]`);

    if (turnCount === 1) {
      console.log('\n--- Turn 2: set an env var + memory test ---');
      proc.stdin!.write('Set PYTHON_VERSION=3.12 as an env var. Also remind me what packages you just installed.\n');
    } else {
      console.log('\n=== RESULTS ===');
      console.log(`Tool use events visible: ${sawToolUse ? 'YES' : 'NO'}`);
      console.log(`Multi-turn memory: tested above`);
      proc.kill();
      process.exit(0);
    }
  } else {
    console.log(`[event: ${event.type}] ${JSON.stringify(event).slice(0, 200)}`);
  }
}

proc.stdout!.on('data', (chunk: Buffer) => {
  buffer += chunk.toString();
  parseLines();
});

proc.stderr!.on('data', (chunk: Buffer) => {
  const text = chunk.toString().trim();
  if (text && !text.includes('╌') && !text.includes('⏱')) {
    console.error('[stderr]', text.slice(0, 300));
  }
});

proc.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.log(`[goose exited: ${code}]`);
  }
  process.exit(code || 0);
});

console.log('=== MCP Tool Call Visibility Test ===');
console.log(`Extension: ${MCP_EXT.slice(0, 80)}...`);
console.log('Asking goose to install packages via addPackage tool\n');

setTimeout(() => {
  console.error('\nTimed out');
  proc.kill();
  process.exit(1);
}, 120000);
