import { useEffect, useRef, useCallback } from 'react';
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

export type BuildStage = 'building' | 'deploying' | 'done' | 'error';

export interface BuildState {
  stage: BuildStage;
  buildPhase: BuildPhase;
  deployPhase: DeployPhase;
  logLines: string[];
  error: string | null;
  deploymentInfo: DeploymentInfo | null;
}

export const initialBuildState: BuildState = {
  stage: 'building',
  buildPhase: 'pending',
  deployPhase: 'pending',
  logLines: [],
  error: null,
  deploymentInfo: null,
};

export interface BuildDeployPanelProps {
  buildState: BuildState;
  onClose: () => void;
}

function buildStepVariant(
  buildPhase: BuildPhase,
): 'pending' | 'info' | 'success' | 'danger' {
  if (buildPhase === 'failed') return 'danger';
  if (buildPhase === 'complete') return 'success';
  if (buildPhase === 'running') return 'info';
  return 'pending';
}

function deployStepVariant(
  deployPhase: DeployPhase,
): 'pending' | 'info' | 'success' | 'danger' {
  if (deployPhase === 'failed') return 'danger';
  if (deployPhase === 'running') return 'success';
  if (deployPhase === 'waiting' || deployPhase === 'applying') return 'info';
  return 'pending';
}

export function BuildDeployPanel({
  buildState,
  onClose,
}: BuildDeployPanelProps) {
  const { stage, buildPhase, deployPhase, logLines, error, deploymentInfo } =
    buildState;
  const logEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [logLines, scrollToBottom]);

  return (
    <Card>
      <CardTitle>Build & Deploy</CardTitle>
      <CardBody>
        <ProgressStepper style={{ marginBottom: '1rem' }}>
          <ProgressStep
            variant={buildStepVariant(buildPhase)}
            isCurrent={stage === 'building'}
            description={
              buildPhase === 'running'
                ? 'Building container image...'
                : undefined
            }
          >
            Build
          </ProgressStep>
          <ProgressStep
            variant={deployStepVariant(deployPhase)}
            isCurrent={stage === 'deploying'}
            description={
              deployPhase === 'waiting'
                ? 'Waiting for pod to start (30-60s)...'
                : deployPhase === 'applying'
                  ? 'Applying manifests and waiting for pod...'
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
            background:
              'var(--pf-t--global--background--color--secondary--default)',
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
            <div key={i}>{line || ' '}</div>
          ))}
          <div ref={logEndRef} />
        </div>

        {error && (
          <Alert
            variant="danger"
            isInline
            title="Error"
            style={{ marginBottom: '1rem' }}
          >
            {error}
          </Alert>
        )}

        {stage === 'done' && deploymentInfo && (
          <div>
            <Alert
              variant="success"
              isInline
              title="Deployment ready"
              style={{ marginBottom: '1rem' }}
            >
              Pod <strong>{deploymentInfo.podName}</strong> is running in
              namespace <strong>{deploymentInfo.namespace}</strong>.
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

            {deploymentInfo.mlflowUrl && (
              <div style={{ marginBottom: '0.5rem' }}>
                <strong>MLflow:</strong>{' '}
                <a
                  href={deploymentInfo.mlflowUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {deploymentInfo.mlflowUrl}
                </a>
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
