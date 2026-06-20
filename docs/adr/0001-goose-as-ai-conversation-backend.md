# 1. Use Goose as AI Conversation Backend

Date: 2026-06-18

## Status

Accepted

## Context

The Agent Catalog prototype needs an AI agent backend to power the container
customization chat experience. The backend must support tool calling (for
ContainerSpec mutation), streaming responses (for the chat widget), and be
embeddable behind a custom UI.

Options evaluated:

- **Lightweight SDK (Vercel AI SDK, LangChain.js):** Provides LLM tool-calling
  but lacks full agent capabilities needed for the product vision: compaction,
  progressive skill disclosure, built-in file/bash tools, autonomous repo
  exploration. Building these on top of an SDK would replicate what established
  harnesses already do.

- **Pi** (62.8k stars, MIT, TypeScript): Has RPC mode and embeddable SDK, but
  its core is intentionally minimal (4 tools). Capabilities like web search and
  repo analysis would require custom extensions.

- **OpenHands** (75k+ stars, MIT, Python): Most capable agent, but Python-based
  (mismatch with TypeScript stack), requires Docker for sandbox, designed as a
  platform rather than embeddable component.

- **Goose** (49.5k stars, Apache 2.0, Rust): REST+SSE server (`goosed`), MCP
  support, built-in tools, compaction, recipe system.

## Decision

Use Goose (`goosed` REST+SSE server) as the AI conversation backend. The
ContainerSpec mutation tools are implemented as a custom MCP server in
TypeScript that Goose connects to via the standard MCP protocol. No Goose
modifications are required.

## Consequences

**Positive:**
- Standards-based integration via MCP. The ContainerSpec tools are portable to
  any MCP-capable agent.
- No forking or patching Goose.
- Multi-provider LLM support (15+ providers). Prototype uses Vertex AI, product
  can use any.
- Compaction handles long customization conversations automatically.
- Recipe system configures agent behavior declaratively.
- ~103 REST endpoints, proven by the Goose desktop app.

**Negative:**
- Dependency on an external project (now under Linux Foundation AAIF).
- The `goosed` API may change as the project consolidates toward `goose serve`
  with ACP (Agent Client Protocol).
- Rust binary requires platform-specific distribution (auto-download on first
  run).
