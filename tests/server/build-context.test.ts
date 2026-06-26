import { readFile, rm } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import {
  assembleBuildContext,
  isUnderVolume,
  generateInitScript,
} from '@server/services/build-context.js';
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

describe('isUnderVolume', () => {
  const volumes = [
    { name: 'workspace', mountPath: '/workspace', size: '1Gi', accessMode: 'ReadWriteOnce' },
  ];

  it('returns true for paths under a volume mount', () => {
    expect(isUnderVolume('/workspace/.opencode/config.json', volumes)).toBe(true);
    expect(isUnderVolume('/workspace/file.txt', volumes)).toBe(true);
  });

  it('returns true for exact volume mount path', () => {
    expect(isUnderVolume('/workspace', volumes)).toBe(true);
  });

  it('returns false for paths not under a volume mount', () => {
    expect(isUnderVolume('/etc/config.json', volumes)).toBe(false);
    expect(isUnderVolume('/opt/app.js', volumes)).toBe(false);
  });

  it('does not match partial path prefixes', () => {
    expect(isUnderVolume('/workspace-data/file.txt', volumes)).toBe(false);
  });
});

describe('generateInitScript', () => {
  it('produces cp -n commands for each file', () => {
    const script = generateInitScript([
      {
        sourcePath: 'config.json',
        destPath: '/workspace/.opencode/config.json',
        sourceType: 'inline',
        content: '{}',
        mountType: 'copy',
      },
    ]);
    expect(script).toContain('#!/bin/bash');
    expect(script).toContain('mkdir -p /workspace/.opencode');
    expect(script).toContain(
      'cp -n /opt/agent-init/files/workspace/.opencode/config.json /workspace/.opencode/config.json',
    );
    expect(script).toContain('exec "$@"');
  });

  it('handles multiple files', () => {
    const script = generateInitScript([
      {
        sourcePath: 'a.json',
        destPath: '/workspace/a.json',
        sourceType: 'inline',
        content: '{}',
        mountType: 'copy',
      },
      {
        sourcePath: 'b.txt',
        destPath: '/workspace/sub/b.txt',
        sourceType: 'inline',
        content: 'hello',
        mountType: 'copy',
      },
    ]);
    expect(script).toContain('cp -n /opt/agent-init/files/workspace/a.json /workspace/a.json');
    expect(script).toContain('mkdir -p /workspace/sub');
    expect(script).toContain('cp -n /opt/agent-init/files/workspace/sub/b.txt /workspace/sub/b.txt');
  });
});

describe('staged files (files under volume mounts)', () => {
  const workspace = {
    name: 'workspace',
    mountPath: '/workspace',
    size: '1Gi',
    accessMode: 'ReadWriteOnce',
  };

  it('stages files under volume mounts to /opt/agent-init/files/', async () => {
    const { containerfile } = await buildAndRead(
      makeSpec({
        volumes: [workspace],
        files: [
          {
            sourcePath: 'config.json',
            destPath: '/workspace/.opencode/config.json',
            sourceType: 'inline',
            content: '{}',
            mountType: 'copy',
          },
        ],
      }),
    );
    expect(containerfile).toContain(
      'COPY config.json /opt/agent-init/files/workspace/.opencode/config.json',
    );
    expect(containerfile).not.toContain('COPY config.json /workspace/');
  });

  it('copies files not under volume mounts directly', async () => {
    const { containerfile } = await buildAndRead(
      makeSpec({
        volumes: [workspace],
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
    expect(containerfile).not.toContain('/opt/agent-init/');
  });

  it('handles a mix of direct and staged files', async () => {
    const { containerfile } = await buildAndRead(
      makeSpec({
        volumes: [workspace],
        files: [
          {
            sourcePath: 'app.js',
            destPath: '/opt/app.js',
            sourceType: 'inline',
            content: 'console.log("hi")',
            mountType: 'copy',
          },
          {
            sourcePath: 'config.json',
            destPath: '/workspace/.opencode/config.json',
            sourceType: 'inline',
            content: '{}',
            mountType: 'copy',
          },
        ],
      }),
    );
    expect(containerfile).toContain('COPY app.js /opt/app.js');
    expect(containerfile).toContain(
      'COPY config.json /opt/agent-init/files/workspace/.opencode/config.json',
    );
  });

  it('adds init script COPY and chmod when staged files exist', async () => {
    const { containerfile } = await buildAndRead(
      makeSpec({
        volumes: [workspace],
        files: [
          {
            sourcePath: 'config.json',
            destPath: '/workspace/.opencode/config.json',
            sourceType: 'inline',
            content: '{}',
            mountType: 'copy',
          },
        ],
      }),
    );
    expect(containerfile).toContain('COPY _init.sh /opt/agent-init/init.sh');
    expect(containerfile).toContain('RUN chmod +x /opt/agent-init/init.sh');
  });

  it('wraps entrypoint with init script when staged files exist', async () => {
    const { containerfile } = await buildAndRead(
      makeSpec({
        volumes: [workspace],
        entrypoint: ['/bin/bash'],
        files: [
          {
            sourcePath: 'config.json',
            destPath: '/workspace/.opencode/config.json',
            sourceType: 'inline',
            content: '{}',
            mountType: 'copy',
          },
        ],
      }),
    );
    expect(containerfile).toContain('ENTRYPOINT ["/opt/agent-init/init.sh"]');
    expect(containerfile).toContain('CMD ["/bin/bash","-c","exec sleep infinity"]');
    expect(containerfile).not.toContain('ENTRYPOINT ["/bin/bash"]');
  });

  it('uses init script entrypoint with CMD sleep when no original entrypoint', async () => {
    const { containerfile } = await buildAndRead(
      makeSpec({
        volumes: [workspace],
        entrypoint: [],
        files: [
          {
            sourcePath: 'config.json',
            destPath: '/workspace/.opencode/config.json',
            sourceType: 'inline',
            content: '{}',
            mountType: 'copy',
          },
        ],
      }),
    );
    expect(containerfile).toContain('ENTRYPOINT ["/opt/agent-init/init.sh"]');
    expect(containerfile).toContain('CMD ["sleep", "infinity"]');
  });

  it('writes _init.sh to build context when staged files exist', async () => {
    const { dir } = await buildAndRead(
      makeSpec({
        volumes: [workspace],
        files: [
          {
            sourcePath: 'config.json',
            destPath: '/workspace/.opencode/config.json',
            sourceType: 'inline',
            content: '{}',
            mountType: 'copy',
          },
        ],
      }),
    );
    expect(existsSync(join(dir, '_init.sh'))).toBe(true);
    const script = await readFile(join(dir, '_init.sh'), 'utf-8');
    expect(script).toContain('#!/bin/bash');
    expect(script).toContain('cp -n');
    expect(script).toContain('exec "$@"');
  });

  it('does not write _init.sh when no staged files', async () => {
    const { dir } = await buildAndRead(
      makeSpec({
        volumes: [workspace],
        files: [],
      }),
    );
    expect(existsSync(join(dir, '_init.sh'))).toBe(false);
  });
});
