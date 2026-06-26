import { Router } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import { rm } from 'fs/promises';
import {
  getSession,
  getSpec,
  updateBuildStatus,
  setSecretValues,
} from '../services/session-manager.js';
import { assembleBuildContext } from '../services/build-context.js';
import {
  BuildConfigBackend,
  detectNamespace,
} from '../services/build-backend.js';

const execAsync = promisify(exec);

async function ensureNamespaceExists(namespace: string): Promise<void> {
  try {
    await execAsync(`oc get project ${namespace}`);
  } catch {
    await execAsync(`oc new-project ${namespace}`);
  }
}

const router = Router();
const buildBackend = new BuildConfigBackend();

function resourceName(harnessId: string, sessionId: string): string {
  return `agent-${harnessId}-${sessionId.slice(0, 8)}`;
}

router.post('/api/build', async (req, res) => {
  console.log('[build] POST /api/build received');
  const { sessionId, namespace: nsOverride, secretValues: secrets } = req.body as {
    sessionId?: string;
    namespace?: string;
    secretValues?: Record<string, string>;
  };
  console.log('[build] sessionId:', sessionId, 'namespace:', nsOverride);

  if (!sessionId) {
    res.status(400).json({ error: 'sessionId is required' });
    return;
  }

  const session = getSession(sessionId);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const spec = getSpec(sessionId);
  if (!spec) {
    res.status(400).json({ error: 'No spec found for session' });
    return;
  }

  if (secrets) {
    setSecretValues(sessionId, secrets);
  }

  const namespace = nsOverride || detectNamespace();
  const name = resourceName(session.harnessId, sessionId);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  function sendEvent(data: object): void {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  let contextDir: string | undefined;

  try {
    updateBuildStatus(sessionId, {
      buildName: name,
      phase: 'pending',
      logLines: [],
    });
    sendEvent({ type: 'status', phase: 'pending' });
    sendEvent({ type: 'log', line: `Ensuring namespace ${namespace} exists...` });
    await ensureNamespaceExists(namespace);

    contextDir = await assembleBuildContext(spec);
    sendEvent({ type: 'log', line: 'Build context assembled' });

    await buildBackend.prepare(name, namespace);
    sendEvent({ type: 'log', line: 'BuildConfig and ImageStream created' });

    updateBuildStatus(sessionId, {
      buildName: name,
      phase: 'running',
      logLines: [],
    });
    sendEvent({ type: 'status', phase: 'running' });

    const logLines: string[] = [];
    for await (const line of buildBackend.startBuild(name, namespace, contextDir)) {
      logLines.push(line);
      sendEvent({ type: 'log', line });
    }

    await buildBackend.verifyBuild(name, namespace);
    const imageRef = await buildBackend.getImageRef(name, namespace);

    updateBuildStatus(sessionId, {
      buildName: name,
      phase: 'complete',
      imageRef,
      logLines,
    });
    sendEvent({ type: 'status', phase: 'complete', imageRef });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown build error';
    updateBuildStatus(sessionId, {
      buildName: name,
      phase: 'failed',
      logLines: [],
      error: message,
    });
    sendEvent({ type: 'status', phase: 'failed', error: message });
  } finally {
    if (contextDir) {
      rm(contextDir, { recursive: true, force: true }).catch(() => {});
    }
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

export default router;
