# Agent Catalog Prototype

A working prototype of the Agent Catalog for Red Hat OpenShift AI (RHOAI).
Browse a catalog of AI coding agent harnesses, customize container images
through an AI-guided conversation, and deploy to OpenShift.

## Supported Harnesses

| Harness    | Status     | License    |
|------------|------------|------------|
| OpenCode   | First      | MIT        |
| Claude Code| Planned    | Proprietary|
| OpenClaw   | Planned    | MIT        |
| Codex      | Planned    | MIT        |

## Prerequisites

- Node.js 22+
- `oc` CLI installed and logged into an OpenShift cluster (for build/deploy)
- Google Cloud credentials (ADC) configured for Vertex AI (for the AI chat)
- [Goose](https://github.com/aaif-goose/goose) (auto-downloaded on first run)

## Setup

```bash
git clone <repo-url>
cd agent-catalog-proto
npm install
```

## Usage

```bash
# Start both frontend and backend
npm run dev      # Frontend (Vite) on http://localhost:5173
npm run server   # Backend (Express) in a separate terminal
```

Open http://localhost:5173 in a browser to browse the agent catalog, select a
harness, customize it through the AI chat, and deploy to your OpenShift cluster.

## Development

```bash
# Start the frontend dev server
npm run dev

# Start the backend server (separate terminal)
npm run server

# Run tests
npm test

# Lint and type-check
npm run lint
npm run typecheck
```

## Project Structure

```
src/
  client/        React 18 + PatternFly 6 frontend
  server/        Node.js + Express backend
  mcp-server/    ContainerSpec MCP server (Goose integration)
  shared/        Shared TypeScript types
tests/           Test files (mirrors src/ structure)
specs/           Specification and reference screenshots
docs/adr/        Architecture Decision Records
```

## Specification

The full project specification is in
[specs/agent-catalog-prototype-spec.md](specs/agent-catalog-prototype-spec.md).
