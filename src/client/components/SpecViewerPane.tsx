import { useState } from 'react';
import {
  Tab,
  Tabs,
  TabTitleText,
  CodeBlock,
  CodeBlockCode,
  EmptyState,
  EmptyStateBody,
  PageSection,
} from '@patternfly/react-core';
import type { ContainerSpec } from '@shared/types';
import { EnvVarsTab } from './spec-tabs/EnvVarsTab';
import { FilesTab } from './spec-tabs/FilesTab';
import { VolumesTab } from './spec-tabs/VolumesTab';
import { generateContainerfile } from '../utils/containerfile';

interface SpecViewerPaneProps {
  sessionId: string | null;
  spec: ContainerSpec | null;
  secretValues: Record<string, string>;
  onSecretChange: (name: string, value: string) => void;
}

export function SpecViewerPane({ sessionId, spec, secretValues, onSecretChange }: SpecViewerPaneProps) {
  const [activeTab, setActiveTab] = useState<string | number>('containerfile');

  if (!spec) {
    return (
      <PageSection hasBodyWrapper={false}>
        <EmptyState titleText="No specification" headingLevel="h3">
          <EmptyStateBody>
            {sessionId
              ? 'Loading container specification...'
              : 'Start a session to see the container specification.'}
          </EmptyStateBody>
        </EmptyState>
      </PageSection>
    );
  }

  const containerfile = generateContainerfile(spec);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Tabs
        activeKey={activeTab}
        onSelect={(_e, key) => setActiveTab(key)}
        style={{ flexShrink: 0 }}
      >
        <Tab
          eventKey="containerfile"
          title={<TabTitleText>Containerfile</TabTitleText>}
        >
          <div style={{ padding: '16px', overflow: 'auto', flex: 1 }}>
            <CodeBlock>
              <CodeBlockCode>{containerfile}</CodeBlockCode>
            </CodeBlock>
          </div>
        </Tab>
        <Tab eventKey="envvars" title={<TabTitleText>Env Vars</TabTitleText>}>
          <div style={{ padding: '16px', overflow: 'auto', flex: 1 }}>
            <EnvVarsTab
              envVars={spec.envVars}
              secrets={spec.secrets}
              sessionId={sessionId}
              secretValues={secretValues}
              onSecretChange={onSecretChange}
            />
          </div>
        </Tab>
        <Tab eventKey="files" title={<TabTitleText>Files</TabTitleText>}>
          <div style={{ padding: '16px', overflow: 'auto', flex: 1 }}>
            <FilesTab files={spec.files} />
          </div>
        </Tab>
        <Tab eventKey="volumes" title={<TabTitleText>Volumes</TabTitleText>}>
          <div style={{ padding: '16px', overflow: 'auto', flex: 1 }}>
            <VolumesTab volumes={spec.volumes} />
          </div>
        </Tab>
      </Tabs>
    </div>
  );
}
