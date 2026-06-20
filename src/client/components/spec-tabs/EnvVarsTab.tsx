import {
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
} from '@patternfly/react-table';
import { Label, TextInput } from '@patternfly/react-core';
import type { EnvVarSpec, SecretSpec } from '@shared/types';

interface EnvVarsTabProps {
  envVars: EnvVarSpec[];
  secrets: SecretSpec[];
  sessionId: string | null;
  secretValues: Record<string, string>;
  onSecretChange: (name: string, value: string) => void;
}

export function EnvVarsTab({ envVars, secrets, secretValues, onSecretChange }: EnvVarsTabProps) {
  if (envVars.length === 0 && secrets.length === 0) {
    return <p>No environment variables configured yet.</p>;
  }

  return (
    <Table aria-label="Environment variables" variant="compact">
      <Thead>
        <Tr>
          <Th>Name</Th>
          <Th>Value</Th>
          <Th>Source</Th>
        </Tr>
      </Thead>
      <Tbody>
        {envVars.map((env) => (
          <Tr key={env.name}>
            <Td dataLabel="Name">{env.name}</Td>
            <Td dataLabel="Value">{env.value}</Td>
            <Td dataLabel="Source">
              <Label isCompact color="blue">
                literal
              </Label>
            </Td>
          </Tr>
        ))}
        {secrets.map((secret) => (
          <Tr key={secret.name}>
            <Td dataLabel="Name">
              {secret.name}
              <br />
              <small style={{ color: 'var(--pf-t--global--color--subtle)' }}>
                {secret.description}
              </small>
            </Td>
            <Td dataLabel="Value">
              <TextInput
                type="password"
                aria-label={`Value for ${secret.name}`}
                placeholder="Enter secret value"
                value={secretValues[secret.name] || ''}
                onChange={(_e, val) => onSecretChange(secret.name, val)}
              />
            </Td>
            <Td dataLabel="Source">
              <Label isCompact color="orange">
                secret
              </Label>
            </Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
}
