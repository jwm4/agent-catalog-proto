import type { ContainerSpec } from '../../shared/types.js';

export function generateContainerfile(spec: ContainerSpec): string {
  const lines: string[] = [];

  lines.push(`FROM ${spec.baseImage}`);

  const buildArgEntries = Object.entries(spec.buildArgs);
  if (buildArgEntries.length > 0) {
    lines.push('');
    for (const [key, value] of buildArgEntries) {
      lines.push(`ARG ${key}=${value}`);
    }
  }

  if (spec.runCommands.length > 0) {
    lines.push('');
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
  if (copyFiles.length > 0) {
    lines.push('');
    for (const file of copyFiles) {
      lines.push(`COPY ${file.sourcePath} ${file.destPath}`);
    }
  }

  if (spec.exposedPorts.length > 0) {
    lines.push('');
    for (const port of spec.exposedPorts) {
      lines.push(`EXPOSE ${port}`);
    }
  }

  if (spec.entrypoint.length > 0) {
    lines.push('');
    lines.push(`ENTRYPOINT ${JSON.stringify(spec.entrypoint)}`);
  }

  lines.push('');
  return lines.join('\n');
}
