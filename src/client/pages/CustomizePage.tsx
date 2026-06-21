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
import type { ContainerSpec } from '@shared/types';
import { getHarnessById } from '@client/data/harnesses';
import { ChatPane } from '@client/components/ChatPane';
import { SpecViewerPane } from '@client/components/SpecViewerPane';
import { BuildDeployPanel } from '@client/components/BuildDeployPanel';

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
  const [namespace, setNamespace] = useState('');
  const wsRef = useRef<WebSocket | null>(null);

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

    let cancelled = false;

    async function startSession() {
      try {
        const res = await fetch('/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ harnessId: id }),
        });
        if (!res.ok) throw new Error(`Failed to create session: ${res.status}`);
        const data = (await res.json()) as { sessionId: string };
        if (cancelled) return;
        setSessionId(data.sessionId);

        const specRes = await fetch(`/api/session/${data.sessionId}/spec`);
        if (specRes.ok) {
          const specData = (await specRes.json()) as ContainerSpec;
          if (!cancelled) setSpec(specData);
        }
      } catch (err) {
        console.error('Failed to start session:', err);
      }
    }

    startSession();

    return () => {
      cancelled = true;
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
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: 0 }}>
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
          <CardBody style={{ padding: 0, position: 'relative', flex: 1, minHeight: 0 }}>
            <div style={{ position: 'absolute', inset: 0 }}>
              <ChatPane sessionId={sessionId} harnessName={harness.name} />
            </div>
          </CardBody>
        </Card>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
          {showBuildPanel && sessionId && (
            <BuildDeployPanel
              sessionId={sessionId}
              secretValues={secretValues}
              namespace={namespace}
              onClose={() => setShowBuildPanel(false)}
            />
          )}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', flexShrink: 0 }}>
            <FormGroup label="Namespace" fieldId="namespace" style={{ flex: 1 }}>
              <TextInput
                id="namespace"
                value={namespace}
                onChange={(_e, val) => setNamespace(val)}
                placeholder="openshift namespace"
              />
            </FormGroup>
            <Button
              variant="primary"
              isDisabled={!sessionId || !spec || showBuildPanel || !namespace}
              onClick={() => setShowBuildPanel(true)}
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
