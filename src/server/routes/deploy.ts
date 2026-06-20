import { Router } from 'express';
import {
  getSession,
  getSpec,
  getBuildStatus,
  getSecretValues,
  clearSecretValues,
  updateDeploymentInfo,
  getDeploymentInfo,
  getAllDeployments,
} from '../services/session-manager.js';
import { generateManifests } from '../services/manifest-generator.js';
import {
  applyManifests,
  waitForReady,
  buildConnectInfo,
} from '../services/deploy-service.js';
import type { ManifestSet } from '../services/deploy-service.js';
import { detectNamespace } from '../services/build-backend.js';

const router = Router();

function resourceName(harnessId: string, sessionId: string): string {
  return `agent-${harnessId}-${sessionId.slice(0, 8)}`;
}

router.post('/api/deploy', async (req, res) => {
  const { sessionId, namespace: nsOverride } = req.body as {
    sessionId?: string;
    namespace?: string;
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

  const buildStatus = getBuildStatus(sessionId);
  if (!buildStatus || buildStatus.phase !== 'complete' || !buildStatus.imageRef) {
    res.status(400).json({ error: 'Build must complete successfully before deploying' });
    return;
  }

  const namespace = nsOverride || detectNamespace();
  const name = resourceName(session.harnessId, sessionId);
  const secretValues = getSecretValues(sessionId) || {};

  try {
    updateDeploymentInfo(sessionId, {
      sessionId,
      deploymentName: name,
      namespace,
      phase: 'applying',
      imageRef: buildStatus.imageRef,
    });

    const manifests = generateManifests(
      name,
      namespace,
      spec,
      buildStatus.imageRef,
      secretValues,
    ) as unknown as ManifestSet;

    clearSecretValues(sessionId);

    const created = await applyManifests(manifests, namespace);
    console.log(`[deploy] Applied ${created.length} resources for session ${sessionId}`);

    updateDeploymentInfo(sessionId, {
      sessionId,
      deploymentName: name,
      namespace,
      phase: 'waiting',
      imageRef: buildStatus.imageRef,
    });

    const { podName } = await waitForReady(name, namespace);

    const connectInfo = buildConnectInfo(podName, namespace, spec);

    updateDeploymentInfo(sessionId, {
      sessionId,
      deploymentName: name,
      namespace,
      phase: 'running',
      imageRef: buildStatus.imageRef,
      podName,
      ...connectInfo,
    });

    res.json({
      deploymentInfo: getDeploymentInfo(sessionId),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown deploy error';
    updateDeploymentInfo(sessionId, {
      sessionId,
      deploymentName: name,
      namespace,
      phase: 'failed',
      imageRef: buildStatus.imageRef,
      error: message,
    });
    res.status(500).json({ error: message });
  }
});

router.get('/api/deployments', async (_req, res) => {
  res.json(getAllDeployments());
});

router.get('/api/deployments/:sessionId', async (req, res) => {
  const info = getDeploymentInfo(req.params.sessionId);
  if (!info) {
    res.status(404).json({ error: 'Deployment not found' });
    return;
  }
  res.json({ deploymentInfo: info });
});

export default router;
