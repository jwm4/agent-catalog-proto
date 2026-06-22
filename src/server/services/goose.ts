import { execSync, spawn, type ChildProcess } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { Response as ExpressResponse } from 'express';
import { assembleInstructions } from './instruction-assembler.js';

const AGENT_WORKSPACE = join(process.cwd(), 'agent-workspace');

const BIN_DIR = join(process.cwd(), '.bin');
const GOOSED_PORT = 3284;
const ACP_ENDPOINT = `http://127.0.0.1:${GOOSED_PORT}/acp`;

let goosedProcess: ChildProcess | null = null;
let connectionId: string | null = null;

interface AcpSession {
  sessionId: string;
  harnessId: string;
}

const acpSessions = new Map<string, AcpSession>();

export function findGooseBinary(): string | null {
  try {
    const result = execSync('which goose', { encoding: 'utf-8' }).trim();
    if (result) return result;
  } catch {
    // not on PATH
  }

  const localBin = join(BIN_DIR, 'goose');
  if (existsSync(localBin)) return localBin;

  return null;
}

export async function ensureGoose(): Promise<string> {
  const existing = findGooseBinary();
  if (existing) {
    console.log(`[goose] Found goose binary at: ${existing}`);
    return existing;
  }

  console.log('[goose] Goose not found, downloading...');
  if (!existsSync(BIN_DIR)) {
    mkdirSync(BIN_DIR, { recursive: true });
  }

  try {
    execSync(
      'curl -fsSL https://github.com/aaif-goose/goose/releases/download/stable/download_cli.sh | CONFIGURE=false INSTALL_DIR=' +
        BIN_DIR +
        ' bash',
      { stdio: 'inherit' },
    );
  } catch (err) {
    throw new Error(
      `Failed to download goose. Install manually: brew install block-goose-cli\n${err}`,
    );
  }

  const downloaded = findGooseBinary();
  if (!downloaded) {
    throw new Error(
      'Goose download completed but binary not found. Install manually: brew install block-goose-cli',
    );
  }

  return downloaded;
}

async function waitForReady(
  maxAttempts = 20,
  interval = 500,
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${GOOSED_PORT}/status`);
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error('goosed did not become ready in time');
}

async function acpInitialize(): Promise<string> {
  const res = await fetch(ACP_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '0.1',
        clientCapabilities: {},
        clientInfo: { name: 'agent-catalog', version: '0.1.0' },
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`ACP initialize failed: ${res.status}`);
  }

  const connId = res.headers.get('acp-connection-id');
  if (!connId) {
    throw new Error('ACP initialize did not return acp-connection-id header');
  }

  connectionId = connId;
  console.log(`[goose] ACP initialized, connection: ${connId}`);
  return connId;
}

export async function startGoosed(): Promise<{ port: number }> {
  if (goosedProcess) {
    return { port: GOOSED_PORT };
  }

  const binary = await ensureGoose();

  const proc = spawn(binary, ['serve', '--port', String(GOOSED_PORT)], {
    env: { ...process.env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  goosedProcess = proc;

  proc.stdout?.on('data', (data: Buffer) => {
    console.log(`[goosed stdout] ${data.toString().trim()}`);
  });

  proc.stderr?.on('data', (data: Buffer) => {
    console.error(`[goosed stderr] ${data.toString().trim()}`);
  });

  proc.on('error', (err) => {
    console.error('[goosed] Process error:', err.message);
  });

  proc.on('exit', (code) => {
    console.log(`[goosed] Process exited with code ${code}`);
    goosedProcess = null;
    connectionId = null;
  });

  await waitForReady();
  console.log(`[goose] goosed ready on port ${GOOSED_PORT}`);

  await acpInitialize();

  return { port: GOOSED_PORT };
}

export function stopGoosed(): void {
  if (goosedProcess) {
    goosedProcess.kill();
    goosedProcess = null;
    connectionId = null;
  }
}

export function isGoosedRunning(): boolean {
  return goosedProcess !== null && connectionId !== null;
}

function buildMcpServerSpec(
  sessionId: string,
  harnessId: string,
  baseImage: string,
  backendUrl: string,
) {
  return {
    name: 'containerspec',
    command: 'npx',
    args: ['tsx', join(process.cwd(), 'src/mcp-server/index.ts')],
    env: [
      { name: 'SESSION_ID', value: sessionId },
      { name: 'BACKEND_URL', value: backendUrl },
      { name: 'HARNESS_ID', value: harnessId },
      { name: 'BASE_IMAGE', value: baseImage },
    ],
  };
}

export async function startAgentSession(
  harnessId: string,
  baseImage: string,
  sessionId: string,
  backendUrl = 'http://localhost:3001',
): Promise<string> {
  if (!connectionId) {
    throw new Error('ACP not initialized. Call startGoosed() first.');
  }

  const mcpServer = buildMcpServerSpec(sessionId, harnessId, baseImage, backendUrl);

  const acpRequestId = `new-${sessionId}`;

  const ssePromise = new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timed out waiting for session/new response'));
    }, 30000);

    fetch(ACP_ENDPOINT, {
      method: 'GET',
      headers: {
        'acp-connection-id': connectionId!,
        Accept: 'text/event-stream',
      },
    })
      .then(async (res) => {
        if (!res.ok || !res.body) {
          clearTimeout(timeout);
          reject(new Error(`SSE channel failed: ${res.status}`));
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
            const data = line.slice(6);
            try {
              const msg = JSON.parse(data) as {
                id?: string;
                result?: { sessionId?: string };
                error?: { message?: string };
              };
              if (String(msg.id) === acpRequestId) {
                clearTimeout(timeout);
                reader.cancel().catch(() => {});
                if (msg.error) {
                  reject(new Error(`session/new error: ${msg.error.message}`));
                } else if (msg.result?.sessionId) {
                  resolve(msg.result.sessionId);
                } else {
                  reject(new Error('session/new response missing sessionId'));
                }
                return;
              }
            } catch {
              // not valid JSON, skip
            }
          }
        }
      })
      .catch((err) => {
        clearTimeout(timeout);
        reject(err);
      });
  });

  await fetch(ACP_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'acp-connection-id': connectionId,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: acpRequestId,
      method: 'session/new',
      params: {
        cwd: AGENT_WORKSPACE,
        mcpServers: [mcpServer],
      },
    }),
  });

  const acpSessionId = await ssePromise;

  acpSessions.set(sessionId, {
    sessionId: acpSessionId,
    harnessId,
  });

  console.log(`[goose] Agent session started: ${sessionId} -> ACP ${acpSessionId}`);
  return acpSessionId;
}

export async function sendMessage(
  sessionId: string,
  message: string,
  expressRes: ExpressResponse,
): Promise<void> {
  if (!connectionId) {
    throw new Error('ACP not initialized');
  }

  const acpSession = acpSessions.get(sessionId);
  if (!acpSession) {
    throw new Error(`No ACP session found for ${sessionId}`);
  }

  const promptId = `prompt-${Date.now()}`;

  expressRes.setHeader('Content-Type', 'text/event-stream');
  expressRes.setHeader('Cache-Control', 'no-cache');
  expressRes.setHeader('Connection', 'keep-alive');

  const sseRes = await fetch(ACP_ENDPOINT, {
    method: 'GET',
    headers: {
      'acp-connection-id': connectionId,
      'acp-session-id': acpSession.sessionId,
      Accept: 'text/event-stream',
    },
  });

  if (!sseRes.ok || !sseRes.body) {
    expressRes.write(`data: ${JSON.stringify({ content: 'Failed to open SSE channel to Goose' })}\n\n`);
    expressRes.write('data: [DONE]\n\n');
    expressRes.end();
    return;
  }

  await fetch(ACP_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'acp-connection-id': connectionId,
      'acp-session-id': acpSession.sessionId,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: promptId,
      method: 'session/prompt',
      params: {
        sessionId: acpSession.sessionId,
        prompt: [{ type: 'text', text: message }],
      },
    }),
  });

  const reader = sseRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);

        try {
          const msg = JSON.parse(data) as {
            id?: string;
            method?: string;
            result?: { stopReason?: string };
            error?: { message?: string };
            params?: {
              update?: {
                sessionUpdate?: string;
                content?: { type?: string; text?: string };
                title?: string;
                rawInput?: Record<string, unknown>;
                toolCallId?: string;
                _meta?: { goose?: { messageId?: string } };
              };
            };
          };

          if (msg.method === 'session/update' && msg.params?.update) {
            const update = msg.params.update;

            if (
              update.sessionUpdate === 'agent_message_chunk' &&
              update.content?.text
            ) {
              const chunk: { content: string; messageId?: string } = {
                content: update.content.text,
              };
              const mid = update._meta?.goose?.messageId;
              if (mid) chunk.messageId = mid;
              expressRes.write(`data: ${JSON.stringify(chunk)}\n\n`);
            }

            if (update.sessionUpdate === 'tool_call' && update.title) {
              expressRes.write(`data: ${JSON.stringify({
                type: 'tool_call',
                toolName: update.title,
                args: update.rawInput || {},
              })}\n\n`);
            }
          }

          if (String(msg.id) === promptId) {
            reader.cancel().catch(() => {});
            break;
          }
        } catch {
          // non-JSON SSE line, skip
        }
      }
    }
  } catch (err) {
    console.error('[goose] SSE read error:', err);
  }

  expressRes.write('data: [DONE]\n\n');
  expressRes.end();
}

export async function sendInstructionsAndGetGreeting(
  sessionId: string,
  harnessId: string,
): Promise<string> {
  if (!connectionId) {
    throw new Error('ACP not initialized');
  }

  const acpSession = acpSessions.get(sessionId);
  if (!acpSession) {
    throw new Error(`No ACP session found for ${sessionId}`);
  }

  const instructions = assembleInstructions(harnessId);
  const promptId = `instructions-${sessionId}`;
  let greeting = '';

  const sseRes = await fetch(ACP_ENDPOINT, {
    method: 'GET',
    headers: {
      'acp-connection-id': connectionId,
      'acp-session-id': acpSession.sessionId,
      Accept: 'text/event-stream',
    },
  });

  if (!sseRes.ok || !sseRes.body) {
    throw new Error('Failed to open SSE channel for instructions');
  }

  await fetch(ACP_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'acp-connection-id': connectionId,
      'acp-session-id': acpSession.sessionId,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: promptId,
      method: 'session/prompt',
      params: {
        sessionId: acpSession.sessionId,
        prompt: [{ type: 'text', text: instructions }],
      },
    }),
  });

  const reader = sseRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const msg = JSON.parse(line.slice(6)) as {
            id?: string;
            method?: string;
            params?: {
              update?: {
                sessionUpdate?: string;
                content?: { text?: string };
              };
            };
          };

          if (
            msg.method === 'session/update' &&
            msg.params?.update?.sessionUpdate === 'agent_message_chunk' &&
            msg.params.update.content?.text
          ) {
            greeting += msg.params.update.content.text;
          }

          if (String(msg.id) === promptId) {
            reader.cancel().catch(() => {});
            break;
          }
        } catch {
          // skip
        }
      }
    }
  } catch (err) {
    console.error('[goose] SSE error collecting greeting:', err);
  }

  console.log(`[goose] Greeting collected for ${sessionId} (${greeting.length} chars)`);
  return greeting;
}

export async function stopAgentSession(sessionId: string): Promise<void> {
  if (!connectionId) return;

  const acpSession = acpSessions.get(sessionId);
  if (!acpSession) return;

  try {
    await fetch(ACP_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'acp-connection-id': connectionId,
        'acp-session-id': acpSession.sessionId,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: `close-${sessionId}`,
        method: 'session/close',
        params: { sessionId: acpSession.sessionId },
      }),
    });
    acpSessions.delete(sessionId);
    console.log(`[goose] Agent session closed for ${sessionId}`);
  } catch (err) {
    console.error(`[goose] Failed to close session ${sessionId}:`, err);
  }
}

export function getGoosedInfo(): {
  port: number;
  running: boolean;
  connectionId: string | null;
} {
  return {
    port: GOOSED_PORT,
    running: goosedProcess !== null,
    connectionId,
  };
}
