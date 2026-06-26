import { describe, it, expect } from 'vitest';
import {
  createDefaultSpec,
  applyAddPackage,
  applyAddRunCommand,
  applySetEnvVar,
  applyAddSecret,
} from '../../src/mcp-server/tools';

describe('applyAddRunCommand', () => {
  it('appends a new run command', () => {
    const spec = createDefaultSpec('opencode', 'ubi:latest');
    const result = applyAddRunCommand(spec, 'echo hello');
    expect(result.runCommands).toEqual(['echo hello']);
  });

  it('skips duplicate run command', () => {
    const spec = createDefaultSpec('opencode', 'ubi:latest');
    const once = applyAddRunCommand(spec, 'echo hello');
    const twice = applyAddRunCommand(once, 'echo hello');
    expect(twice.runCommands).toEqual(['echo hello']);
  });

  it('allows different run commands', () => {
    const spec = createDefaultSpec('opencode', 'ubi:latest');
    const first = applyAddRunCommand(spec, 'echo hello');
    const second = applyAddRunCommand(first, 'echo world');
    expect(second.runCommands).toEqual(['echo hello', 'echo world']);
  });
});

const PIP_PREREQ = 'microdnf install -y python3.12 python3.12-pip && microdnf clean all';

describe('applyAddPackage', () => {
  it('appends a new package install command', () => {
    const spec = createDefaultSpec('opencode', 'ubi:latest');
    const result = applyAddPackage(spec, 'pip', ['flask']);
    expect(result.runCommands).toEqual([PIP_PREREQ, 'pip install flask']);
  });

  it('skips duplicate package install command', () => {
    const spec = createDefaultSpec('opencode', 'ubi:latest');
    const once = applyAddPackage(spec, 'pip', ['flask']);
    const twice = applyAddPackage(once, 'pip', ['flask']);
    expect(twice.runCommands).toEqual([PIP_PREREQ, 'pip install flask']);
  });

  it('allows same packages with different managers', () => {
    const spec = createDefaultSpec('opencode', 'ubi:latest');
    const pip = applyAddPackage(spec, 'pip', ['flask']);
    const npm = applyAddPackage(pip, 'npm', ['express']);
    expect(npm.runCommands).toHaveLength(3);
  });

  it('generates correct microdnf command', () => {
    const spec = createDefaultSpec('opencode', 'ubi:latest');
    const result = applyAddPackage(spec, 'microdnf', ['git', 'curl']);
    expect(result.runCommands).toEqual([
      'microdnf install -y git curl && microdnf clean all',
    ]);
  });

  it('auto-installs python when pip is used without it', () => {
    const spec = createDefaultSpec('opencode', 'ubi:latest');
    const result = applyAddPackage(spec, 'pip', ['requests']);
    expect(result.runCommands[0]).toBe(PIP_PREREQ);
    expect(result.runCommands[1]).toBe('pip install requests');
  });

  it('skips python install when python is already in setupCommands', () => {
    const spec = {
      ...createDefaultSpec('opencode', 'ubi:latest'),
      setupCommands: ['microdnf install -y python3.12 python3.12-pip && microdnf clean all'],
    };
    const result = applyAddPackage(spec, 'pip', ['flask']);
    expect(result.runCommands).toEqual(['pip install flask']);
  });

  it('skips python install when python is already in runCommands', () => {
    const spec = createDefaultSpec('opencode', 'ubi:latest');
    const withPython = applyAddPackage(spec, 'microdnf', ['python3.12', 'python3.12-pip']);
    const withFlask = applyAddPackage(withPython, 'pip', ['flask']);
    expect(withFlask.runCommands).toEqual([
      'microdnf install -y python3.12 python3.12-pip && microdnf clean all',
      'pip install flask',
    ]);
  });
});

describe('applySetEnvVar', () => {
  it('upserts env var by name', () => {
    const spec = createDefaultSpec('opencode', 'ubi:latest');
    const first = applySetEnvVar(spec, 'FOO', 'bar');
    const second = applySetEnvVar(first, 'FOO', 'baz');
    expect(second.envVars).toEqual([{ name: 'FOO', value: 'baz' }]);
  });
});

describe('applyAddSecret', () => {
  it('skips duplicate secret by name', () => {
    const spec = createDefaultSpec('opencode', 'ubi:latest');
    const once = applyAddSecret(spec, 'API_KEY', 'An API key');
    const twice = applyAddSecret(once, 'API_KEY', 'Same key again');
    expect(twice.secrets).toHaveLength(1);
    expect(twice.secrets[0].description).toBe('An API key');
  });
});
