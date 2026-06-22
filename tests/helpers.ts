import type { ContainerSpec } from '@shared/types';

export function makeSpec(overrides: Partial<ContainerSpec> = {}): ContainerSpec {
  return {
    harnessId: 'test-harness',
    baseImage: 'registry.access.redhat.com/ubi10/ubi-minimal:latest',
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
    ...overrides,
  };
}
