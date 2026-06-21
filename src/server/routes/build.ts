import { Router } from 'express';
import { execSync } from 'child_process';
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

function ensureNamespaceExists(namespace: string): void {
  try {
    execSync(`oc get project ${namespace}`, { stdio: 'ignore' });
  } catch {
    execSync(`oc new-project ${namespace}`, { encoding: 'utf-8' });
  }
}

const router = Router();
const buildBackend = new BuildConfigBackend();

function resourceName(harnessId: string, sessionId: string): string {
  return `agent-${harnessId}-${sessionId.slice(0, 8)}`;
}

router.post('/api/build', async (req, res) => {
  const { sessionId, namespace: nsOverride, secretValues: secrets } = req.body as {
    sessionId?: string;
    namespace?: string;
    secretValues?: Record<string, string>;
  };

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
  res.flushHeaders();

  function sendEvent(data: object): void {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  let contextDir: string | undefined;

  try {
    ensureNamespaceExists(namespace);

    updateBuildStatus(sessionId, {
      buildName: name,
      phase: 'pending',
      logLines: [],
    });
    sendEvent({ type: 'status', phase: 'pending' });

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
