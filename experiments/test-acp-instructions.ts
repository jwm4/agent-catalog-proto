/**
 * Experiment: Can we inject system instructions into ACP sessions?
 *
 * Tests two approaches:
 * 1. Send instructions as the first prompt (workaround)
 * 2. Check if session/new accepts any instruction-like params
 *
 * Uses the exact same SSE pattern as the working goose.ts code.
 */

const ACP = 'http://127.0.0.1:3284/acp';
let connId: string;

async function init(): Promise<void> {
  const res = await fetch(ACP, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'init',
      method: 'initialize',
      params: {
        protocolVersion: '0.1',
        clientCapabilities: {},
        clientInfo: { name: 'acp-instructions-test', version: '0.1.0' },
      },
    }),
  });
  connId = res.headers.get('acp-connection-id')!;
  console.log(`Connection: ${connId}`);
}

async function createSession(): Promise<string> {
  const reqId = `new-${Date.now()}`;

  const ssePromise = new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout')), 30000);

    fetch(ACP, {
      method: 'GET',
      headers: { 'acp-connection-id': connId, Accept: 'text/event-stream' },
    }).then(async (res) => {
      if (!res.ok || !res.body) { reject(new Error(`SSE: ${res.status}`)); return; }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const msg = JSON.parse(line.slice(6));
            if (msg.method) {
              console.log(`  [SSE] ${msg.method}`);
            }
            if (String(msg.id) === reqId) {
              clearTimeout(timeout);
              reader.cancel().catch(() => {});
              if (msg.result?.sessionId) resolve(msg.result.sessionId);
              else reject(new Error(`No sessionId: ${JSON.stringify(msg)}`));
              return;
            }
          } catch { /* skip */ }
        }
      }
    }).catch(reject);
  });

  await fetch(ACP, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'acp-connection-id': connId },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: reqId,
      method: 'session/new',
      params: {
        cwd: process.cwd(),
        mcpServers: [{
          name: 'containerspec',
          command: 'npx',
          args: ['tsx', `${process.cwd()}/src/mcp-server/index.ts`],
          env: [
            { name: 'SESSION_ID', value: 'acp-test-123' },
            { name: 'BACKEND_URL', value: 'http://localhost:3001' },
            { name: 'HARNESS_ID', value: 'opencode' },
            { name: 'BASE_IMAGE', value: 'quay.io/test:latest' },
          ],
        }],
      },
    }),
  });

  return ssePromise;
}

async function sendPrompt(sessionId: string, text: string): Promise<string> {
  const reqId = `prompt-${Date.now()}`;
  let fullText = '';
  let toolCalls: string[] = [];

  const ssePromise = new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      console.log(`  [partial response so far: ${fullText.length} chars]`);
      reject(new Error('Prompt timeout'));
    }, 60000);

    fetch(ACP, {
      method: 'GET',
      headers: {
        'acp-connection-id': connId,
        'acp-session-id': sessionId,
        Accept: 'text/event-stream',
      },
    }).then(async (res) => {
      if (!res.ok || !res.body) { reject(new Error(`SSE: ${res.status}`)); return; }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const msg = JSON.parse(line.slice(6));

            if (msg.method === 'session/update' && msg.params?.update) {
              const u = msg.params.update;
              if (u.sessionUpdate === 'agent_message_chunk' && u.content?.text) {
                fullText += u.content.text;
                process.stdout.write(u.content.text);
              } else if (u.sessionUpdate === 'tool_call' || u.sessionUpdate === 'tool_use') {
                toolCalls.push(JSON.stringify(u));
                console.log(`\n  >>> TOOL: ${JSON.stringify(u).slice(0, 200)}`);
              } else if (u.sessionUpdate) {
                console.log(`  [update: ${u.sessionUpdate}]`);
              }
            }

            if (String(msg.id) === reqId) {
              clearTimeout(timeout);
              reader.cancel().catch(() => {});
              resolve(fullText);
              return;
            }
          } catch { /* skip */ }
        }
      }
    }).catch(reject);
  });

  await fetch(ACP, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'acp-connection-id': connId,
      'acp-session-id': sessionId,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: reqId,
      method: 'session/prompt',
      params: {
        sessionId,
        prompt: [{ type: 'text', text }],
      },
    }),
  });

  const result = await ssePromise;
  if (toolCalls.length) {
    console.log(`\n  [Tool calls observed: ${toolCalls.length}]`);
  }
  return result;
}

async function main() {
  console.log('=== ACP Instructions + Tool Call Visibility Test ===\n');

  console.log('1. Init...');
  await init();

  console.log('2. Create session...');
  const sessionId = await createSession();
  console.log(`   Session: ${sessionId}\n`);

  console.log('3. Sending instructions as first prompt...');
  const instructions = `You are a container customization assistant. You have tools to modify container specifications. When the user asks to install packages, use the addPackage tool. When asked about environment variables, use the setEnvVar tool. Keep responses under 3 sentences. Start by greeting the user and asking what kind of project they want to set up.`;

  const greeting = await sendPrompt(sessionId, instructions);
  console.log(`\n\n   [Greeting length: ${greeting.length} chars]\n`);

  console.log('4. Asking to install packages (testing tool visibility)...');
  const response = await sendPrompt(sessionId, 'Install numpy and pandas via pip.');
  console.log(`\n\n   [Response length: ${response.length} chars]\n`);

  console.log('5. Memory test...');
  const memory = await sendPrompt(sessionId, 'What packages did you just install?');
  console.log(`\n\n   [Memory response length: ${memory.length} chars]\n`);

  console.log('=== DONE ===');
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
