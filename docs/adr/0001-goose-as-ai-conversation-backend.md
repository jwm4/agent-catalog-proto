# 1. Use Goose as AI Conversation Backend

Date: 2026-06-18
Updated: 2026-06-20

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

### Integration approach: ACP over CLI

Goose offers two ways to embed it programmatically:

1. **ACP (Agent Client Protocol):** A single `goosed` daemon runs on a fixed
   port. The backend connects via JSON-RPC over HTTP, opens SSE channels for
   streaming, and manages sessions through `session/new`, `session/prompt`, and
   `session/close` calls.

2. **`goose run --interactive`:** Spawn one CLI process per session with
   `--output-format stream-json`. Communicate via stdin (user messages) and
   stdout (line-delimited JSON events). Supports `--system` for instructions,
   `--with-extension` for MCP servers, and `--no-profile` to suppress default
   extensions.

Both were validated experimentally (see `experiments/`). Both support streaming,
multi-turn memory, and MCP tool call visibility. We chose ACP for the following
reasons:

- **Structured protocol.** JSON-RPC requests and SSE responses are well-defined.
  The CLI approach parses newline-delimited JSON from stdout, which is more
  fragile (non-JSON output, buffering edge cases).
- **Richer tool call events.** ACP emits `session/update` events with
  `sessionUpdate: "tool_call"` that include a human-readable `title` field
  (e.g., "containerspec: addPackage"), `rawInput`, and `toolCallId`. The CLI
  approach emits `toolRequest`/`toolResponse` content blocks with the raw tool
  name (e.g., "npx__addPackage") and no title.
- **Shared daemon.** One `goosed` process serves all sessions. The CLI approach
  spawns a separate OS process per session, each loading its own extensions and
  LLM config.
- **Existing code.** The prototype already uses ACP in `src/server/services/goose.ts`.

The CLI approach has one advantage: `--system` injects a system prompt directly,
while ACP's `session/new` only accepts `cwd` and `mcpServers` (no instructions
parameter, tracked as goose issue #7596). As a workaround, we send assembled
instructions as the first `session/prompt` call immediately after session
creation. The AI's response to this prompt becomes the welcome/greeting message
the user sees in the chat. This was validated to work correctly with tool calls
and multi-turn memory.

### System prompt injection via instructions-as-first-prompt

Because ACP `session/new` does not accept an instructions or recipe parameter,
the backend assembles per-session instructions from markdown resource files and
sends them as the first `session/prompt`. The AI's response is a greeting that
becomes the first message in the chat.

**Two-tier resource loading.** The initial prompt includes only what the AI
needs immediately: its role and conversation flow (core system prompt), security
guidance, and knowledge about the selected harness's base image. Language-
specific resources (Python packages, Node.js setup, etc.) stay as files on disk
in `src/server/resources/languages/`. The system prompt tells the AI where they
are, and it reads the relevant file on demand using Goose's built-in developer
extension when it identifies the user's technology stack. This keeps the initial
prompt small and avoids loading irrelevant reference material.

The developer extension is left enabled (it loads from the user's goose config)
so the AI can read resource files. The system prompt constrains its usage to
file reads from the resources directory only, prohibiting shell commands, file
writes, and general development tasks.

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
- ACP tool call events provide enough metadata (title, rawInput, toolCallId)
  to surface tool activity in the chat UI.

**Negative:**
- Dependency on an external project (now under Linux Foundation AAIF).
- The `goosed` API may change as the project consolidates toward `goose serve`
  with ACP (Agent Client Protocol).
- Rust binary requires platform-specific distribution (auto-download on first
  run).
- ACP lacks a native system-prompt parameter, requiring the
  instructions-as-first-prompt workaround. If goose issue #7596 is resolved,
  the integration can be simplified.

**Risks and mitigations:**
- If ACP becomes unreliable or gains breaking changes, the CLI approach
  (`goose run --interactive`) is a validated fallback. The instruction assembler
  and resource files are protocol-agnostic and would work with either approach.

## Note: Skills vs. recipes vs. our resource files

Goose has two distinct knowledge-injection concepts that are easy to conflate:

- **Recipes** are agent configuration and invocation units (instructions, MCP
  server wiring, parameters, provider settings). User-invoked or scheduled.
  Closest analog: a launch configuration or parameterized job.
- **Skills** (added more recently) are domain knowledge the agent draws on via
  progressive disclosure. Model-invoked, not user-invoked. Closest analog:
  Claude Code's SKILL.md format, which Goose is adopting.

Our resource files (harness knowledge, language references, security guidance)
are conceptually skills: domain knowledge the agent should apply during the
conversation. However, for the prototype we deliver them all at once via the
instructions-as-first-prompt pattern rather than through Goose's native skill
system.

**Future opportunity:** If Goose's skill system matures with progressive
disclosure support in ACP, the language resource files could be migrated to
proper Goose skills. The current approach (AI reads files via the developer
extension) achieves on-demand loading but relies on prompt instructions to
constrain file access. Native skills would enforce that boundary structurally.
