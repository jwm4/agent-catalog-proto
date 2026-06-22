import {
  createSession,
  getSession,
  getSpec,
  updateSpec,
  updateBuildStatus,
  getBuildStatus,
  setSecretValues,
  getSecretValues,
  clearSecretValues,
  updateDeploymentInfo,
  getDeploymentInfo,
  getAllDeployments,
  setWelcomeMessage,
  getWelcomeMessage,
} from '@server/services/session-manager.js';
import { makeSpec } from '../helpers';
import type { BuildStatus, DeploymentInfo } from '@shared/types';

describe('session-manager', () => {
  describe('createSession', () => {
    it('returns a UUID-format string', () => {
      const id = createSession('opencode', makeSpec());
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it('deep-clones baseConfig so mutations do not affect the stored spec', () => {
      const original = makeSpec({ runCommands: ['echo hello'] });
      const id = createSession('opencode', original);
      original.runCommands.push('echo mutated');
      const stored = getSpec(id);
      expect(stored!.runCommands).toEqual(['echo hello']);
    });

    it('sets harnessId on the stored spec', () => {
      const id = createSession('my-harness', makeSpec());
      expect(getSpec(id)!.harnessId).toBe('my-harness');
    });
  });

  describe('getSession', () => {
    it('returns undefined for unknown ID', () => {
      expect(getSession('nonexistent-id')).toBeUndefined();
    });

    it('returns the session for a valid ID', () => {
      const id = createSession('opencode', makeSpec());
      const session = getSession(id);
      expect(session).toBeDefined();
      expect(session!.harnessId).toBe('opencode');
    });
  });

  describe('getSpec / updateSpec', () => {
    it('returns the spec for a valid session', () => {
      const spec = makeSpec({ baseImage: 'my-image:latest' });
      const id = createSession('test', spec);
      expect(getSpec(id)!.baseImage).toBe('my-image:latest');
    });

    it('returns undefined for unknown session', () => {
      expect(getSpec('nonexistent')).toBeUndefined();
    });

    it('replaces the full spec on update', () => {
      const id = createSession('test', makeSpec({ runCommands: ['a'] }));
      const newSpec = makeSpec({ runCommands: ['b', 'c'], baseImage: 'new:1' });
      updateSpec(id, newSpec);
      const result = getSpec(id)!;
      expect(result.runCommands).toEqual(['b', 'c']);
      expect(result.baseImage).toBe('new:1');
    });

    it('silently no-ops for non-existent session', () => {
      expect(() => updateSpec('fake', makeSpec())).not.toThrow();
    });
  });

  describe('buildStatus', () => {
    it('round-trips build status', () => {
      const id = createSession('test', makeSpec());
      const status: BuildStatus = {
        buildName: 'test-build',
        phase: 'running',
        logLines: ['line1'],
      };
      updateBuildStatus(id, status);
      expect(getBuildStatus(id)).toEqual(status);
    });

    it('returns undefined when no build status set', () => {
      const id = createSession('test', makeSpec());
      expect(getBuildStatus(id)).toBeUndefined();
    });

    it('no-ops for non-existent session', () => {
      expect(() =>
        updateBuildStatus('fake', {
          buildName: 'x',
          phase: 'pending',
          logLines: [],
        }),
      ).not.toThrow();
    });
  });

  describe('secretValues', () => {
    it('round-trips secret values', () => {
      const id = createSession('test', makeSpec());
      setSecretValues(id, { API_KEY: 'secret123' });
      expect(getSecretValues(id)).toEqual({ API_KEY: 'secret123' });
    });

    it('clearSecretValues removes the data', () => {
      const id = createSession('test', makeSpec());
      setSecretValues(id, { KEY: 'val' });
      clearSecretValues(id);
      expect(getSecretValues(id)).toBeUndefined();
    });

    it('returns undefined for session with no secrets set', () => {
      const id = createSession('test', makeSpec());
      expect(getSecretValues(id)).toBeUndefined();
    });
  });

  describe('deploymentInfo', () => {
    const makeDeployInfo = (
      sessionId: string,
      name: string,
    ): DeploymentInfo => ({
      sessionId,
      deploymentName: name,
      namespace: 'test-ns',
      phase: 'running',
      imageRef: 'img:latest',
      podName: 'pod-1',
    });

    it('round-trips deployment info', () => {
      const id = createSession('test', makeSpec());
      const info = makeDeployInfo(id, 'deploy-1');
      updateDeploymentInfo(id, info);
      expect(getDeploymentInfo(id)).toEqual(info);
    });

    it('getAllDeployments returns empty array when none set', () => {
      createSession('empty', makeSpec());
      const all = getAllDeployments();
      const withoutPrior = all.filter(
        (d) => d.deploymentName === 'should-not-exist',
      );
      expect(withoutPrior).toHaveLength(0);
    });

    it('getAllDeployments includes sessions with deployment info', () => {
      const id = createSession('deployed', makeSpec());
      const info = makeDeployInfo(id, 'unique-deploy-name');
      updateDeploymentInfo(id, info);
      const all = getAllDeployments();
      expect(all.some((d) => d.deploymentName === 'unique-deploy-name')).toBe(
        true,
      );
    });
  });

  describe('welcomeMessage', () => {
    it('round-trips welcome message', () => {
      const id = createSession('test', makeSpec());
      setWelcomeMessage(id, 'Hello!');
      expect(getWelcomeMessage(id)).toBe('Hello!');
    });

    it('returns undefined when no message set', () => {
      const id = createSession('test', makeSpec());
      expect(getWelcomeMessage(id)).toBeUndefined();
    });
  });
});
