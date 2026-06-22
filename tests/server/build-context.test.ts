import { readFile, rm } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { assembleBuildContext } from '@server/services/build-context.js';
import { makeSpec } from '../helpers';

const tempDirs: string[] = [];

afterEach(async () => {
  for (const dir of tempDirs) {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
  tempDirs.length = 0;
});

async function buildAndRead(
  spec: ReturnType<typeof makeSpec>,
): Promise<{ dir: string; containerfile: string }> {
  const dir = await assembleBuildContext(spec);
  tempDirs.push(dir);
  const containerfile = await readFile(join(dir, 'Containerfile'), 'utf-8');
  return { dir, containerfile };
}

describe('assembleBuildContext', () => {
  it('returns a path that exists', async () => {
    const { dir } = await buildAndRead(makeSpec());
    expect(existsSync(dir)).toBe(true);
  });

  it('writes a Containerfile to the context directory', async () => {
    const { dir } = await buildAndRead(makeSpec());
    expect(existsSync(join(dir, 'Containerfile'))).toBe(true);
  });

  it('writes inline files to the context directory', async () => {
    const spec = makeSpec({
      files: [
        {
          sourcePath: 'config.json',
          destPath: '/etc/config.json',
          sourceType: 'inline',
          content: '{"key": "value"}',
          mountType: 'copy',
        },
      ],
    });
    const { dir } = await buildAndRead(spec);
    const content = await readFile(join(dir, 'config.json'), 'utf-8');
    expect(content).toBe('{"key": "value"}');
  });
});

describe('generateContainerfile (via assembleBuildContext)', () => {
  it('starts with FROM line', async () => {
    const { containerfile } = await buildAndRead(makeSpec());
    expect(containerfile.startsWith('FROM ')).toBe(true);
  });

  it('uses the specified base image', async () => {
    const { containerfile } = await buildAndRead(
      makeSpec({ baseImage: 'my-registry/my-image:v2' }),
    );
    expect(containerfile).toContain('FROM my-registry/my-image:v2');
  });

  it('includes user creation with UID 1000 and GID 0', async () => {
    const { containerfile } = await buildAndRead(makeSpec());
    expect(containerfile).toContain(
      'RUN useradd -m -u 1000 -g 0 agent && chmod -R g=u /home/agent',
    );
  });

  it('sets HOME environment variable', async () => {
    const { containerfile } = await buildAndRead(makeSpec());
    expect(containerfile).toContain('ENV HOME=/home/agent');
  });

  it('sets USER 1000', async () => {
    const { containerfile } = await buildAndRead(makeSpec());
    expect(containerfile).toContain('USER 1000');
  });

  it('uses WORKDIR /home/agent when no workspace volume', async () => {
    const { containerfile } = await buildAndRead(makeSpec());
    expect(containerfile).toContain('WORKDIR /home/agent');
  });

  it('uses WORKDIR /workspace when workspace volume exists', async () => {
    const { containerfile } = await buildAndRead(
      makeSpec({
        volumes: [
          {
            name: 'workspace',
            mountPath: '/workspace',
            size: '1Gi',
            accessMode: 'ReadWriteOnce',
          },
        ],
      }),
    );
    expect(containerfile).toContain('WORKDIR /workspace');
  });

  it('produces CMD ["sleep", "infinity"] with no entrypoint', async () => {
    const { containerfile } = await buildAndRead(makeSpec({ entrypoint: [] }));
    expect(containerfile).toContain('CMD ["sleep", "infinity"]');
  });

  it('produces ENTRYPOINT and CMD with entrypoint set', async () => {
    const { containerfile } = await buildAndRead(
      makeSpec({ entrypoint: ['/bin/bash'] }),
    );
    expect(containerfile).toContain('ENTRYPOINT ["/bin/bash"]');
    expect(containerfile).toContain('CMD ["-c", "exec sleep infinity"]');
  });

  it('renders setupCommands before runCommands', async () => {
    const { containerfile } = await buildAndRead(
      makeSpec({
        setupCommands: ['echo setup'],
        runCommands: ['echo run'],
      }),
    );
    const setupIdx = containerfile.indexOf('echo setup');
    const runIdx = containerfile.indexOf('echo run');
    expect(setupIdx).toBeLessThan(runIdx);
    expect(containerfile).toContain('# --- Harness setup ---');
    expect(containerfile).toContain('# --- User customizations ---');
  });

  it('renders build args', async () => {
    const { containerfile } = await buildAndRead(
      makeSpec({ buildArgs: { NODE_VERSION: '20', DEBUG: 'true' } }),
    );
    expect(containerfile).toContain('ARG NODE_VERSION=20');
    expect(containerfile).toContain('ARG DEBUG=true');
  });

  it('renders env vars', async () => {
    const { containerfile } = await buildAndRead(
      makeSpec({ envVars: [{ name: 'MY_VAR', value: 'hello' }] }),
    );
    expect(containerfile).toContain('ENV MY_VAR=hello');
  });

  it('renders labels with JSON-quoted values', async () => {
    const { containerfile } = await buildAndRead(
      makeSpec({ labels: { 'io.openshift.tags': 'ai,agent' } }),
    );
    expect(containerfile).toContain('LABEL io.openshift.tags="ai,agent"');
  });

  it('renders COPY for copy-type files', async () => {
    const { containerfile } = await buildAndRead(
      makeSpec({
        files: [
          {
            sourcePath: 'app.js',
            destPath: '/opt/app.js',
            sourceType: 'inline',
            content: 'console.log("hi")',
            mountType: 'copy',
          },
        ],
      }),
    );
    expect(containerfile).toContain('COPY app.js /opt/app.js');
  });

  it('does not render COPY for configmap-type files', async () => {
    const { containerfile } = await buildAndRead(
      makeSpec({
        files: [
          {
            sourcePath: 'config.yaml',
            destPath: '/etc/config.yaml',
            sourceType: 'inline',
            content: 'key: val',
            mountType: 'configmap',
          },
        ],
      }),
    );
    expect(containerfile).not.toContain('COPY');
  });

  it('renders EXPOSE for exposed ports', async () => {
    const { containerfile } = await buildAndRead(
      makeSpec({ exposedPorts: [3000, 8080] }),
    );
    expect(containerfile).toContain('EXPOSE 3000');
    expect(containerfile).toContain('EXPOSE 8080');
  });

  it('produces no extra directives for empty arrays', async () => {
    const { containerfile } = await buildAndRead(makeSpec());
    expect(containerfile).not.toContain('ARG ');
    expect(containerfile).not.toContain('COPY ');
    expect(containerfile).not.toContain('EXPOSE ');
    expect(containerfile).not.toContain('# --- Harness setup ---');
    expect(containerfile).not.toContain('# --- User customizations ---');
  });

  it('ends with a trailing newline', async () => {
    const { containerfile } = await buildAndRead(makeSpec());
    expect(containerfile.endsWith('\n')).toBe(true);
  });
});
