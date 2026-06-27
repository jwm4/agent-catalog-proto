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
import type { ContainerSpec, FileSpec, HarnessConfigSchema } from '@shared/types';
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
  baselineContainerfile?: string | null;
  baselineFiles?: FileSpec[] | null;
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

function findChangedLines(
  baseline: string,
  current: string,
): Set<number> {
  const oldLines = baseline.split('\n');
  const newLines = current.split('\n');
  const counts = new Map<string, number>();
  for (const line of oldLines) {
    counts.set(line, (counts.get(line) || 0) + 1);
  }
  const changed = new Set<number>();
  for (let i = 0; i < newLines.length; i++) {
    const line = newLines[i];
    if (!line.trim()) continue;
    const remaining = counts.get(line);
    if (remaining && remaining > 0) {
      counts.set(line, remaining - 1);
    } else {
      changed.add(i);
    }
  }
  return changed;
}

export function SpecViewerPane({
  sessionId,
  spec,
  secretValues,
  onSecretChange,
  configSchema,
  baselineContainerfile,
  baselineFiles,
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
  const changedLines =
    baselineContainerfile != null
      ? findChangedLines(baselineContainerfile, containerfile)
      : null;
  const containerfileLines = containerfile.split('\n');

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
              <CodeBlockCode>
                {changedLines && changedLines.size > 0
                  ? containerfileLines.map((line, i) => (
                      <div
                        key={i}
                        style={
                          changedLines.has(i)
                            ? {
                                backgroundColor: 'rgba(62, 134, 53, 0.15)',
                                borderLeft: '3px solid var(--pf-t--global--color--status--success--default, #3e8635)',
                                paddingLeft: '8px',
                                marginLeft: '-11px',
                              }
                            : undefined
                        }
                      >
                        {line || ' '}
                      </div>
                    ))
                  : containerfile}
              </CodeBlockCode>
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
            <FilesTab files={spec.files} baselineFiles={baselineFiles} />
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
