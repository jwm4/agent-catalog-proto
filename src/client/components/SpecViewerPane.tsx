import { useState, useEffect, useRef } from 'react';
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
import type { ContainerSpec, HarnessConfigSchema } from '@shared/types';
import { ConfigurationTab } from './spec-tabs/ConfigurationTab';
import { FilesTab } from './spec-tabs/FilesTab';
import { VolumesTab } from './spec-tabs/VolumesTab';
import { generateContainerfile } from '../utils/containerfile';

interface SpecViewerPaneProps {
  sessionId: string | null;
  spec: ContainerSpec | null;
  secretValues: Record<string, string>;
  onSecretChange: (name: string, value: string) => void;
  configSchema?: HarnessConfigSchema;
}

function detectChangedTab(
  prev: ContainerSpec,
  next: ContainerSpec,
): string | null {
  if (JSON.stringify(prev.secrets) !== JSON.stringify(next.secrets)) {
    return 'configuration';
  }
  if (JSON.stringify(prev.files) !== JSON.stringify(next.files)) {
    return 'files';
  }
  if (JSON.stringify(prev.volumes) !== JSON.stringify(next.volumes)) {
    return 'volumes';
  }
  if (
    prev.baseImage !== next.baseImage ||
    JSON.stringify(prev.runCommands) !== JSON.stringify(next.runCommands) ||
    JSON.stringify(prev.setupCommands) !== JSON.stringify(next.setupCommands) ||
    JSON.stringify(prev.buildArgs) !== JSON.stringify(next.buildArgs) ||
    JSON.stringify(prev.entrypoint) !== JSON.stringify(next.entrypoint) ||
    JSON.stringify(prev.labels) !== JSON.stringify(next.labels) ||
    JSON.stringify(prev.exposedPorts) !== JSON.stringify(next.exposedPorts)
  ) {
    return 'containerfile';
  }
  return null;
}

export function SpecViewerPane({
  sessionId,
  spec,
  secretValues,
  onSecretChange,
  configSchema,
}: SpecViewerPaneProps) {
  const [activeTab, setActiveTab] = useState<string | number>('containerfile');
  const prevSpecRef = useRef<ContainerSpec | null>(null);

  useEffect(() => {
    if (!spec || !prevSpecRef.current) {
      prevSpecRef.current = spec;
      return;
    }
    const changed = detectChangedTab(prevSpecRef.current, spec);
    if (changed) {
      setActiveTab(changed);
    }
    prevSpecRef.current = spec;
  }, [spec]);

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
        <Tab
          eventKey="configuration"
          title={<TabTitleText>Configuration</TabTitleText>}
        >
          <div style={{ padding: '16px', overflow: 'auto', flex: 1 }}>
            <ConfigurationTab
              configSchema={configSchema}
              secrets={spec.secrets}
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
