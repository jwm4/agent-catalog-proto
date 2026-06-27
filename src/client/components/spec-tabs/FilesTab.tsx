import { useState, useMemo } from 'react';
import {
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  ExpandableRowContent,
} from '@patternfly/react-table';
import {
  Label,
  CodeBlock,
  CodeBlockCode,
} from '@patternfly/react-core';
import type { FileSpec } from '@shared/types';

function findChangedContentLines(
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

interface FilesTabProps {
  files: FileSpec[];
  baselineFiles?: FileSpec[] | null;
}

export function FilesTab({ files, baselineFiles }: FilesTabProps) {
  const [manualExpanded, setManualExpanded] = useState<Record<number, boolean>>(
    {},
  );

  const changedFileIndices = useMemo(() => {
    if (!baselineFiles) return new Set<number>();
    const baselineByPath = new Map(
      baselineFiles.map((f) => [f.destPath, f]),
    );
    const changed = new Set<number>();
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.content) continue;
      const baseline = baselineByPath.get(file.destPath);
      if (!baseline || baseline.content !== file.content) {
        changed.add(i);
      }
    }
    return changed;
  }, [files, baselineFiles]);

  if (files.length === 0) {
    return <p>No files configured yet.</p>;
  }

  const isExpanded = (index: number) =>
    manualExpanded[index] ?? changedFileIndices.has(index);

  const onToggle = (index: number) => {
    setManualExpanded((prev) => ({ ...prev, [index]: !isExpanded(index) }));
  };

  const columnCount = 5;

  return (
    <Table aria-label="Files to inject" variant="compact">
      <Thead>
        <Tr>
          <Th screenReaderText="Expand" />
          <Th>Source</Th>
          <Th>Destination</Th>
          <Th>Type</Th>
          <Th>Mount</Th>
        </Tr>
      </Thead>
      {files.map((file, i) => (
        <Tbody key={`${file.destPath}-${i}`} isExpanded={isExpanded(i)}>
          <Tr>
            <Td
              expand={
                file.content
                  ? {
                      rowIndex: i,
                      isExpanded: isExpanded(i),
                      onToggle: () => onToggle(i),
                    }
                  : undefined
              }
            />
            <Td dataLabel="Source">{file.sourcePath}</Td>
            <Td dataLabel="Destination">{file.destPath}</Td>
            <Td dataLabel="Type">
              <Label isCompact>{file.sourceType}</Label>
            </Td>
            <Td dataLabel="Mount">
              <Label isCompact color={file.mountType === 'copy' ? 'blue' : 'green'}>
                {file.mountType}
              </Label>
            </Td>
          </Tr>
          {file.content && (
            <Tr isExpanded={isExpanded(i)}>
              <Td colSpan={columnCount}>
                <ExpandableRowContent>
                  <CodeBlock>
                    <CodeBlockCode>
                      {(() => {
                        const baselineFile = baselineFiles
                          ? baselineFiles.find(
                              (f) => f.destPath === file.destPath,
                            )
                          : null;
                        const changedLines =
                          baselineFile && baselineFile.content != null
                            ? findChangedContentLines(
                                baselineFile.content,
                                file.content!,
                              )
                            : null;
                        if (changedLines && changedLines.size > 0) {
                          return file.content!.split('\n').map((line, j) => (
                            <div
                              key={j}
                              style={
                                changedLines.has(j)
                                  ? {
                                      backgroundColor:
                                        'rgba(62, 134, 53, 0.15)',
                                      borderLeft:
                                        '3px solid var(--pf-t--global--color--status--success--default, #3e8635)',
                                      paddingLeft: '8px',
                                      marginLeft: '-11px',
                                    }
                                  : undefined
                              }
                            >
                              {line || ' '}
                            </div>
                          ));
                        }
                        return file.content;
                      })()}
                    </CodeBlockCode>
                  </CodeBlock>
                </ExpandableRowContent>
              </Td>
            </Tr>
          )}
        </Tbody>
      ))}
    </Table>
  );
}
