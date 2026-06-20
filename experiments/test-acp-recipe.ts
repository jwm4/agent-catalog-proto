/**
 * Experiment: Can we execute a recipe via ACP slash commands?
 * Tests whether PR #8925 recipe support works in our goosed v1.38.0.
 *
 * Steps:
 * 1. Connect to running goosed ACP endpoint
 * 2. Initialize connection
 * 3. Create a session
 * 4. Check available commands (should include recipe slash commands)
 * 5. Try executing a recipe command
 */

const ACP = 'http://127.0.0.1:3284/acp';

async function initConnection(): Promise<string> {
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
        clientInfo: { name: 'recipe-test', version: '0.1.0' },
      },
    }),
  });

  const connId = res.headers.get('acp-connection-id');
  if (!connId) throw new Error('No connection ID returned');

  const body = await res.json();
  console.log('ACP capabilities:', JSON.stringify(body.result?.agentCapabilities, null, 2));
  return connId;
}

async function createSession(connId: string): Promise<string> {
  // Start SSE listener for the response
  const ssePromise = new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout waiting for session')), 15000);

    fetch(ACP, {
      method: 'GET',
      headers: {
        'acp-connection-id': connId,
        Accept: 'text/event-stream',
      },
    }).then(async (res) => {
      if (!res.ok || !res.body) {
        clearTimeout(timeout);
        reject(new Error(`SSE failed: ${res.status}`));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const msg = JSON.parse(line.slice(6));

            // Look for available_commands_update notifications
            if (msg.method === 'notifications/available_commands_update' ||
                msg.method === 'available_commands_update') {
              console.log('\n=== AVAILABLE COMMANDS ===');
              console.log(JSON.stringify(msg.params, null, 2));
            }

            // Look for session/new response
            if (String(msg.id) === 'new-session' && msg.result?.sessionId) {
              clearTimeout(timeout);
              reader.cancel().catch(() => {});
              resolve(msg.result.sessionId);
              return;
            }

            // Log all other events
            if (msg.method) {
              console.log(`[SSE event] ${msg.method}:`, JSON.stringify(msg.params || {}).slice(0, 200));
            }
          } catch { /* skip */ }
        }
      }
    }).catch(reject);
  });

  // Send session/new
  await fetch(ACP, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'acp-connection-id': connId,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'new-session',
      method: 'session/new',
      params: { cwd: process.cwd() },
    }),
  });

  return ssePromise;
}

async function sendPromptAndCollect(
  connId: string,
  sessionId: string,
  message: string,
): Promise<string> {
  const promptId = `prompt-${Date.now()}`;
  let fullText = '';

  const ssePromise = new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout')), 30000);

    fetch(ACP, {
      method: 'GET',
      headers: {
        'acp-connection-id': connId,
        'acp-session-id': sessionId,
        Accept: 'text/event-stream',
      },
    }).then(async (res) => {
      if (!res.ok || !res.body) { reject(new Error('SSE failed')); return; }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const msg = JSON.parse(line.slice(6));

            if (msg.method === 'session/update' && msg.params?.update) {
              const update = msg.params.update;
              if (update.sessionUpdate === 'agent_message_chunk' && update.content?.text) {
                fullText += update.content.text;
                process.stdout.write(update.content.text);
              } else if (update.sessionUpdate) {
                console.log(`\n  [update: ${update.sessionUpdate}]`);
              }
            }

            if (msg.method === 'notifications/available_commands_update') {
              const cmds = msg.params?.commands || msg.params?.availableCommands || [];
              console.log(`\n  [available commands: ${JSON.stringify(cmds).slice(0, 300)}]`);
            }

            if (String(msg.id) === promptId) {
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
      id: promptId,
      method: 'session/prompt',
      params: {
        sessionId,
        prompt: [{ type: 'text', text: message }],
      },
    }),
  });

  return ssePromise;
}

async function main() {
  console.log('=== ACP Recipe Experiment ===\n');

  console.log('1. Initializing ACP connection...');
  const connId = await initConnection();
  console.log(`   Connection: ${connId}\n`);

  console.log('2. Creating session (watch for available_commands_update)...');
  const sessionId = await createSession(connId);
  console.log(`\n   Session: ${sessionId}\n`);

  // Wait a moment for any post-session notifications
  await new Promise(r => setTimeout(r, 2000));

  console.log('\n3. Sending a test prompt to see if slash commands are available...');
  const response = await sendPromptAndCollect(
    connId,
    sessionId,
    'List any slash commands you have available. Just list them briefly.',
  );

  console.log(`\n\n4. Response received (${response.length} chars). Done.\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
