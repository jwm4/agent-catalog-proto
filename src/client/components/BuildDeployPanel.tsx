import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Card,
  CardBody,
  CardTitle,
  Button,
  ClipboardCopy,
  ProgressStepper,
  ProgressStep,
  Alert,
  Spinner,
} from '@patternfly/react-core';
import type { BuildPhase, DeployPhase, DeploymentInfo } from '@shared/types';

interface BuildDeployPanelProps {
  sessionId: string;
  secretValues: Record<string, string>;
  namespace: string;
  onClose: () => void;
}

type Stage = 'building' | 'deploying' | 'done' | 'error';

function buildStepVariant(
  buildPhase: BuildPhase,
  _stage: Stage,
): 'pending' | 'info' | 'success' | 'danger' {
  if (buildPhase === 'failed') return 'danger';
  if (buildPhase === 'complete') return 'success';
  if (buildPhase === 'running') return 'info';
  return 'pending';
}

function deployStepVariant(
  deployPhase: DeployPhase,
  _stage: Stage,
): 'pending' | 'info' | 'success' | 'danger' {
  if (deployPhase === 'failed') return 'danger';
  if (deployPhase === 'running') return 'success';
  if (deployPhase === 'waiting' || deployPhase === 'applying') return 'info';
  return 'pending';
}

export function BuildDeployPanel({
  sessionId,
  secretValues,
  namespace,
  onClose,
}: BuildDeployPanelProps) {
  const [stage, setStage] = useState<Stage>('building');
  const [buildPhase, setBuildPhase] = useState<BuildPhase>('pending');
  const [deployPhase, setDeployPhase] = useState<DeployPhase>('pending');
  const [logLines, setLogLines] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deploymentInfo, setDeploymentInfo] = useState<DeploymentInfo | null>(
    null,
  );
  const logEndRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [logLines, scrollToBottom]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let aborted = false;

    async function runBuildAndDeploy() {
      try {
        const buildRes = await fetch('/api/build', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, secretValues, namespace }),
        });

        if (!buildRes.ok) {
          const err = await buildRes.json();
          throw new Error((err as { error: string }).error || 'Build request failed');
        }

        const reader = buildRes.body?.getReader();
        if (!reader) throw new Error('No response body');
        const decoder = new TextDecoder();
        let buffer = '';
        let imageRef: string | undefined;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (aborted) return;

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
                setLogLines((prev) => [...prev, event.line!]);
              } else if (event.type === 'status') {
                if (event.phase) setBuildPhase(event.phase);
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

        if (aborted) return;
        if (!imageRef) throw new Error('Build completed but no image reference returned');

        setStage('deploying');
        setLogLines((prev) => [...prev, '', '--- Deploying ---', '']);

        const deployRes = await fetch('/api/deploy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, namespace }),
        });

        if (!deployRes.ok) {
          const err = await deployRes.json();
          throw new Error((err as { error: string }).error || 'Deploy failed');
        }

        const deployData = (await deployRes.json()) as {
          deploymentInfo: DeploymentInfo;
        };

        if (aborted) return;
        setDeploymentInfo(deployData.deploymentInfo);
        setDeployPhase(deployData.deploymentInfo.phase);
        setStage('done');
        setLogLines((prev) => [
          ...prev,
          `Pod ${deployData.deploymentInfo.podName || 'unknown'} is running`,
        ]);
      } catch (err) {
        if (aborted) return;
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        setStage('error');
        setLogLines((prev) => [...prev, `ERROR: ${message}`]);
      }
    }

    runBuildAndDeploy();

    return () => {
      aborted = true;
    };
  }, [sessionId, secretValues, namespace]);

  return (
    <Card>
      <CardTitle>Build & Deploy</CardTitle>
      <CardBody>
        <ProgressStepper style={{ marginBottom: '1rem' }}>
          <ProgressStep
            variant={buildStepVariant(buildPhase, stage)}
            isCurrent={stage === 'building'}
            description={
              buildPhase === 'running' ? 'Building container image...' : undefined
            }
          >
            Build
          </ProgressStep>
          <ProgressStep
            variant={deployStepVariant(deployPhase, stage)}
            isCurrent={stage === 'deploying'}
            description={
              deployPhase === 'waiting'
                ? 'Waiting for pod...'
                : deployPhase === 'applying'
                  ? 'Applying manifests...'
                  : undefined
            }
          >
            Deploy
          </ProgressStep>
          <ProgressStep
            variant={stage === 'done' ? 'success' : 'pending'}
            isCurrent={stage === 'done'}
          >
            Ready
          </ProgressStep>
        </ProgressStepper>

        <div
          style={{
            background: 'var(--pf-t--global--background--color--secondary--default)',
            padding: '12px',
            borderRadius: '6px',
            maxHeight: '200px',
            overflow: 'auto',
            fontFamily: 'var(--pf-t--global--font--family--mono)',
            fontSize: '0.8rem',
            lineHeight: '1.4',
            marginBottom: '1rem',
          }}
        >
          {logLines.length === 0 && (
            <span style={{ color: 'var(--pf-t--global--color--subtle)' }}>
              <Spinner size="sm" /> Starting build...
            </span>
          )}
          {logLines.map((line, i) => (
            <div key={i}>{line || ' '}</div>
          ))}
          <div ref={logEndRef} />
        </div>

        {error && (
          <Alert variant="danger" isInline title="Error" style={{ marginBottom: '1rem' }}>
            {error}
          </Alert>
        )}

        {stage === 'done' && deploymentInfo && (
          <div>
            <Alert variant="success" isInline title="Deployment ready" style={{ marginBottom: '1rem' }}>
              Pod <strong>{deploymentInfo.podName}</strong> is running in namespace{' '}
              <strong>{deploymentInfo.namespace}</strong>.
            </Alert>

            {deploymentInfo.connectCommand && (
              <div style={{ marginBottom: '0.5rem' }}>
                <strong>Connect:</strong>
                <ClipboardCopy isReadOnly style={{ marginTop: '4px' }}>
                  {deploymentInfo.connectCommand}
                </ClipboardCopy>
              </div>
            )}

            {deploymentInfo.portForwardCommand && (
              <div style={{ marginBottom: '0.5rem' }}>
                <strong>Port forward:</strong>
                <ClipboardCopy isReadOnly style={{ marginTop: '4px' }}>
                  {deploymentInfo.portForwardCommand}
                </ClipboardCopy>
              </div>
            )}

            {deploymentInfo.routeUrl && (
              <div style={{ marginBottom: '0.5rem' }}>
                <strong>Route:</strong>
                <ClipboardCopy isReadOnly style={{ marginTop: '4px' }}>
                  {deploymentInfo.routeUrl}
                </ClipboardCopy>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', marginTop: '1rem' }}>
          <Button variant="secondary" onClick={onClose}>
            {stage === 'done' || stage === 'error' ? 'Close' : 'Cancel'}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
