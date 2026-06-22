import { buildConnectInfo } from '@server/services/deploy-service.js';
import { makeSpec } from '../helpers';

describe('buildConnectInfo', () => {
  it('returns oc exec command with pod name and namespace', () => {
    const result = buildConnectInfo('my-pod', 'my-ns', makeSpec());
    expect(result.connectCommand).toBe('oc exec -it my-pod -n my-ns -- bash');
  });

  it('includes port-forward command when ports are exposed', () => {
    const spec = makeSpec({ exposedPorts: [3000, 8080] });
    const result = buildConnectInfo('my-pod', 'my-ns', spec);
    expect(result.portForwardCommand).toBe(
      'oc port-forward my-pod 3000:3000 -n my-ns',
    );
  });

  it('uses the first exposed port for port-forward', () => {
    const spec = makeSpec({ exposedPorts: [8080, 3000] });
    const result = buildConnectInfo('my-pod', 'my-ns', spec);
    expect(result.portForwardCommand).toContain('8080:8080');
  });

  it('omits port-forward when no ports are exposed', () => {
    const result = buildConnectInfo('my-pod', 'my-ns', makeSpec());
    expect(result.portForwardCommand).toBeUndefined();
  });

  it('routeUrl is always undefined', () => {
    const spec = makeSpec({ exposedPorts: [3000] });
    const result = buildConnectInfo('my-pod', 'my-ns', spec);
    expect(result.routeUrl).toBeUndefined();
  });
});
