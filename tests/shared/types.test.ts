import { describe, it, expect } from 'vitest';
import type { ContainerSpec, HarnessDefinition } from '../../src/shared/types';

describe('shared types', () => {
  it('should allow creating a minimal ContainerSpec', () => {
    const spec: ContainerSpec = {
      harnessId: 'opencode',
      baseImage: 'registry.access.redhat.com/ubi10/ubi-minimal:latest',
      buildArgs: {},
      setupCommands: [],
      runCommands: [],
      envVars: [],
      secrets: [],
      files: [],
      volumes: [],
      entrypoint: ['/usr/local/bin/entrypoint.sh'],
      labels: {},
      exposedPorts: [],
    };
    expect(spec.harnessId).toBe('opencode');
  });

  it('should allow creating a HarnessDefinition', () => {
    const harness: HarnessDefinition = {
      id: 'opencode',
      name: 'OpenCode',
      description: 'Open-source AI coding agent',
      longDescription: 'OpenCode is an AI coding agent by Anomaly.',
      icon: '/icons/opencode.svg',
      tags: ['OpenCode', 'Starter kit'],
      license: 'open-source',
      hasBaseImage: false,
      baseConfig: {
        harnessId: 'opencode',
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
      },
      systemPrompt: '',
      documentationUrl: 'https://github.com/opencode-ai/opencode',
      readme: '# OpenCode\n\nAn AI coding agent.',
      backends: [],
    };
    expect(harness.license).toBe('open-source');
  });
});
