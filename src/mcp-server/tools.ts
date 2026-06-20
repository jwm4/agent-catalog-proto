import type { ContainerSpec, FileSpec } from '../shared/types.js';

export function createDefaultSpec(
  harnessId: string,
  baseImage: string,
): ContainerSpec {
  return {
    harnessId,
    baseImage,
    buildArgs: {},
    setupCommands: [],
    runCommands: [],
    envVars: [],
    secrets: [],
    files: [],
    volumes: [],
    entrypoint: [],
    labels: {},
    exposedPorts: [],
  };
}

export function applySetBaseImage(
  spec: ContainerSpec,
  image: string,
): ContainerSpec {
  return { ...spec, baseImage: image };
}

export function applyAddPackage(
  spec: ContainerSpec,
  manager: string,
  packages: string[],
): ContainerSpec {
  const pkgList = packages.join(' ');
  let cmd: string;

  switch (manager) {
    case 'microdnf':
      cmd = `microdnf install -y ${pkgList} && microdnf clean all`;
      break;
    case 'npm':
      cmd = `npm install -g ${pkgList}`;
      break;
    case 'pip':
      cmd = `pip install ${pkgList}`;
      break;
    case 'go':
      cmd = `go install ${pkgList}`;
      break;
    case 'cargo':
      cmd = `cargo install ${pkgList}`;
      break;
    default:
      cmd = `${manager} install ${pkgList}`;
  }

  return { ...spec, runCommands: [...spec.runCommands, cmd] };
}

export function applyAddRunCommand(
  spec: ContainerSpec,
  command: string,
): ContainerSpec {
  return { ...spec, runCommands: [...spec.runCommands, command] };
}

export function applySetEnvVar(
  spec: ContainerSpec,
  name: string,
  value: string,
): ContainerSpec {
  const filtered = spec.envVars.filter((e) => e.name !== name);
  return { ...spec, envVars: [...filtered, { name, value }] };
}

export function applyAddSecret(
  spec: ContainerSpec,
  name: string,
  description: string,
): ContainerSpec {
  if (spec.secrets.some((s) => s.name === name)) {
    return spec;
  }
  return { ...spec, secrets: [...spec.secrets, { name, description }] };
}

export function applyAddFile(
  spec: ContainerSpec,
  sourcePath: string,
  destPath: string,
  sourceType: 'local' | 'url' | 'inline',
  content?: string,
): ContainerSpec {
  const file: FileSpec = {
    sourcePath,
    destPath,
    sourceType,
    content,
    mountType: 'copy',
  };
  return { ...spec, files: [...spec.files, file] };
}

export function applyAddVolume(
  spec: ContainerSpec,
  mountPath: string,
  size: string,
  accessMode: string,
): ContainerSpec {
  const name = mountPath
    .replace(/^\//, '')
    .replace(/\//g, '-')
    .replace(/[^a-z0-9-]/gi, '');
  return {
    ...spec,
    volumes: [...spec.volumes, { name, mountPath, size, accessMode }],
  };
}

export function applySetEntrypoint(
  spec: ContainerSpec,
  command: string[],
): ContainerSpec {
  return { ...spec, entrypoint: command };
}

export function applyAddLabel(
  spec: ContainerSpec,
  key: string,
  value: string,
): ContainerSpec {
  return { ...spec, labels: { ...spec.labels, [key]: value } };
}
