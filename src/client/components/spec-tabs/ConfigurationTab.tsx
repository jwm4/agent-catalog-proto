import { useState, useEffect, useRef, useMemo } from 'react';
import {
  ExpandableSection,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  TextInput,
  Switch,
  Content,
  ContentVariants,
} from '@patternfly/react-core';
import type {
  EnvVarSpec,
  SecretSpec,
  HarnessConfigSchema,
  HarnessConfigSection,
  HarnessConfigField,
  HarnessConfigOption,
} from '@shared/types';

interface ConfigurationTabProps {
  configSchema?: HarnessConfigSchema;
  envVars: EnvVarSpec[];
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

function ConfigField({
  field,
  envVars,
  secrets,
  secretValues,
  onSecretChange,
}: {
  field: HarnessConfigField;
  envVars: EnvVarSpec[];
  secrets: SecretSpec[];
  secretValues: Record<string, string>;
  onSecretChange: (name: string, value: string) => void;
}) {
  if (field.type === 'secret') {
    const secret = secrets.find((s) => s.name === field.name);
    if (!secret) return null;
    return (
      <SecretField
        name={field.name}
        description={field.description}
        value={secretValues[field.name] || ''}
        onChange={onSecretChange}
      />
    );
  }

  if (field.type === 'select' && field.choices) {
    const envVar = envVars.find((e) => e.name === field.name);
    return (
      <FormGroup label={field.label} fieldId={`field-${field.name}`}>
        <FormSelect
          id={`field-${field.name}`}
          value={envVar?.value || field.default || ''}
          isDisabled
          aria-label={field.label}
        >
          {field.choices.map((choice) => {
            const val = typeof choice === 'string' ? choice : choice.value;
            const label = typeof choice === 'string' ? choice : choice.label;
            return (
              <FormSelectOption key={val} value={val} label={label} />
            );
          })}
        </FormSelect>
        {field.description && (
          <Content component={ContentVariants.small}>{field.description}</Content>
        )}
      </FormGroup>
    );
  }

  if (field.type === 'boolean') {
    const envVar = envVars.find((e) => e.name === field.name);
    const checked = envVar ? envVar.value === 'true' : field.default === 'true';
    return (
      <FormGroup fieldId={`field-${field.name}`}>
        <Switch
          id={`field-${field.name}`}
          label={field.label}
          isChecked={checked}
          isDisabled
        />
      </FormGroup>
    );
  }

  const envVar = envVars.find((e) => e.name === field.name);
  return (
    <FormGroup label={field.label} fieldId={`field-${field.name}`}>
      <TextInput
        id={`field-${field.name}`}
        value={envVar?.value || field.default || ''}
        placeholder={field.placeholder}
        isDisabled
      />
      {field.description && (
        <Content component={ContentVariants.small}>{field.description}</Content>
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
  envVars,
  secrets,
  secretValues,
  onSecretChange,
}: {
  section: HarnessConfigSection;
  envVars: EnvVarSpec[];
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
          {activeOption.fields?.map((f) => (
            <ConfigField
              key={f.name}
              field={f}
              envVars={envVars}
              secrets={secrets}
              secretValues={secretValues}
              onSecretChange={onSecretChange}
            />
          ))}
        </>
      )}
    </Form>
  );
}

function FieldsSectionContent({
  section,
  envVars,
  secrets,
  secretValues,
  onSecretChange,
}: {
  section: HarnessConfigSection;
  envVars: EnvVarSpec[];
  secrets: SecretSpec[];
  secretValues: Record<string, string>;
  onSecretChange: (name: string, value: string) => void;
}) {
  if (!section.fields?.length) return null;

  return (
    <Form>
      {section.description && (
        <Content component={ContentVariants.small}>
          {section.description}
        </Content>
      )}
      {section.fields.map((f) => (
        <ConfigField
          key={f.name}
          field={f}
          envVars={envVars}
          secrets={secrets}
          secretValues={secretValues}
          onSecretChange={onSecretChange}
        />
      ))}
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
  prevEnvVars: EnvVarSpec[],
  prevSecrets: SecretSpec[],
  nextEnvVars: EnvVarSpec[],
  nextSecrets: SecretSpec[],
  nameToSection: Map<string, string>,
): string | null {
  for (const env of nextEnvVars) {
    const prev = prevEnvVars.find((e) => e.name === env.name);
    if (!prev || prev.value !== env.value) {
      return nameToSection.get(env.name) ?? OTHER_VARS_ID;
    }
  }
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
  envVars,
  secrets,
  secretValues,
  onSecretChange,
}: ConfigurationTabProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const prevEnvVarsRef = useRef(envVars);
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
      prevEnvVarsRef.current,
      prevSecretsRef.current,
      envVars,
      secrets,
      nameToSection,
    );
    if (changed) {
      setExpandedId(changed);
    }
    prevEnvVarsRef.current = envVars;
    prevSecretsRef.current = secrets;
  }, [envVars, secrets, nameToSection]);

  if (!configSchema) {
    if (envVars.length === 0 && secrets.length === 0) {
      return <p>No configuration options yet.</p>;
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
        {envVars.map((env) => (
          <FormGroup key={env.name} label={env.name} fieldId={`env-${env.name}`}>
            <TextInput
              id={`env-${env.name}`}
              value={env.value}
              isDisabled
            />
          </FormGroup>
        ))}
      </Form>
    );
  }

  const schemaNames = collectSchemaNames(configSchema);
  const extraEnvVars = envVars.filter((e) => !schemaNames.has(e.name));
  const extraSecrets = secrets.filter((s) => !schemaNames.has(s.name));
  const hasOtherVars = extraEnvVars.length > 0 || extraSecrets.length > 0;

  return (
    <div>
      {configSchema.sections.map((section) => {
        const isExpanded = expandedId === section.id;
        const content = section.options ? (
          <ProviderSectionContent
            section={section}
            envVars={envVars}
            secrets={secrets}
            secretValues={secretValues}
            onSecretChange={onSecretChange}
          />
        ) : (
          <FieldsSectionContent
            section={section}
            envVars={envVars}
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
      {hasOtherVars && (
        <ExpandableSection
          toggleText="Environment Variables"
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
            {extraEnvVars.map((env) => (
              <FormGroup
                key={env.name}
                label={env.name}
                fieldId={`env-${env.name}`}
              >
                <TextInput
                  id={`env-${env.name}`}
                  value={env.value}
                  isDisabled
                />
              </FormGroup>
            ))}
          </Form>
        </ExpandableSection>
      )}
    </div>
  );
}
