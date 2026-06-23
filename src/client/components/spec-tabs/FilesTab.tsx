import { useState } from 'react';
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

interface FilesTabProps {
  files: FileSpec[];
}

export function FilesTab({ files }: FilesTabProps) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  if (files.length === 0) {
    return <p>No files configured yet.</p>;
  }

  const onToggle = (index: number) => {
    setExpanded((prev) => ({ ...prev, [index]: !prev[index] }));
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
        <Tbody key={`${file.destPath}-${i}`} isExpanded={!!expanded[i]}>
          <Tr>
            <Td
              expand={
                file.content
                  ? {
                      rowIndex: i,
                      isExpanded: !!expanded[i],
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
            <Tr isExpanded={!!expanded[i]}>
              <Td colSpan={columnCount}>
                <ExpandableRowContent>
                  <CodeBlock>
                    <CodeBlockCode>{file.content}</CodeBlockCode>
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
