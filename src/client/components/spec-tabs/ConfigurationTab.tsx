import { useState, useEffect, useRef, useMemo } from 'react';
import {
  ExpandableSection,
  Form,
  FormGroup,
  TextInput,
  Content,
  ContentVariants,
} from '@patternfly/react-core';
import type {
  SecretSpec,
  HarnessConfigSchema,
  HarnessConfigSection,
  HarnessConfigOption,
} from '@shared/types';

interface ConfigurationTabProps {
  configSchema?: HarnessConfigSchema;
  secrets: SecretSpec[];
  secretValues: Record<string, string>;
  onSecretChange: (name: string, value: string) => void;
}

const OTHER_VARS_ID = '__other__';

function SecretField({
  name,
  description,
  value,
  onChange,
}: {
  name: string;
  description?: string;
  value: string;
  onChange: (name: string, value: string) => void;
}) {
  return (
    <FormGroup label={name} fieldId={`secret-${name}`}>
      <TextInput
        id={`secret-${name}`}
        type="password"
        placeholder="Enter secret value"
        value={value}
        onChange={(_e, val) => onChange(name, val)}
      />
      {description && (
        <Content component={ContentVariants.small}>{description}</Content>
      )}
    </FormGroup>
  );
}

function OptionSecrets({
  option,
  secrets,
  secretValues,
  onSecretChange,
}: {
  option: HarnessConfigOption;
  secrets: SecretSpec[];
  secretValues: Record<string, string>;
  onSecretChange: (name: string, value: string) => void;
}) {
  if (!option.secrets?.length) return null;
  return (
    <>
      {option.secrets.map((s) => {
        const inSpec = secrets.find((sec) => sec.name === s.name);
        if (!inSpec) return null;
        return (
          <SecretField
            key={s.name}
            name={s.name}
            description={s.description}
            value={secretValues[s.name] || ''}
            onChange={onSecretChange}
          />
        );
      })}
    </>
  );
}

function ProviderSectionContent({
  section,
  secrets,
  secretValues,
  onSecretChange,
}: {
  section: HarnessConfigSection;
  secrets: SecretSpec[];
  secretValues: Record<string, string>;
  onSecretChange: (name: string, value: string) => void;
}) {
  if (!section.options?.length) return null;

  const activeOption = section.options.find((opt) =>
    opt.secrets?.some((s) => secrets.some((sec) => sec.name === s.name)),
  ) || section.options.find((opt) => opt.default);

  return (
    <Form>
      {section.description && (
        <Content component={ContentVariants.small}>
          {section.description}
        </Content>
      )}
      {activeOption && (
        <>
          <FormGroup label="Selected provider" fieldId="active-provider">
            <TextInput
              id="active-provider"
              value={activeOption.label}
              isDisabled
            />
          </FormGroup>
          <OptionSecrets
            option={activeOption}
            secrets={secrets}
            secretValues={secretValues}
            onSecretChange={onSecretChange}
          />
        </>
      )}
    </Form>
  );
}

function FieldsSectionContent({
  section,
  secrets,
  secretValues,
  onSecretChange,
}: {
  section: HarnessConfigSection;
  secrets: SecretSpec[];
  secretValues: Record<string, string>;
  onSecretChange: (name: string, value: string) => void;
}) {
  const secretFields = section.fields?.filter((f) => f.type === 'secret') || [];
  if (secretFields.length === 0) return null;

  return (
    <Form>
      {section.description && (
        <Content component={ContentVariants.small}>
          {section.description}
        </Content>
      )}
      {secretFields.map((f) => {
        const secret = secrets.find((s) => s.name === f.name);
        if (!secret) return null;
        return (
          <SecretField
            key={f.name}
            name={f.name}
            description={f.description}
            value={secretValues[f.name] || ''}
            onChange={onSecretChange}
          />
        );
      })}
    </Form>
  );
}

function buildSectionNameMap(
  schema: HarnessConfigSchema,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const section of schema.sections) {
    if (section.options) {
      for (const opt of section.options) {
        if (opt.secrets) {
          for (const s of opt.secrets) map.set(s.name, section.id);
        }
        if (opt.fields) {
          for (const f of opt.fields) map.set(f.name, section.id);
        }
      }
    }
    if (section.fields) {
      for (const f of section.fields) map.set(f.name, section.id);
    }
  }
  return map;
}

function collectSchemaNames(schema: HarnessConfigSchema): Set<string> {
  const names = new Set<string>();
  for (const section of schema.sections) {
    if (section.options) {
      for (const opt of section.options) {
        if (opt.secrets) {
          for (const s of opt.secrets) names.add(s.name);
        }
        if (opt.fields) {
          for (const f of opt.fields) names.add(f.name);
        }
      }
    }
    if (section.fields) {
      for (const f of section.fields) names.add(f.name);
    }
  }
  return names;
}

function detectChangedSection(
  prevSecrets: SecretSpec[],
  nextSecrets: SecretSpec[],
  nameToSection: Map<string, string>,
): string | null {
  for (const sec of nextSecrets) {
    const prev = prevSecrets.find((s) => s.name === sec.name);
    if (!prev) {
      return nameToSection.get(sec.name) ?? OTHER_VARS_ID;
    }
  }
  return null;
}

export function ConfigurationTab({
  configSchema,
  secrets,
  secretValues,
  onSecretChange,
}: ConfigurationTabProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const prevSecretsRef = useRef(secrets);

  const nameToSection = useMemo(
    () =>
      configSchema
        ? buildSectionNameMap(configSchema)
        : new Map<string, string>(),
    [configSchema],
  );

  useEffect(() => {
    const changed = detectChangedSection(
      prevSecretsRef.current,
      secrets,
      nameToSection,
    );
    if (changed) {
      setExpandedId(changed);
    }
    prevSecretsRef.current = secrets;
  }, [secrets, nameToSection]);

  if (!configSchema) {
    if (secrets.length === 0) {
      return <p>No secrets configured yet.</p>;
    }

    return (
      <Form>
        {secrets.map((secret) => (
          <SecretField
            key={secret.name}
            name={secret.name}
            description={secret.description}
            value={secretValues[secret.name] || ''}
            onChange={onSecretChange}
          />
        ))}
      </Form>
    );
  }

  const schemaNames = collectSchemaNames(configSchema);
  const extraSecrets = secrets.filter((s) => !schemaNames.has(s.name));

  return (
    <div>
      {configSchema.sections.map((section) => {
        const isExpanded = expandedId === section.id;
        const content = section.options ? (
          <ProviderSectionContent
            section={section}
            secrets={secrets}
            secretValues={secretValues}
            onSecretChange={onSecretChange}
          />
        ) : (
          <FieldsSectionContent
            section={section}
            secrets={secrets}
            secretValues={secretValues}
            onSecretChange={onSecretChange}
          />
        );
        return (
          <ExpandableSection
            key={section.id}
            toggleText={section.title}
            isExpanded={isExpanded}
            onToggle={(_e, expanded) =>
              setExpandedId(expanded ? section.id : null)
            }
            isIndented
          >
            {content}
          </ExpandableSection>
        );
      })}
      {extraSecrets.length > 0 && (
        <ExpandableSection
          toggleText="Other Secrets"
          isExpanded={expandedId === OTHER_VARS_ID}
          onToggle={(_e, expanded) =>
            setExpandedId(expanded ? OTHER_VARS_ID : null)
          }
          isIndented
        >
          <Form>
            {extraSecrets.map((secret) => (
              <SecretField
                key={secret.name}
                name={secret.name}
                description={secret.description}
                value={secretValues[secret.name] || ''}
                onChange={onSecretChange}
              />
            ))}
          </Form>
        </ExpandableSection>
      )}
    </div>
  );
}
