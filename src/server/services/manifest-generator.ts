import type { ContainerSpec } from '../../shared/types.js';

export interface ManifestSet {
  deployment: object;
  pvcs: object[];
  configMaps: object[];
  secret: object | null;
  service: object | null;
  route: object | null;
}

export function generateManifests(
  name: string,
  namespace: string,
  spec: ContainerSpec,
  imageRef: string,
  secretValues: Record<string, string>,
): ManifestSet {
  const labels = { app: name, 'app.kubernetes.io/managed-by': 'agent-catalog' };

  const pvcs = spec.volumes.map((vol) => ({
    apiVersion: 'v1',
    kind: 'PersistentVolumeClaim',
    metadata: { name: `${name}-${vol.name}`, namespace, labels },
    spec: {
      accessModes: [vol.accessMode],
      resources: { requests: { storage: vol.size } },
      ...(vol.storageClass ? { storageClassName: vol.storageClass } : {}),
    },
  }));

  const configMapFiles = spec.files.filter((f) => f.mountType === 'configmap');
  const configMaps = configMapFiles.map((file) => ({
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata: {
      name: `${name}-${file.sourcePath.replace(/[^a-z0-9-]/gi, '-').toLowerCase()}`,
      namespace,
      labels,
    },
    data: {
      [file.sourcePath]: file.content || '',
    },
  }));

  let secret: object | null = null;
  if (spec.secrets.length > 0) {
    const secretData: Record<string, string> = {};
    for (const s of spec.secrets) {
      const val = secretValues[s.name] || '';
      secretData[s.name] = Buffer.from(val).toString('base64');
    }
    secret = {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: { name: `${name}-secrets`, namespace, labels },
      type: 'Opaque',
      data: secretData,
    };
  }

  const envFrom: object[] = [];
  const env = spec.envVars.map((e) => ({ name: e.name, value: e.value }));

  if (spec.secrets.length > 0) {
    for (const s of spec.secrets) {
      env.push({
        name: s.name,
        value: undefined as unknown as string,
        ...{
          valueFrom: {
            secretKeyRef: { name: `${name}-secrets`, key: s.name },
          },
        },
      });
    }
  }

  const volumeMounts: object[] = [];
  const volumes: object[] = [];

  for (const vol of spec.volumes) {
    const pvcName = `${name}-${vol.name}`;
    volumes.push({
      name: vol.name,
      persistentVolumeClaim: { claimName: pvcName },
    });
    volumeMounts.push({ name: vol.name, mountPath: vol.mountPath });
  }

  for (const cm of configMaps) {
    const cmName = (cm.metadata as { name: string }).name;
    const volName = `cm-${cmName}`;
    const file = configMapFiles.find(
      (f) =>
        `${name}-${f.sourcePath.replace(/[^a-z0-9-]/gi, '-').toLowerCase()}` ===
        cmName,
    );
    volumes.push({
      name: volName,
      configMap: { name: cmName },
    });
    volumeMounts.push({
      name: volName,
      mountPath: file?.destPath || `/config/${cmName}`,
      subPath: file?.sourcePath,
    });
  }

  const deployment = {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: { name, namespace, labels },
    spec: {
      replicas: 1,
      strategy: { type: 'Recreate' },
      selector: { matchLabels: { app: name } },
      template: {
        metadata: { labels: { app: name } },
        spec: {
          securityContext: {
            runAsNonRoot: true,
            seccompProfile: { type: 'RuntimeDefault' },
          },
          containers: [
            {
              name: 'agent',
              image: imageRef,
              env: env.length > 0 ? env : undefined,
              envFrom: envFrom.length > 0 ? envFrom : undefined,
              volumeMounts: volumeMounts.length > 0 ? volumeMounts : undefined,
              resources: {
                requests: { memory: '256Mi', cpu: '250m' },
                limits: { memory: '2Gi', cpu: '1000m' },
              },
              securityContext: {
                allowPrivilegeEscalation: false,
                capabilities: { drop: ['ALL'] },
              },
              ...(spec.exposedPorts.length > 0
                ? {
                    ports: spec.exposedPorts.map((p) => ({
                      containerPort: p,
                      protocol: 'TCP',
                    })),
                  }
                : {}),
            },
          ],
          volumes: volumes.length > 0 ? volumes : undefined,
        },
      },
    },
  };

  let service: object | null = null;
  if (spec.exposedPorts.length > 0) {
    service = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: { name, namespace, labels },
      spec: {
        selector: { app: name },
        ports: spec.exposedPorts.map((p) => ({
          port: p,
          targetPort: p,
          protocol: 'TCP',
        })),
      },
    };
  }

  let route: object | null = null;
  if (spec.exposedPorts.length > 0) {
    route = {
      apiVersion: 'route.openshift.io/v1',
      kind: 'Route',
      metadata: { name, namespace, labels },
      spec: {
        to: { kind: 'Service', name, weight: 100 },
        port: { targetPort: spec.exposedPorts[0] },
        tls: { termination: 'edge' },
      },
    };
  }

  return { deployment, pvcs, configMaps, secret, service, route };
}
