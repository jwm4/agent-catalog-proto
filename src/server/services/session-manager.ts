import { randomUUID } from 'crypto';
import { WebSocket } from 'ws';
import type {
  ContainerSpec,
  BuildStatus,
  DeploymentInfo,
} from '../../shared/types.js';

interface SessionState {
  id: string;
  harnessId: string;
  spec: ContainerSpec;
  wsClients: Set<WebSocket>;
  gooseSessionId?: string;
  buildStatus?: BuildStatus;
  deploymentInfo?: DeploymentInfo;
  secretValues?: Record<string, string>;
  welcomeMessage?: string;
}

const sessions = new Map<string, SessionState>();

export function createSession(
  harnessId: string,
  baseConfig: ContainerSpec,
): string {
  const id = randomUUID();
  const spec: ContainerSpec = JSON.parse(JSON.stringify(baseConfig));
  spec.harnessId = harnessId;

  sessions.set(id, {
    id,
    harnessId,
    spec,
    wsClients: new Set(),
  });

  return id;
}

export function getSession(sessionId: string): SessionState | undefined {
  return sessions.get(sessionId);
}

export function getSpec(sessionId: string): ContainerSpec | undefined {
  return sessions.get(sessionId)?.spec;
}

export function updateSpec(sessionId: string, spec: ContainerSpec): void {
  const session = sessions.get(sessionId);
  if (!session) return;

  session.spec = spec;

  const message = JSON.stringify({ type: 'spec-update', spec });
  for (const ws of session.wsClients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  }
}

export function addWsClient(sessionId: string, ws: WebSocket): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.wsClients.add(ws);
}

export function removeWsClient(sessionId: string, ws: WebSocket): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.wsClients.delete(ws);
}

export function setGooseSessionId(
  sessionId: string,
  gooseSessionId: string,
): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.gooseSessionId = gooseSessionId;
  }
}

function broadcast(session: SessionState, data: object): void {
  const message = JSON.stringify(data);
  for (const ws of session.wsClients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  }
}

export function updateBuildStatus(
  sessionId: string,
  buildStatus: BuildStatus,
): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.buildStatus = buildStatus;
  broadcast(session, { type: 'build-update', buildStatus });
}

export function getBuildStatus(sessionId: string): BuildStatus | undefined {
  return sessions.get(sessionId)?.buildStatus;
}

export function updateDeploymentInfo(
  sessionId: string,
  deploymentInfo: DeploymentInfo,
): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.deploymentInfo = deploymentInfo;
  broadcast(session, { type: 'deploy-update', deploymentInfo });
}

export function getDeploymentInfo(
  sessionId: string,
): DeploymentInfo | undefined {
  return sessions.get(sessionId)?.deploymentInfo;
}

export function getAllDeployments(): DeploymentInfo[] {
  const results: DeploymentInfo[] = [];
  for (const session of sessions.values()) {
    if (session.deploymentInfo) {
      results.push(session.deploymentInfo);
    }
  }
  return results;
}

export function setSecretValues(
  sessionId: string,
  values: Record<string, string>,
): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.secretValues = values;
  }
}

export function getSecretValues(
  sessionId: string,
): Record<string, string> | undefined {
  return sessions.get(sessionId)?.secretValues;
}

export function clearSecretValues(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.secretValues = undefined;
  }
}

export function setWelcomeMessage(sessionId: string, message: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.welcomeMessage = message;
  }
}

export function getWelcomeMessage(sessionId: string): string | undefined {
  return sessions.get(sessionId)?.welcomeMessage;
}
