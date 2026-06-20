# Agent Catalog Prototype

A prototype of the Agent Catalog for Red Hat OpenShift AI (RHOAI). Users browse
a catalog of agentic harnesses (Claude Code, OpenCode, OpenClaw, Codex),
customize a container image through an AI-guided chat, and deploy it to an
OpenShift cluster. See `specs/agent-catalog-prototype-spec.md` for the full
specification.

## Tech Stack

- **Frontend:** React 18 + PatternFly 6 + `@patternfly/chatbot`
- **Backend:** Node.js + Express (TypeScript)
- **AI agent:** Goose (`goosed` REST+SSE server) with MCP tool support
- **ContainerSpec tools:** Custom MCP server (TypeScript, in-process with backend)
- **Build/deploy:** OpenShift BuildConfig (Docker strategy, binary source)
- **Bundler:** Vite
- **Test runner:** Vitest

## Directory Structure

```
src/
  client/        React frontend (PatternFly components)
  server/        Express backend, Goose integration layer
  mcp-server/    ContainerSpec MCP server (addPackage, setEnvVar, addFile, etc.)
  shared/        Shared TypeScript types (ContainerSpec, HarnessDefinition)
tests/
  client/        Frontend tests
  server/        Backend tests
  mcp-server/    MCP server tests
specs/           Specification and reference screenshots
docs/adr/        Architecture Decision Records
```

## Commands

```bash
# Install dependencies
npm install

# Start frontend dev server (Vite)
npm run dev

# Start backend server
npm run server

# Run all tests
npm test

# Lint (whole project)
npm run lint

# Lint a single file
npx eslint path/to/file.ts

# Type-check (whole project)
npm run typecheck

# Type-check a single file
npx tsc --noEmit path/to/file.ts

# Format code
npm run format
```

## Commit Messages

Use conventional commits. Format: `type(scope): description`

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `build`, `ci`

Scopes: `client`, `server`, `mcp-server`, `shared`, or omit for cross-cutting changes.

Examples:
- `feat(client): add catalog page card grid`
- `fix(server): handle goosed connection timeout`
- `docs: update ADR for build strategy`
- `test(mcp-server): add tests for addPackage tool`

A commit-msg hook enforces this via commitlint.

## Coding Conventions

- TypeScript strict mode. All new code must be fully typed.
- Use PatternFly 6 components for all UI elements. Do not use custom CSS for
  layout or styling when a PatternFly component covers the need.
- Use PatternFly spacing, typography, and color tokens consistently.
- Follow the design prototype screenshots (`specs/s1.jpg`, `specs/s2.jpg`)
  over the earlier mockup (`specs/agent_cat.png`) when they differ.
- Backend uses Express with async/await. No callback-style handlers.
- MCP server tools follow the schema defined in `src/shared/types.ts`.
- Secret values must never be sent to Goose or the LLM. Secrets are collected
  via the Env Vars tab UI and held in memory only until Kubernetes Secret
  creation.

## Key Architectural Decisions

- **Goose** is the AI conversation backend. ContainerSpec mutation tools are a
  custom MCP server, not Goose modifications. See `docs/adr/0001-*.md`.
- **OpenCode** is the first harness to implement (base image already exists).
  See `docs/adr/0002-*.md`.
- **On-cluster builds** via OpenShift BuildConfig for the prototype. The build
  layer has a clean interface so Shipwright can replace it later.
  See `docs/adr/0003-*.md`.
