import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import type { ContainerSpec } from '../shared/types.js';
import {
  createDefaultSpec,
  applySetBaseImage,
  applyAddPackage,
  applyAddRunCommand,
  applySetEnvVar,
  applyAddSecret,
  applyAddFile,
  applyAddVolume,
  applySetEntrypoint,
  applyAddLabel,
} from './tools.js';

const SESSION_ID = process.env.SESSION_ID || '';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const HARNESS_ID = process.env.HARNESS_ID || 'unknown';
const BASE_IMAGE =
  process.env.BASE_IMAGE ||
  'registry.access.redhat.com/ubi10/ubi-minimal:latest';

let spec: ContainerSpec = createDefaultSpec(HARNESS_ID, BASE_IMAGE);

async function fetchInitialSpec(): Promise<void> {
  if (!SESSION_ID) return;
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/session/${SESSION_ID}/spec`,
    );
    if (res.ok) {
      spec = (await res.json()) as ContainerSpec;
      console.error('[containerspec] Loaded existing spec from session');
    }
  } catch (err) {
    console.error('[containerspec] Could not fetch initial spec, using default:', err);
  }
}

async function pushSpecUpdate(): Promise<void> {
  if (!SESSION_ID) {
    console.error('[containerspec] No SESSION_ID set, skipping push');
    return;
  }

  try {
    await fetch(`${BACKEND_URL}/api/session/${SESSION_ID}/spec`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(spec),
    });
  } catch (err) {
    console.error('[containerspec] Failed to push spec update:', err);
  }
}

const server = new McpServer(
  { name: 'containerspec', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.tool(
  'setBaseImage',
  'Set the base container image (FROM line)',
  { image: z.string().describe('Container image reference') },
  async ({ image }) => {
    spec = applySetBaseImage(spec, image);
    await pushSpecUpdate();
    return { content: [{ type: 'text', text: `Base image set to ${image}` }] };
  },
);

server.tool(
  'addPackage',
  'Install packages using a package manager',
  {
    manager: z
      .enum(['microdnf', 'npm', 'pip', 'go', 'cargo'])
      .describe('Package manager to use'),
    packages: z.array(z.string()).describe('Package names to install'),
  },
  async ({ manager, packages }) => {
    spec = applyAddPackage(spec, manager, packages);
    await pushSpecUpdate();
    return {
      content: [
        {
          type: 'text',
          text: `Installed ${packages.join(', ')} via ${manager}`,
        },
      ],
    };
  },
);

server.tool(
  'addRunCommand',
  'Add a custom RUN command to the Containerfile',
  { command: z.string().describe('Shell command to run during build') },
  async ({ command }) => {
    spec = applyAddRunCommand(spec, command);
    await pushSpecUpdate();
    return {
      content: [{ type: 'text', text: `Added RUN command: ${command}` }],
    };
  },
);

server.tool(
  'setEnvVar',
  'Set a non-secret environment variable',
  {
    name: z.string().describe('Environment variable name'),
    value: z.string().describe('Environment variable value'),
  },
  async ({ name, value }) => {
    spec = applySetEnvVar(spec, name, value);
    await pushSpecUpdate();
    return {
      content: [{ type: 'text', text: `Set environment variable ${name}` }],
    };
  },
);

server.tool(
  'addSecret',
  'Add a secret placeholder. The actual value is entered by the user in the Env Vars tab, not in this chat.',
  {
    name: z.string().describe('Secret environment variable name'),
    description: z
      .string()
      .describe('Human-readable description shown in the UI'),
  },
  async ({ name, description }) => {
    spec = applyAddSecret(spec, name, description);
    await pushSpecUpdate();
    return {
      content: [
        {
          type: 'text',
          text: `Added secret placeholder "${name}". The user will enter the value in the Env Vars tab.`,
        },
      ],
    };
  },
);

server.tool(
  'addFile',
  'Register a file to inject into the container',
  {
    sourcePath: z.string().describe('Source path, URL, or "inline"'),
    destPath: z.string().describe('Destination path inside the container'),
    sourceType: z
      .enum(['local', 'url', 'inline'])
      .describe('Where the file comes from'),
    content: z
      .string()
      .optional()
      .describe('File content (required for inline source type)'),
  },
  async ({ sourcePath, destPath, sourceType, content }) => {
    spec = applyAddFile(spec, sourcePath, destPath, sourceType, content);
    await pushSpecUpdate();
    return {
      content: [
        { type: 'text', text: `Added file: ${sourcePath} -> ${destPath}` },
      ],
    };
  },
);

server.tool(
  'addVolume',
  'Add a persistent volume definition',
  {
    mountPath: z.string().describe('Mount path inside the container'),
    size: z.string().describe('Volume size (e.g., "1Gi")'),
    accessMode: z
      .string()
      .describe('Access mode (e.g., "ReadWriteOnce")'),
  },
  async ({ mountPath, size, accessMode }) => {
    spec = applyAddVolume(spec, mountPath, size, accessMode);
    await pushSpecUpdate();
    return {
      content: [
        { type: 'text', text: `Added volume at ${mountPath} (${size})` },
      ],
    };
  },
);

server.tool(
  'setEntrypoint',
  'Set the container entrypoint command',
  {
    command: z
      .array(z.string())
      .describe('Entrypoint command as an array of strings'),
  },
  async ({ command }) => {
    spec = applySetEntrypoint(spec, command);
    await pushSpecUpdate();
    return {
      content: [
        { type: 'text', text: `Entrypoint set to ${JSON.stringify(command)}` },
      ],
    };
  },
);

server.tool(
  'addLabel',
  'Add a label to the container image',
  {
    key: z.string().describe('Label key'),
    value: z.string().describe('Label value'),
  },
  async ({ key, value }) => {
    spec = applyAddLabel(spec, key, value);
    await pushSpecUpdate();
    return {
      content: [{ type: 'text', text: `Added label ${key}=${value}` }],
    };
  },
);

server.tool(
  'getSpec',
  'Get the current full container specification',
  {},
  async () => {
    return {
      content: [
        { type: 'text', text: JSON.stringify(spec, null, 2) },
      ],
    };
  },
);

server.tool(
  'replaceSpec',
  'Replace the ENTIRE container specification. Use this ONLY for fundamental changes the user explicitly requests, such as switching the base image, changing the harness version, or removing setup commands. For normal additions, use addPackage, setEnvVar, addSecret, etc. Always call getSpec first so you know what you are replacing.',
  {
    spec: z.string().describe('The full ContainerSpec as a JSON string'),
  },
  async ({ spec: specJson }) => {
    try {
      spec = JSON.parse(specJson) as ContainerSpec;
      await pushSpecUpdate();
      return {
        content: [
          { type: 'text', text: 'Container specification replaced.' },
        ],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [
          { type: 'text', text: `Failed to parse spec JSON: ${msg}` },
        ],
        isError: true,
      };
    }
  },
);

async function main() {
  await fetchInitialSpec();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[containerspec] MCP server running on stdio');
}

main().catch((err) => {
  console.error('[containerspec] Fatal error:', err);
  process.exit(1);
});
