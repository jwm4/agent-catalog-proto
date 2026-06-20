import {
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
} from '@patternfly/react-table';
import { Label } from '@patternfly/react-core';
import type { FileSpec } from '@shared/types';

interface FilesTabProps {
  files: FileSpec[];
}

export function FilesTab({ files }: FilesTabProps) {
  if (files.length === 0) {
    return <p>No files configured yet.</p>;
  }

  return (
    <Table aria-label="Files to inject" variant="compact">
      <Thead>
        <Tr>
          <Th>Source</Th>
          <Th>Destination</Th>
          <Th>Type</Th>
          <Th>Mount</Th>
        </Tr>
      </Thead>
      <Tbody>
        {files.map((file, i) => (
          <Tr key={`${file.destPath}-${i}`}>
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
        ))}
      </Tbody>
    </Table>
  );
}
