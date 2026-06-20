import { spawn, type ChildProcess } from 'child_process';
import * as readline from 'readline';

const RECIPE_PATH = new URL(
  '../recipes/opencode-customizer.yaml',
  import.meta.url,
).pathname;

let goose: ChildProcess | null = null;
let responseBuffer = '';
let waitingForResponse = false;

function startGoose(): ChildProcess {
  const proc = spawn('goose', [
    'run',
    '--interactive',
    '--recipe', RECIPE_PATH,
    '--no-profile',
    '--no-session',
    '--output-format', 'stream-json',
    '--quiet',
  ], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  proc.stdout!.on('data', (chunk: Buffer) => {
    const text = chunk.toString();
    responseBuffer += text;

    const lines = responseBuffer.split('\n');
    responseBuffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        handleEvent(event);
      } catch {
        console.log('[raw]', line);
      }
    }
  });

  proc.stderr!.on('data', (chunk: Buffer) => {
    const text = chunk.toString().trim();
    if (text) {
      console.error('[stderr]', text);
    }
  });

  proc.on('exit', (code) => {
    console.log(`\n[goose exited with code ${code}]`);
    process.exit(0);
  });

  return proc;
}

function handleEvent(event: Record<string, unknown>): void {
  const type = event.type as string | undefined;

  if (type === 'text_chunk' || type === 'content') {
    const text = (event.text || event.content) as string | undefined;
    if (text) process.stdout.write(text);
  } else if (type === 'tool_use' || type === 'tool_call') {
    const name = (event.name || event.tool) as string | undefined;
    console.log(`\n[tool call: ${name}]`);
  } else if (type === 'tool_result') {
    const name = event.name as string | undefined;
    console.log(`[tool result: ${name}]`);
  } else if (type === 'end' || type === 'finish' || type === 'done') {
    console.log('\n');
    waitingForResponse = false;
    rl.prompt();
  } else {
    // Log unknown event types so we can see what goose sends
    console.log(`[event: ${type || 'unknown'}]`, JSON.stringify(event).slice(0, 200));
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'you> ',
});

console.log('Starting goose run --interactive...');
console.log(`Recipe: ${RECIPE_PATH}`);
console.log('Type messages and press Enter. Ctrl-C to quit.\n');

goose = startGoose();

// Give goose a moment to start, then show prompt
setTimeout(() => {
  if (!waitingForResponse) {
    rl.prompt();
  }
}, 2000);

rl.on('line', (input: string) => {
  const trimmed = input.trim();
  if (!trimmed) {
    rl.prompt();
    return;
  }

  if (!goose || !goose.stdin) {
    console.error('Goose process not running');
    return;
  }

  waitingForResponse = true;
  console.log('\ngoose> ');
  goose.stdin.write(trimmed + '\n');
});

rl.on('close', () => {
  console.log('\nShutting down...');
  if (goose) goose.kill();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  if (goose) goose.kill();
  process.exit(0);
});
