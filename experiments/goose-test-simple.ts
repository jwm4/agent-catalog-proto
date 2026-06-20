import { spawn } from 'child_process';

const proc = spawn('goose', [
  'run',
  '--interactive',
  '--no-profile',
  '--no-session',
  '--output-format', 'stream-json',
  '--quiet',
  '--text', 'My name is TestBot42. Remember that. Reply with just "Got it."',
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
      console.log('[unparsed]', line.slice(0, 200));
    }
  }
}

function handleEvent(event: { type: string; [key: string]: unknown }): void {
  if (event.type === 'message') {
    const msg = event.message as {
      content: Array<{ type: string; text?: string }>;
    };
    const text = msg.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('');
    console.log(`[Turn ${turnCount}] Assistant: ${text}`);
  } else if (event.type === 'complete') {
    turnCount++;
    console.log(`[Turn ${turnCount} complete, tokens: ${event.total_tokens}]`);

    if (turnCount === 1) {
      console.log('\n--- Sending second message (testing memory) ---');
      proc.stdin!.write('What name did I just tell you? Reply with just the name.\n');
    } else if (turnCount === 2) {
      console.log('\n--- Sending third message (testing continued memory) ---');
      proc.stdin!.write('And what number was in that name? Reply with just the number.\n');
    } else {
      console.log('\n=== Test complete. Goose remembered across 3 turns. ===');
      proc.kill();
      process.exit(0);
    }
  } else {
    console.log(`[event: ${event.type}]`, JSON.stringify(event).slice(0, 150));
  }
}

proc.stdout!.on('data', (chunk: Buffer) => {
  buffer += chunk.toString();
  parseLines();
});

proc.stderr!.on('data', (chunk: Buffer) => {
  const text = chunk.toString().trim();
  if (text) console.error('[stderr]', text.slice(0, 200));
});

proc.on('exit', (code) => {
  console.log(`[goose exited: ${code}]`);
  process.exit(code || 0);
});

console.log('--- First message sent via --text arg ---');

// Safety timeout
setTimeout(() => {
  console.error('Timed out after 60s');
  proc.kill();
  process.exit(1);
}, 60000);
