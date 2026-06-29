import { mkdtemp, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import type { ContainerSpec, FileSpec, VolumeSpec } from '../../shared/types.js';

export function isUnderVolume(destPath: string, volumes: VolumeSpec[]): boolean {
  return volumes.some(
    (v) => destPath === v.mountPath || destPath.startsWith(v.mountPath + '/'),
  );
}

export function generateInitScript(stagedFiles: FileSpec[]): string {
  const lines: string[] = ['#!/bin/bash'];
  for (const file of stagedFiles) {
    const dir = dirname(file.destPath);
    lines.push(`mkdir -p ${dir}`);
    lines.push(
      `cp -n /opt/agent-init/files${file.destPath} ${file.destPath} 2>/dev/null || true`,
    );
  }
  lines.push('exec "$@"');
  lines.push('');
  return lines.join('\n');
}

function generateContainerfile(spec: ContainerSpec): string {
  const lines: string[] = [];

  lines.push(`FROM ${spec.baseImage}`);

  const buildArgEntries = Object.entries(spec.buildArgs);
  if (buildArgEntries.length > 0) {
    lines.push('');
    for (const [key, value] of buildArgEntries) {
      lines.push(`ARG ${key}=${value}`);
    }
  }

  if (spec.setupCommands && spec.setupCommands.length > 0) {
    lines.push('');
    lines.push('# --- Harness setup ---');
    for (const cmd of spec.setupCommands) {
      lines.push(`RUN ${cmd}`);
    }
  }

  if (spec.runCommands.length > 0) {
    lines.push('');
    lines.push('# --- User customizations ---');
    for (const cmd of spec.runCommands) {
      lines.push(`RUN ${cmd}`);
    }
  }

  if (spec.envVars.length > 0) {
    lines.push('');
    for (const env of spec.envVars) {
      lines.push(`ENV ${env.name}=${env.value}`);
    }
  }

  const labelEntries = Object.entries(spec.labels);
  if (labelEntries.length > 0) {
    lines.push('');
    for (const [key, value] of labelEntries) {
      lines.push(`LABEL ${key}=${JSON.stringify(value)}`);
    }
  }

  const copyFiles = spec.files.filter((f) => f.mountType === 'copy');
  const directFiles = copyFiles.filter(
    (f) => !isUnderVolume(f.destPath, spec.volumes),
  );
  const stagedFiles = copyFiles.filter((f) =>
    isUnderVolume(f.destPath, spec.volumes),
  );

  if (directFiles.length > 0) {
    lines.push('');
    for (const file of directFiles) {
      lines.push(`COPY ${file.sourcePath} ${file.destPath}`);
    }
  }

  if (stagedFiles.length > 0) {
    lines.push('');
    for (const file of stagedFiles) {
      lines.push(
        `COPY ${file.sourcePath} /opt/agent-init/files${file.destPath}`,
      );
    }
    lines.push('COPY _init.sh /opt/agent-init/init.sh');
    lines.push('RUN chmod +x /opt/agent-init/init.sh');
  }

  if (spec.exposedPorts.length > 0) {
    lines.push('');
    for (const port of spec.exposedPorts) {
      lines.push(`EXPOSE ${port}`);
    }
  }

  lines.push('');
  lines.push('RUN useradd -m -u 1000 -g 0 agent && chmod -R g=u /home/agent');
  lines.push('ENV HOME=/home/agent');
  lines.push('USER 1000');

  const workdir = spec.volumes.find((v) => v.mountPath === '/workspace');
  lines.push(`WORKDIR ${workdir ? workdir.mountPath : '/home/agent'}`);

  const isShellEntrypoint =
    spec.entrypoint.length > 0 &&
    ['/bin/bash', '/bin/sh', 'bash', 'sh'].includes(spec.entrypoint[0]);
  const isCustomEntrypoint =
    spec.entrypoint.length > 0 && !isShellEntrypoint;

  if (stagedFiles.length > 0) {
    lines.push('');
    lines.push('ENTRYPOINT ["/opt/agent-init/init.sh"]');
    if (isCustomEntrypoint) {
      lines.push(`CMD ${JSON.stringify(spec.entrypoint)}`);
    } else if (isShellEntrypoint) {
      lines.push(
        `CMD ${JSON.stringify([...spec.entrypoint, '-c', 'exec sleep infinity'])}`,
      );
    } else {
      lines.push('CMD ["sleep", "infinity"]');
    }
  } else if (isCustomEntrypoint) {
    lines.push('');
    lines.push(`ENTRYPOINT ${JSON.stringify(spec.entrypoint)}`);
  } else if (isShellEntrypoint) {
    lines.push('');
    lines.push(`ENTRYPOINT ${JSON.stringify(spec.entrypoint)}`);
    lines.push('CMD ["-c", "exec sleep infinity"]');
  } else {
    lines.push('CMD ["sleep", "infinity"]');
  }

  lines.push('');
  return lines.join('\n');
}

export async function assembleBuildContext(
  spec: ContainerSpec,
): Promise<string> {
  const contextDir = await mkdtemp(join(tmpdir(), 'agent-build-'));

  const containerfile = generateContainerfile(spec);
  await writeFile(join(contextDir, 'Containerfile'), containerfile, 'utf-8');

  const copyFiles = spec.files.filter((f) => f.mountType === 'copy');
  for (const file of copyFiles) {
    if (file.sourceType === 'inline' && file.content) {
      const dest = join(contextDir, file.sourcePath);
      const dir = join(dest, '..');
      await mkdir(dir, { recursive: true });
      await writeFile(dest, file.content, 'utf-8');
    }
  }

  const stagedFiles = copyFiles.filter((f) =>
    isUnderVolume(f.destPath, spec.volumes),
  );
  if (stagedFiles.length > 0) {
    const initScript = generateInitScript(stagedFiles);
    await writeFile(join(contextDir, '_init.sh'), initScript, 'utf-8');
  }

  return contextDir;
}
