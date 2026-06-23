import { Component, useState, useEffect, useRef, useCallback } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Breadcrumb,
  BreadcrumbItem,
  Button,
  Card,
  CardBody,
  Content,
  FormGroup,
  PageSection,
  TextInput,
} from '@patternfly/react-core';
import type { ContainerSpec, BuildPhase, DeploymentInfo } from '@shared/types';
import { getHarnessById } from '@shared/harnesses';
import { ChatPane } from '@client/components/ChatPane';
import { SpecViewerPane } from '@client/components/SpecViewerPane';
import {
  BuildDeployPanel,
  initialBuildState,
} from '@client/components/BuildDeployPanel';
import type { BuildState } from '@client/components/BuildDeployPanel';

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('CustomizePage crash:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <PageSection hasBodyWrapper={false}>
          <Content>
            <h2>Something went wrong</h2>
            <pre style={{ whiteSpace: 'pre-wrap', color: 'red' }}>
              {this.state.error.message}
              {'\n\n'}
              {this.state.error.stack}
            </pre>
          </Content>
        </PageSection>
      );
    }
    return this.children;
  }

  get children() {
    return this.props.children;
  }
}

export function CustomizePage() {
  const { id } = useParams<{ id: string }>();
  const harness = id ? getHarnessById(id) : undefined;

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [spec, setSpec] = useState<ContainerSpec | null>(null);
  const [secretValues, setSecretValues] = useState<Record<string, string>>({});
  const [showBuildPanel, setShowBuildPanel] = useState(false);
  const [buildState, setBuildState] = useState<BuildState>(initialBuildState);
  const [namespace, setNamespace] = useState('');
  const wsRef = useRef<WebSocket | null>(null);
  const buildAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch('/api/namespace/default')
      .then((res) => res.json())
      .then((data: { namespace: string }) => setNamespace(data.namespace))
      .catch(() => setNamespace('default'));
  }, []);

  const handleSecretChange = useCallback((name: string, value: string) => {
    setSecretValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  useEffect(() => {
    if (!id) return;

    const controller = new AbortController();

    async function startSession() {
      try {
        const res = await fetch('/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ harnessId: id }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Failed to create session: ${res.status}`);
        const data = (await res.json()) as { sessionId: string };
        if (controller.signal.aborted) return;
        setSessionId(data.sessionId);

        const specRes = await fetch(`/api/session/${data.sessionId}/spec`, {
          signal: controller.signal,
        });
        if (specRes.ok) {
          const specData = (await specRes.json()) as ContainerSpec;
          if (!controller.signal.aborted) setSpec(specData);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.error('Failed to start session:', err);
      }
    }

    startSession();

    return () => {
      controller.abort();
    };
  }, [id]);

  useEffect(() => {
    if (!sessionId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(
      `${protocol}//${window.location.host}/ws?sessionId=${sessionId}`,
    );

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as {
          type: string;
          spec?: ContainerSpec;
        };
        if (data.type === 'spec-update' && data.spec) {
          setSpec(data.spec);
        }
      } catch {
        console.error('Failed to parse WebSocket message');
      }
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };

    wsRef.current = ws;

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [sessionId]);

  function startBuildAndDeploy() {
    if (!sessionId) return;

    buildAbortRef.current?.abort();
    const controller = new AbortController();
    buildAbortRef.current = controller;
    const { signal } = controller;

    setBuildState(initialBuildState);
    setShowBuildPanel(true);

    (async () => {
      try {
        const buildRes = await fetch('/api/build', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, secretValues, namespace }),
          signal,
        });

        if (!buildRes.ok) {
          const err = await buildRes.json();
          throw new Error(
            (err as { error: string }).error || 'Build request failed',
          );
        }

        const reader = buildRes.body?.getReader();
        if (!reader) throw new Error('No response body');
        const decoder = new TextDecoder();
        let buffer = '';
        let imageRef: string | undefined;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (signal.aborted) return;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const payload = line.slice(6).trim();
            if (payload === '[DONE]') continue;

            try {
              const event = JSON.parse(payload) as {
                type: string;
                line?: string;
                phase?: BuildPhase;
                imageRef?: string;
                error?: string;
              };

              if (event.type === 'log' && event.line) {
                setBuildState((prev) => ({
                  ...prev,
                  logLines: [...prev.logLines, event.line!],
                }));
              } else if (event.type === 'status') {
                if (event.phase) {
                  setBuildState((prev) => ({
                    ...prev,
                    buildPhase: event.phase!,
                  }));
                }
                if (event.imageRef) imageRef = event.imageRef;
                if (event.phase === 'failed') {
                  throw new Error(event.error || 'Build failed');
                }
              }
            } catch (parseErr) {
              if (parseErr instanceof SyntaxError) continue;
              throw parseErr;
            }
          }
        }

        if (signal.aborted) return;
        if (!imageRef)
          throw new Error('Build completed but no image reference returned');

        setBuildState((prev) => ({
          ...prev,
          stage: 'deploying',
          deployPhase: 'applying',
          logLines: [
            ...prev.logLines,
            '',
            '--- Deploying ---',
            '',
            'Applying Kubernetes manifests (Deployment, PVC, Secret, Service)...',
          ],
        }));

        const deployRes = await fetch('/api/deploy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, namespace }),
          signal,
        });

        if (!deployRes.ok) {
          const err = await deployRes.json();
          throw new Error(
            (err as { error: string }).error || 'Deploy failed',
          );
        }

        const deployData = (await deployRes.json()) as {
          deploymentInfo: DeploymentInfo;
        };

        if (signal.aborted) return;
        setBuildState((prev) => ({
          ...prev,
          stage: 'done',
          deployPhase: deployData.deploymentInfo.phase,
          deploymentInfo: deployData.deploymentInfo,
          logLines: [
            ...prev.logLines,
            `Deployment ready in namespace ${namespace}`,
            `Pod ${deployData.deploymentInfo.podName || 'unknown'} is running`,
          ],
        }));
      } catch (err) {
        if (signal.aborted) return;
        const message = err instanceof Error ? err.message : 'Unknown error';
        setBuildState((prev) => ({
          ...prev,
          stage: 'error',
          error: message,
          logLines: [...prev.logLines, `ERROR: ${message}`],
        }));
      }
    })();
  }

  function handleCloseBuild() {
    buildAbortRef.current?.abort();
    setShowBuildPanel(false);
  }

  if (!harness) {
    return (
      <PageSection hasBodyWrapper={false}>
        <Content>
          <p>Harness not found.</p>
          <Link to="/">Back to catalog</Link>
        </Content>
      </PageSection>
    );
  }

  return (
    <ErrorBoundary>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          height: 0,
        }}
      >
        <PageSection hasBodyWrapper={false} style={{ flexShrink: 0 }}>
          <Breadcrumb>
            <BreadcrumbItem>
              <Link to="/">Agent catalog</Link>
            </BreadcrumbItem>
            <BreadcrumbItem>
              <Link to={`/agents/${harness.id}`}>{harness.name}</Link>
            </BreadcrumbItem>
            <BreadcrumbItem isActive>Customize</BreadcrumbItem>
          </Breadcrumb>
          <Content component="h1" style={{ marginTop: '8px' }}>
            Customize {harness.name}
          </Content>
        </PageSection>

        <div
          style={{
            display: 'flex',
            flex: 1,
            minHeight: 0,
            gap: '16px',
            padding: '0 16px',
          }}
        >
          <Card style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
            <CardBody
              style={{
                padding: 0,
                position: 'relative',
                flex: 1,
                minHeight: 0,
              }}
            >
              <div style={{ position: 'absolute', inset: 0 }}>
                <ChatPane sessionId={sessionId} harnessName={harness.name} />
              </div>
            </CardBody>
          </Card>
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <Card style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              <CardBody style={{ padding: 0, height: '100%' }}>
                <SpecViewerPane
                  sessionId={sessionId}
                  spec={spec}
                  secretValues={secretValues}
                  onSecretChange={handleSecretChange}
                  configSchema={harness.configSchema}
                />
              </CardBody>
            </Card>
            {showBuildPanel && (
              <BuildDeployPanel
                buildState={buildState}
                onClose={handleCloseBuild}
              />
            )}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: '12px',
                flexShrink: 0,
              }}
            >
              <FormGroup
                label="Namespace"
                fieldId="namespace"
                style={{ flex: 1 }}
              >
                <TextInput
                  id="namespace"
                  value={namespace}
                  onChange={(_e, val) => setNamespace(val)}
                  placeholder="openshift namespace"
                />
              </FormGroup>
              <Button
                variant="primary"
                isDisabled={
                  !sessionId || !spec || showBuildPanel || !namespace
                }
                onClick={startBuildAndDeploy}
              >
                Build & Deploy
              </Button>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
