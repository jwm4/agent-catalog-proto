import type { HarnessDefinition } from '@shared/types';

export const harnesses: HarnessDefinition[] = [
  {
    id: 'opencode',
    name: 'OpenCode',
    description:
      'An open-source AI coding agent for the terminal. Pre-installed in a UBI 10 container with gh, glab, shellcheck, uv, and a skills registry.',
    longDescription:
      'OpenCode is a terminal-based AI coding agent that helps developers write, review, and refactor code. The OpenCode starter kit provides a ready-to-run container image based on UBI 10 minimal with OpenCode pre-installed alongside common development tools. Customize it with additional language SDKs, build tools, and project-specific configurations.',
    icon: '',
    tags: ['OpenCode', 'Starter kit'],
    license: 'open-source',
    hasBaseImage: true,
    baseConfig: {
      harnessId: 'opencode',
      baseImage: 'quay.io/aipcc/agentic-ci/opencode-runner:latest',
      buildArgs: {},
      runCommands: [],
      envVars: [
        { name: 'AGENT_TOOL', value: 'opencode' },
        {
          name: 'OPENCODE_CONFIG_DIR',
          value: '/home/agent-ci/.config/opencode',
        },
      ],
      secrets: [],
      files: [],
      volumes: [
        {
          name: 'workspace',
          mountPath: '/home/agent-ci',
          size: '1Gi',
          accessMode: 'ReadWriteOnce',
        },
      ],
      entrypoint: ['entrypoint.sh'],
      labels: {
        'io.openshift.tags': 'ai,agent,opencode',
      },
      exposedPorts: [],
    },
    systemPrompt: '',
    documentationUrl: 'https://github.com/opencode-ai/opencode',
    backends: [
      {
        id: 'anthropic',
        name: 'Anthropic API',
        description: 'Direct Anthropic API access',
        requiredEnvVars: ['ANTHROPIC_API_KEY'],
      },
      {
        id: 'vertex',
        name: 'Vertex AI',
        description: 'Google Cloud Vertex AI with Claude models',
        requiredEnvVars: ['GOOGLE_APPLICATION_CREDENTIALS'],
      },
    ],
    readme: `# OpenCode

An open-source AI coding agent for the terminal, built for speed and simplicity.

## What's Included

The OpenCode starter kit container comes pre-configured with:

- **OpenCode v1.17.3** ready to run
- **GitHub CLI** (\`gh\`) and **GitLab CLI** (\`glab\`) for repository operations
- **ShellCheck** for shell script analysis
- **uv** for fast Python package management
- **Git** for version control
- A pre-cloned **skills registry** for agent capabilities

## Customization

Since OpenCode is already installed in the base image, the customization conversation focuses on your project's needs:

- **Language SDKs:** Add Node.js, Go, Java, Rust, or other runtimes
- **Build tools:** Add make, cmake, gradle, maven, or others
- **Linting and formatting:** Add eslint, prettier, ruff, or other tools
- **MCP servers:** Configure additional tool servers
- **Environment variables:** Set up LLM provider credentials

## Getting Started

1. Click **Customize and Deploy** to start the AI-guided setup
2. Tell the agent what languages and tools your project uses
3. Configure your LLM provider credentials
4. Deploy to your OpenShift cluster
`,
  },
  {
    id: 'claude-code',
    name: 'Claude Code',
    description:
      'Starter kits for building and deploying agents with Claude Code tooling on Red Hat OpenShift AI.',
    longDescription:
      'Claude Code is an agentic coding tool by Anthropic that lives in your terminal. It understands your codebase, can edit files, run commands, and help you work more efficiently. The starter kit builds a container from UBI 10 minimal, installing Claude Code via the native installer along with common development tools.',
    icon: '',
    tags: ['Claude Code', 'Starter kit'],
    license: 'proprietary',
    hasBaseImage: false,
    baseConfig: {
      harnessId: 'claude-code',
      baseImage: 'registry.access.redhat.com/ubi10/ubi-minimal:latest',
      buildArgs: {
        CLAUDE_CODE_VERSION: 'latest',
      },
      runCommands: [
        'microdnf install -y git curl jq python3 pip nodejs npm && microdnf clean all',
        'npm install -g @anthropic-ai/claude-code',
      ],
      envVars: [],
      secrets: [
        {
          name: 'ANTHROPIC_API_KEY',
          description: 'Anthropic API key for Claude model access',
        },
      ],
      files: [],
      volumes: [
        {
          name: 'workspace',
          mountPath: '/workspace',
          size: '1Gi',
          accessMode: 'ReadWriteOnce',
        },
      ],
      entrypoint: ['/bin/bash'],
      labels: {
        'io.openshift.tags': 'ai,agent,claude-code',
      },
      exposedPorts: [],
    },
    systemPrompt: '',
    documentationUrl:
      'https://github.com/anthropics/claude-code',
    backends: [
      {
        id: 'anthropic',
        name: 'Anthropic API',
        description: 'Direct Anthropic API access',
        requiredEnvVars: ['ANTHROPIC_API_KEY'],
      },
      {
        id: 'vertex',
        name: 'Vertex AI',
        description: 'Google Cloud Vertex AI with Claude models',
        requiredEnvVars: ['GOOGLE_APPLICATION_CREDENTIALS'],
      },
    ],
    readme: `# Claude Code

An agentic coding tool by Anthropic that lives in your terminal, understands your codebase, and helps you code faster.

## How It Works

Claude Code runs in your terminal and can:

- **Understand your codebase** by reading files and analyzing project structure
- **Edit files** with precise, targeted changes
- **Run commands** to build, test, and debug your code
- **Search the web** for documentation and solutions

## Licensing Notice

**Do not redistribute built container images.** The Containerfile installs Claude Code at build time via Anthropic's native installer. The resulting image contains Anthropic's proprietary binary, which is subject to their [commercial terms](https://www.anthropic.com/terms) ("All rights reserved"). Building the image yourself for internal use is permitted, but redistributing the built image (e.g., pushing to a public registry) is not authorized.

## Prerequisites

- An Anthropic API key OR a GCP service account key for Vertex AI
- An OpenShift cluster to deploy to

## Getting Started

1. Click **Customize and Deploy** to start the AI-guided setup
2. Configure your development tools and language runtimes
3. Set up your API credentials in the Env Vars tab
4. Deploy to your OpenShift cluster
`,
  },
  {
    id: 'openclaw',
    name: 'OpenClaw',
    description:
      'OpenClaw agent deployment templates for Red Hat OpenShift, including container images and Helm-based deployment patterns.',
    longDescription:
      'OpenClaw is an extensible AI agent platform with a plugin architecture. It supports vault integration, shell access, and multiple LLM providers. The starter kit provides container images and deployment patterns for running OpenClaw on OpenShift with persistent state and configurable extensions.',
    icon: '',
    tags: ['OpenClaw', 'Starter kit'],
    license: 'open-source',
    hasBaseImage: true,
    baseConfig: {
      harnessId: 'openclaw',
      baseImage: 'ghcr.io/openclaw/openclaw:latest',
      buildArgs: {},
      runCommands: [],
      envVars: [],
      secrets: [],
      files: [],
      volumes: [
        {
          name: 'openclaw-state',
          mountPath: '/home/node/.openclaw',
          size: '1Gi',
          accessMode: 'ReadWriteOnce',
        },
      ],
      entrypoint: [],
      labels: {
        'io.openshift.tags': 'ai,agent,openclaw',
      },
      exposedPorts: [3000],
    },
    systemPrompt: '',
    documentationUrl: 'https://github.com/openclaw/openclaw',
    backends: [
      {
        id: 'anthropic',
        name: 'Anthropic API',
        description: 'Direct Anthropic API access',
        requiredEnvVars: ['ANTHROPIC_API_KEY'],
      },
      {
        id: 'openai',
        name: 'OpenAI API',
        description: 'OpenAI API access',
        requiredEnvVars: ['OPENAI_API_KEY'],
      },
    ],
    readme: `# OpenClaw

An extensible AI agent platform with a plugin architecture for Red Hat OpenShift.

## Features

- **Plugin system** for adding capabilities (vault, openshell, and more)
- **Web UI** for interactive agent sessions
- **Multiple LLM providers** supported out of the box
- **Persistent state** via SQLite (requires block storage)

## Important Notes

- OpenClaw uses SQLite for state persistence, which requires block storage (not NFS)
- The web UI is exposed on port 3000
- Plugins are installed via npm at container startup

## Getting Started

1. Click **Customize and Deploy** to start the AI-guided setup
2. Select which plugins to enable
3. Configure your LLM provider credentials
4. Deploy to your OpenShift cluster with persistent storage
`,
  },
  {
    id: 'codex',
    name: 'Codex',
    description:
      'Open-source AI coding agent by OpenAI. Runs in the terminal with support for code generation, editing, and command execution.',
    longDescription:
      'Codex is an open-source command-line AI coding agent by OpenAI. It can generate code, edit files, and execute commands in your terminal. The starter kit provides a container setup for deploying Codex on OpenShift with workspace persistence.',
    icon: '',
    tags: ['Codex', 'Starter kit'],
    license: 'open-source',
    hasBaseImage: false,
    baseConfig: {
      harnessId: 'codex',
      baseImage: 'registry.access.redhat.com/ubi10/ubi-minimal:latest',
      buildArgs: {},
      runCommands: [
        'microdnf install -y git curl nodejs npm && microdnf clean all',
      ],
      envVars: [],
      secrets: [
        {
          name: 'OPENAI_API_KEY',
          description: 'OpenAI API key for Codex model access',
        },
      ],
      files: [],
      volumes: [
        {
          name: 'workspace',
          mountPath: '/workspace',
          size: '1Gi',
          accessMode: 'ReadWriteOnce',
        },
      ],
      entrypoint: ['/bin/bash'],
      labels: {
        'io.openshift.tags': 'ai,agent,codex',
      },
      exposedPorts: [],
    },
    systemPrompt: '',
    documentationUrl: 'https://github.com/openai/codex',
    backends: [
      {
        id: 'openai',
        name: 'OpenAI API',
        description: 'OpenAI API access',
        requiredEnvVars: ['OPENAI_API_KEY'],
      },
    ],
    readme: `# Codex

An open-source AI coding agent by OpenAI for terminal-based development.

## Features

- **Code generation** from natural language descriptions
- **File editing** with context-aware changes
- **Command execution** for building, testing, and debugging
- **Terminal-native** workflow

## Getting Started

1. Click **Customize and Deploy** to start the AI-guided setup
2. Configure your development environment and tools
3. Set up your OpenAI API key in the Env Vars tab
4. Deploy to your OpenShift cluster
`,
  },
];

export function getHarnessById(id: string): HarnessDefinition | undefined {
  return harnesses.find((h) => h.id === id);
}
