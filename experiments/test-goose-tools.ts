/**
 * Experiment: Does goose run --interactive with stream-json show tool calls?
 * Also tests: does --system flag work to inject instructions?
 *
 * Uses a simple inline "echo" MCP server to test tool visibility.
 */

import { spawn } from 'child_process';

const SYSTEM_PROMPT = `You are a helpful assistant. When asked to set an environment variable, use the setEnvVar tool. When asked to add a package, use the addPackage tool. Keep responses under 2 sentences.`;

// Use --system for instructions instead of --recipe to avoid provider issues
const proc = spawn('goose', [
  'run',
  '--interactive',
  '--no-profile',
  '--no-session',
  '--output-format', 'stream-json',
  '--quiet',
  '--system', SYSTEM_PROMPT,
  '--text', 'Hello! I am testing tool calls. Just say "Ready." in one word.',
], {
  stdio: ['pipe', 'pipe', 'pipe'],
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
      // Skip unparsable lines
    }
  }
}

function handleEvent(event: { type: string; [key: string]: unknown }): void {
  if (event.type === 'message') {
    const msg = event.message as {
      role: string;
      content: Array<{ type: string; text?: string; name?: string; input?: unknown; id?: string }>;
    };

    console.log(`\n[message, role=${msg.role}, ${msg.content.length} blocks]`);
    for (const block of msg.content) {
      if (block.type === 'text') {
        console.log(`  TEXT: ${block.text}`);
      } else if (block.type === 'tool_use') {
        console.log(`  TOOL_USE: ${block.name}(${JSON.stringify(block.input)})`);
      } else if (block.type === 'tool_result') {
        console.log(`  TOOL_RESULT: ${JSON.stringify(block).slice(0, 200)}`);
      } else {
        console.log(`  BLOCK[${block.type}]: ${JSON.stringify(block).slice(0, 200)}`);
      }
    }
  } else if (event.type === 'complete') {
    turnCount++;
    console.log(`\n[Turn ${turnCount} complete, tokens: ${event.total_tokens}]`);

    if (turnCount === 1) {
      console.log('\n--- Turn 2: asking it to remember something ---');
      proc.stdin!.write('My project uses Python and Node.js. Remember that for later.\n');
    } else if (turnCount === 2) {
      console.log('\n--- Turn 3: testing memory ---');
      proc.stdin!.write('What languages did I say my project uses?\n');
    } else {
      console.log('\n=== Experiment complete ===');
      console.log('Key findings:');
      console.log('- Tool calls visible in stream-json?');
      console.log('- --system instructions followed?');
      console.log('- Multi-turn memory works?');
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
  if (text) console.error('[stderr]', text.slice(0, 300));
});

proc.on('exit', (code) => {
  console.log(`[goose exited: ${code}]`);
  process.exit(code || 0);
});

console.log('=== Goose Tool Visibility Experiment ===');
console.log('Testing --system flag and stream-json event types\n');

setTimeout(() => {
  console.error('\nTimed out');
  proc.kill();
  process.exit(1);
}, 90000);
