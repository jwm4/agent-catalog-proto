import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Breadcrumb,
  BreadcrumbItem,
  Button,
  Card,
  CardBody,
  Content,
  PageSection,
} from '@patternfly/react-core';
import type { ContainerSpec } from '@shared/types';
import { getHarnessById } from '@client/data/harnesses';
import { ChatPane } from '@client/components/ChatPane';
import { SpecViewerPane } from '@client/components/SpecViewerPane';
import { BuildDeployPanel } from '@client/components/BuildDeployPanel';

export function CustomizePage() {
  const { id } = useParams<{ id: string }>();
  const harness = id ? getHarnessById(id) : undefined;

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [spec, setSpec] = useState<ContainerSpec | null>(null);
  const [secretValues, setSecretValues] = useState<Record<string, string>>({});
  const [showBuildPanel, setShowBuildPanel] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
        <Card style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <CardBody style={{ padding: 0, height: '100%' }}>
            <ChatPane sessionId={sessionId} harnessName={harness.name} />
          </CardBody>
        </Card>
        <Card style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
          <CardBody style={{ padding: 0, height: '100%' }}>
            <SpecViewerPane
              sessionId={sessionId}
              spec={spec}
              secretValues={secretValues}
              onSecretChange={handleSecretChange}
            />
          </CardBody>
        </Card>
      </div>

      {showBuildPanel && sessionId && (
        <div style={{ padding: '0 16px', marginTop: '16px' }}>
          <BuildDeployPanel
            sessionId={sessionId}
            secretValues={secretValues}
            onClose={() => setShowBuildPanel(false)}
          />
        </div>
      )}

      <PageSection
        hasBodyWrapper={false}
        style={{
          flexShrink: 0,
          borderTop:
            '1px solid var(--pf-t--global--border--color--default)',
        }}
      >
        <Button
          variant="primary"
          isDisabled={!sessionId || !spec || showBuildPanel}
          onClick={() => setShowBuildPanel(true)}
        >
          Build & Deploy
        </Button>
      </PageSection>
    </div>
  );
}
