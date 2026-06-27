import * as k8s from '@kubernetes/client-node';
import type { ContainerSpec } from '../../shared/types.js';

export interface ManifestSet {
  deployment: k8s.KubernetesObject;
  pvcs: k8s.KubernetesObject[];
  configMaps: k8s.KubernetesObject[];
  secret: k8s.KubernetesObject | null;
  service: k8s.KubernetesObject | null;
  route: k8s.KubernetesObject | null;
}

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const objectApi = k8s.KubernetesObjectApi.makeApiClient(kc);

async function applyResource(
  spec: k8s.KubernetesObject,
): Promise<string> {
  const name = spec.metadata?.name || 'unknown';
  const kind = spec.kind || 'unknown';
  try {
    await objectApi.create(spec);
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (statusCode === 409) {
      await objectApi.patch(spec);
    } else {
      throw err;
    }
  }
  return `${kind}/${name}`;
}

export async function applyManifests(
  manifests: ManifestSet,
  namespace: string,
): Promise<string[]> {
  const created: string[] = [];

  for (const pvc of manifests.pvcs) {
    pvc.metadata = { ...pvc.metadata, namespace };
    created.push(await applyResource(pvc));
  }

  for (const cm of manifests.configMaps) {
    cm.metadata = { ...cm.metadata, namespace };
    created.push(await applyResource(cm));
  }

  if (manifests.secret) {
    manifests.secret.metadata = { ...manifests.secret.metadata, namespace };
    created.push(await applyResource(manifests.secret));
  }

  manifests.deployment.metadata = {
    ...manifests.deployment.metadata,
    namespace,
  };
  created.push(await applyResource(manifests.deployment));

  if (manifests.service) {
    manifests.service.metadata = { ...manifests.service.metadata, namespace };
    created.push(await applyResource(manifests.service));
  }

  if (manifests.route) {
    manifests.route.metadata = { ...manifests.route.metadata, namespace };
    created.push(await applyResource(manifests.route));
  }

  return created;
}

export async function waitForReady(
  deploymentName: string,
  namespace: string,
  timeoutMs = 120_000,
): Promise<{ podName: string; phase: string }> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const deployment = await objectApi.read<k8s.V1Deployment>({
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: { name: deploymentName, namespace },
      });

      const available = deployment.status?.availableReplicas ?? 0;
      if (available >= 1) {
        const podList = await objectApi.list<k8s.V1Pod>(
          'v1',
          'Pod',
          namespace,
          undefined,
          undefined,
          undefined,
          undefined,
          `app=${deploymentName}`,
        );

        const runningPod = podList.items.find(
          (p) => p.status?.phase === 'Running',
        );
        if (runningPod?.metadata?.name) {
          return {
            podName: runningPod.metadata.name,
            phase: 'Running',
          };
        }
      }
    } catch {
      // deployment may not exist yet, keep polling
    }

    await new Promise((r) => setTimeout(r, 3000));
  }

  throw new Error(
    `Timed out waiting for deployment ${deploymentName} to become ready`,
  );
}

export async function lookupMlflowUrl(): Promise<string | undefined> {
  try {
    const result = await objectApi.read({
      apiVersion: 'console.openshift.io/v1',
      kind: 'ConsoleLink',
      metadata: { name: 'mlflow' },
    });
    const href = (result as { spec?: { href?: string } }).spec?.href;
    return href || undefined;
  } catch {
    return undefined;
  }
}

export function buildConnectInfo(
  podName: string,
  namespace: string,
  spec: ContainerSpec,
): {
  connectCommand: string;
  routeUrl?: string;
  portForwardCommand?: string;
} {
  const connectCommand = `oc exec -it ${podName} -n ${namespace} -- bash`;

  let portForwardCommand: string | undefined;

  if (spec.exposedPorts.length > 0) {
    const port = spec.exposedPorts[0];
    portForwardCommand = `oc port-forward ${podName} ${port}:${port} -n ${namespace}`;
  }

  return { connectCommand, portForwardCommand };
}
