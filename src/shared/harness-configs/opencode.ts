import type { HarnessConfigSchema } from '../types.js';

export const opencodeConfigSchema: HarnessConfigSchema = {
  id: 'opencode',
  version: '1.17.1',
  sections: [
    {
      id: 'provider',
      title: 'LLM Provider',
      description: 'Which LLM service powers the agent',
      options: [
        {
          id: 'anthropic',
          label: 'Anthropic (Claude)',
          default: true,
          secrets: [
            {
              name: 'ANTHROPIC_API_KEY',
              description: 'Anthropic API key (starts with sk-ant-...)',
            },
          ],
          config: { model: 'anthropic/sonnet' },
        },
        {
          id: 'openai',
          label: 'OpenAI',
          secrets: [
            {
              name: 'OPENAI_API_KEY',
              description: 'OpenAI API key',
            },
          ],
          config: { model: 'openai/gpt-4o' },
        },
        {
          id: 'openrouter',
          label: 'OpenRouter',
          secrets: [
            {
              name: 'OPENROUTER_API_KEY',
              description: 'OpenRouter API key',
            },
          ],
          config: { model: 'openrouter/anthropic/claude-sonnet' },
        },
        {
          id: 'google-vertex',
          label: 'Google Vertex AI',
          secrets: [
            {
              name: 'GOOGLE_APPLICATION_CREDENTIALS_JSON',
              description: 'GCP service account key JSON',
            },
          ],
          config: { model: 'google-vertex/claude-sonnet' },
          fields: [
            {
              name: 'gcp_project',
              label: 'GCP Project ID',
              type: 'text',
              placeholder: 'my-gcp-project',
            },
          ],
        },
        {
          id: 'custom',
          label: 'Custom / Self-hosted',
          secrets: [
            {
              name: 'CUSTOM_API_KEY',
              description: 'API key or bearer token for custom endpoint',
            },
          ],
          fields: [
            {
              name: 'base_url',
              label: 'API Base URL',
              type: 'text',
              placeholder: 'http://vllm-service.ns.svc.cluster.local/v1',
            },
            {
              name: 'model_id',
              label: 'Model ID',
              type: 'text',
              placeholder: 'meta-llama/Llama-3.1-70B',
            },
            {
              name: 'context_window',
              label: 'Context window (tokens)',
              type: 'text',
              default: '32768',
            },
            {
              name: 'max_output',
              label: 'Max output tokens',
              type: 'text',
              default: '4096',
            },
          ],
        },
      ],
    },
    {
      id: 'git',
      title: 'Git Integration',
      description: 'Credentials for pushing code and creating PRs',
      fields: [
        {
          name: 'GITHUB_PAT',
          label: 'GitHub PAT',
          type: 'secret',
          description: 'Personal Access Token with repo scope',
        },
        {
          name: 'GIT_USER_NAME',
          label: 'Git user name',
          type: 'text',
          default: 'opencode-agent',
        },
        {
          name: 'GIT_USER_EMAIL',
          label: 'Git email',
          type: 'text',
          default: 'opencode-agent@noreply.github.com',
        },
      ],
    },
    {
      id: 'mcp',
      title: 'MCP Servers',
      description: 'External tool servers to extend agent capabilities',
      dynamic: true,
      template: {
        fields: [
          {
            name: 'server_name',
            label: 'Server name',
            type: 'text',
            placeholder: 'my-server',
          },
          {
            name: 'server_type',
            label: 'Transport',
            type: 'select',
            choices: [
              { label: 'Local (stdio)', value: 'local' },
              { label: 'Remote (HTTP+SSE)', value: 'remote' },
            ],
          },
          {
            name: 'command_or_url',
            label: 'Command / URL',
            type: 'text',
            placeholder:
              'npx -y @modelcontextprotocol/server-filesystem /workspace',
          },
        ],
      },
    },
    {
      id: 'observability',
      title: 'Observability',
      description: 'Tracing and monitoring for agent sessions',
      collapsed: true,
      fields: [
        {
          name: 'mlflow_enabled',
          label: 'Enable MLflow tracing',
          type: 'boolean',
          default: 'false',
        },
        {
          name: 'MLFLOW_TRACKING_URI',
          label: 'MLflow tracking URI',
          type: 'text',
          placeholder: 'https://mlflow.<namespace>.svc:8443/mlflow',
        },
        {
          name: 'MLFLOW_EXPERIMENT_NAME',
          label: 'Experiment name',
          type: 'text',
          default: 'opencode-traces',
        },
      ],
    },
    {
      id: 'advanced',
      title: 'Advanced',
      description: 'Permissions, snapshots, and other tuning',
      collapsed: true,
      fields: [
        {
          name: 'permissions_mode',
          label: 'Permissions',
          type: 'select',
          choices: [
            { label: 'Ask before risky actions (recommended)', value: 'ask' },
            {
              label: 'Allow all (sandboxed environments only)',
              value: 'allow-all',
            },
          ],
        },
        {
          name: 'snapshots',
          label: 'Enable snapshots (undo/revert)',
          type: 'boolean',
          default: 'true',
        },
        {
          name: 'shell',
          label: 'Default shell',
          type: 'select',
          choices: [
            { label: 'bash', value: 'bash' },
            { label: 'zsh', value: 'zsh' },
            { label: 'sh', value: 'sh' },
          ],
        },
      ],
    },
  ],
};
