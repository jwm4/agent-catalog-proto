import { generateManifests } from '@server/services/manifest-generator.js';
import { makeSpec } from '../helpers';

const NAME = 'test-agent';
const NS = 'test-ns';
const IMAGE = 'registry.example.com/agent:latest';

function generate(
  specOverrides: Parameters<typeof makeSpec>[0] = {},
  secretValues: Record<string, string> = {},
) {
  return generateManifests(NAME, NS, makeSpec(specOverrides), IMAGE, secretValues);
}

describe('manifest-generator', () => {
  describe('deployment', () => {
    it('has correct apiVersion, kind, and metadata', () => {
      const { deployment } = generate();
      const d = deployment as Record<string, unknown>;
      expect(d.apiVersion).toBe('apps/v1');
      expect(d.kind).toBe('Deployment');
      const meta = d.metadata as Record<string, unknown>;
      expect(meta.name).toBe(NAME);
      expect(meta.namespace).toBe(NS);
    });

    it('has app and managed-by labels', () => {
      const { deployment } = generate();
      const labels = (deployment as Record<string, unknown>).metadata as Record<
        string,
        unknown
      >;
      expect((labels.labels as Record<string, string>).app).toBe(NAME);
      expect(
        (labels.labels as Record<string, string>)[
          'app.kubernetes.io/managed-by'
        ],
      ).toBe('agent-catalog');
    });

    it('uses Recreate strategy', () => {
      const { deployment } = generate();
      const spec = (deployment as Record<string, unknown>).spec as Record<
        string,
        unknown
      >;
      expect(spec.strategy).toEqual({ type: 'Recreate' });
    });

    it('sets runAsNonRoot security context', () => {
      const { deployment } = generate();
      const podSpec = (
        (deployment as Record<string, unknown>).spec as Record<string, unknown>
      ).template as Record<string, unknown>;
      const spec = (podSpec as Record<string, unknown>).spec as Record<
        string,
        unknown
      >;
      const sc = spec.securityContext as Record<string, unknown>;
      expect(sc.runAsNonRoot).toBe(true);
    });

    it('sets container security: no privilege escalation, drops ALL', () => {
      const { deployment } = generate();
      const containers = getContainers(deployment);
      expect(containers[0].securityContext).toEqual({
        allowPrivilegeEscalation: false,
        capabilities: { drop: ['ALL'] },
      });
    });

    it('sets resource requests and limits', () => {
      const { deployment } = generate();
      const containers = getContainers(deployment);
      const resources = containers[0].resources as Record<
        string,
        Record<string, string>
      >;
      expect(resources.requests.memory).toBe('256Mi');
      expect(resources.limits.memory).toBe('2Gi');
    });

    it('uses the provided image reference', () => {
      const { deployment } = generate();
      const containers = getContainers(deployment);
      expect(containers[0].image).toBe(IMAGE);
    });
  });

  describe('PVCs', () => {
    it('returns empty array when no volumes', () => {
      const { pvcs } = generate();
      expect(pvcs).toEqual([]);
    });

    it('creates a PVC per volume', () => {
      const { pvcs } = generate({
        volumes: [
          { name: 'data', mountPath: '/data', size: '5Gi', accessMode: 'ReadWriteOnce' },
          { name: 'cache', mountPath: '/cache', size: '1Gi', accessMode: 'ReadWriteMany' },
        ],
      });
      expect(pvcs).toHaveLength(2);
    });

    it('names PVCs as name-volname', () => {
      const { pvcs } = generate({
        volumes: [
          { name: 'workspace', mountPath: '/workspace', size: '1Gi', accessMode: 'ReadWriteOnce' },
        ],
      });
      const pvc = pvcs[0] as Record<string, unknown>;
      expect((pvc.metadata as Record<string, unknown>).name).toBe(
        `${NAME}-workspace`,
      );
    });

    it('includes storageClass only when specified', () => {
      const { pvcs: without } = generate({
        volumes: [
          { name: 'v1', mountPath: '/v1', size: '1Gi', accessMode: 'ReadWriteOnce' },
        ],
      });
      expect(
        (without[0] as Record<string, unknown>).spec as Record<string, unknown>,
      ).not.toHaveProperty('storageClassName');

      const { pvcs: withSC } = generate({
        volumes: [
          {
            name: 'v2',
            mountPath: '/v2',
            size: '1Gi',
            accessMode: 'ReadWriteOnce',
            storageClass: 'gp3',
          },
        ],
      });
      expect(
        ((withSC[0] as Record<string, unknown>).spec as Record<string, unknown>)
          .storageClassName,
      ).toBe('gp3');
    });

    it('creates volume mounts in the deployment', () => {
      const { deployment } = generate({
        volumes: [
          { name: 'workspace', mountPath: '/workspace', size: '1Gi', accessMode: 'ReadWriteOnce' },
        ],
      });
      const containers = getContainers(deployment);
      expect(containers[0].volumeMounts).toContainEqual({
        name: 'workspace',
        mountPath: '/workspace',
      });
    });
  });

  describe('configMaps', () => {
    it('creates ConfigMap for configmap-type files', () => {
      const { configMaps } = generate({
        files: [
          {
            sourcePath: 'config.json',
            destPath: '/etc/config.json',
            sourceType: 'inline',
            content: '{"a":1}',
            mountType: 'configmap',
          },
        ],
      });
      expect(configMaps).toHaveLength(1);
      const cm = configMaps[0] as Record<string, unknown>;
      expect((cm.data as Record<string, string>)['config.json']).toBe('{"a":1}');
    });

    it('does not create ConfigMap for copy-type files', () => {
      const { configMaps } = generate({
        files: [
          {
            sourcePath: 'app.js',
            destPath: '/opt/app.js',
            sourceType: 'inline',
            content: 'code',
            mountType: 'copy',
          },
        ],
      });
      expect(configMaps).toHaveLength(0);
    });

    it('sanitizes sourcePath for ConfigMap name', () => {
      const { configMaps } = generate({
        files: [
          {
            sourcePath: 'my/file.config.yaml',
            destPath: '/etc/config.yaml',
            sourceType: 'inline',
            content: 'x',
            mountType: 'configmap',
          },
        ],
      });
      const cm = configMaps[0] as Record<string, unknown>;
      const cmName = (cm.metadata as Record<string, unknown>).name as string;
      expect(cmName).toMatch(/^[a-z0-9-]+$/);
      expect(cmName).not.toContain('/');
      expect(cmName).not.toContain('.');
    });

    it('defaults content to empty string when missing', () => {
      const { configMaps } = generate({
        files: [
          {
            sourcePath: 'empty.txt',
            destPath: '/etc/empty.txt',
            sourceType: 'inline',
            mountType: 'configmap',
          },
        ],
      });
      const cm = configMaps[0] as Record<string, unknown>;
      expect((cm.data as Record<string, string>)['empty.txt']).toBe('');
    });
  });

  describe('secrets', () => {
    it('returns null when no secrets defined', () => {
      const { secret } = generate();
      expect(secret).toBeNull();
    });

    it('creates a Secret with base64-encoded values', () => {
      const { secret } = generate(
        { secrets: [{ name: 'API_KEY', description: 'key' }] },
        { API_KEY: 'my-secret' },
      );
      const data = (secret as Record<string, unknown>).data as Record<
        string,
        string
      >;
      expect(data.API_KEY).toBe(Buffer.from('my-secret').toString('base64'));
    });

    it('uses empty string for missing secret values', () => {
      const { secret } = generate({
        secrets: [{ name: 'MISSING', description: 'not provided' }],
      });
      const data = (secret as Record<string, unknown>).data as Record<
        string,
        string
      >;
      expect(data.MISSING).toBe(Buffer.from('').toString('base64'));
    });

    it('names the secret as name-secrets', () => {
      const { secret } = generate({
        secrets: [{ name: 'KEY', description: 'k' }],
      });
      const meta = (secret as Record<string, unknown>).metadata as Record<
        string,
        unknown
      >;
      expect(meta.name).toBe(`${NAME}-secrets`);
    });

    it('adds secretKeyRef env vars to the deployment', () => {
      const { deployment } = generate({
        secrets: [{ name: 'API_KEY', description: 'key' }],
      });
      const containers = getContainers(deployment);
      const env = containers[0].env as Array<Record<string, unknown>>;
      const secretEnv = env.find(
        (e: Record<string, unknown>) => e.name === 'API_KEY',
      );
      expect(secretEnv).toBeDefined();
      expect(secretEnv!.valueFrom).toEqual({
        secretKeyRef: { name: `${NAME}-secrets`, key: 'API_KEY' },
      });
    });
  });

  describe('service and route', () => {
    it('returns null service and route when no ports', () => {
      const { service, route } = generate();
      expect(service).toBeNull();
      expect(route).toBeNull();
    });

    it('creates Service with correct ports', () => {
      const { service } = generate({ exposedPorts: [3000, 8080] });
      const spec = (service as Record<string, unknown>).spec as Record<
        string,
        unknown
      >;
      const ports = spec.ports as Array<Record<string, unknown>>;
      expect(ports).toHaveLength(2);
      expect(ports[0].port).toBe(3000);
      expect(ports[1].port).toBe(8080);
    });

    it('creates Route with first port and edge TLS', () => {
      const { route } = generate({ exposedPorts: [8080, 3000] });
      const spec = (route as Record<string, unknown>).spec as Record<
        string,
        unknown
      >;
      expect((spec.port as Record<string, unknown>).targetPort).toBe(8080);
      expect((spec.tls as Record<string, unknown>).termination).toBe('edge');
    });

    it('Route targets the correct service', () => {
      const { route } = generate({ exposedPorts: [3000] });
      const spec = (route as Record<string, unknown>).spec as Record<
        string,
        unknown
      >;
      const to = spec.to as Record<string, unknown>;
      expect(to.kind).toBe('Service');
      expect(to.name).toBe(NAME);
    });
  });
});

function getContainers(deployment: object): Array<Record<string, unknown>> {
  const d = deployment as Record<string, unknown>;
  const spec = d.spec as Record<string, unknown>;
  const template = spec.template as Record<string, unknown>;
  const podSpec = (template as Record<string, unknown>).spec as Record<
    string,
    unknown
  >;
  return podSpec.containers as Array<Record<string, unknown>>;
}
