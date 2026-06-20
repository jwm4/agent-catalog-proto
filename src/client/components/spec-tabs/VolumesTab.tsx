import {
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
} from '@patternfly/react-table';
import type { VolumeSpec } from '@shared/types';

interface VolumesTabProps {
  volumes: VolumeSpec[];
}

export function VolumesTab({ volumes }: VolumesTabProps) {
  if (volumes.length === 0) {
    return <p>No volumes configured yet.</p>;
  }

  return (
    <Table aria-label="Volume definitions" variant="compact">
      <Thead>
        <Tr>
          <Th>Name</Th>
          <Th>Mount Path</Th>
          <Th>Size</Th>
          <Th>Access Mode</Th>
        </Tr>
      </Thead>
      <Tbody>
        {volumes.map((vol) => (
          <Tr key={vol.name}>
            <Td dataLabel="Name">{vol.name}</Td>
            <Td dataLabel="Mount Path">{vol.mountPath}</Td>
            <Td dataLabel="Size">{vol.size}</Td>
            <Td dataLabel="Access Mode">{vol.accessMode}</Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
}
