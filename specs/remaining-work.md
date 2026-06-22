# Remaining Work

**Date:** 2026-06-22
**Context:** Phases 1-3 are complete. Phase 4 and 5 are partially done.
This document describes remaining work and testing priorities.

## Pre-requisite: End-to-End Testing

Before building new features, do a thorough end-to-end test of the existing
workflow. Prior testing covered AI configuration and build/deploy separately,
but not the full path where the AI conversation produces a complex
configuration that is then built and deployed.

### Test scenarios to run

1. **OpenCode with a Python project:** Tell the agent you're working on a
   Python 3.12 project with FastAPI, pytest, and ruff. Verify the agent adds
   the right setupCommands/runCommands, then build and deploy. Connect to the
   pod and confirm the tools are installed.

2. **OpenCode with Anthropic API key:** Configure the Anthropic backend via
   the Configuration tab. Verify the secret appears in the Env Vars tab,
   the K8s Secret is generated during deploy, and the env var is available
   inside the container.

3. **OpenCode with custom files:** Ask the agent to add a config file (e.g.,
   opencode.json or .opencode/config.json). Verify it appears in the Files
   tab, is written into the Containerfile or mounted as a ConfigMap, and
   exists inside the running container.

4. **Claude Code harness:** Repeat a basic customize-build-deploy cycle with
   the Claude Code harness. This tests a different base config (proprietary
   license, different setup commands, secret for ANTHROPIC_API_KEY).

5. **Edge cases:** Build with no customization at all (default config).
   Build after making changes, undoing them, and making different changes.
   Deploy twice to the same namespace (should patch, not fail on 409).

### What to look for

- Containerfile matches the spec viewer's Containerfile tab
- Build logs stream in real time (no stuck "Starting build...")
- Deploy completes within the timeout (120s)
- Connect command works and the agent tool is available
- Secret values are not logged or leaked in build output
- Errors surface clearly in the UI, not silent failures

## Priority 1: Typing indicator through full response

The chat loading indicator (`isLoading`) currently clears on the first text
chunk or tool call. It should persist until the SSE stream sends `[DONE]`,
so the user sees the AI is still working during multi-tool-call sequences.

**Files:** `src/client/components/ChatPane.tsx`
**Scope:** Small change, mainly adjusting when `isLoading` is set to `false`.

## Priority 2: Error handling in AI conversation

The chat pane has minimal error handling. If goosed returns an error, times
out, or the SSE stream drops, the user gets no feedback.

- Show an error message in the chat when goosed is unreachable
- Handle SSE stream disconnects gracefully (retry or show message)
- Handle malformed SSE events without crashing the chat
- Show a message if the AI's response is empty or truncated
- Validate that tool call results make sense (e.g., baseImage shouldn't be
  empty after an addPackage call)

**Files:** `src/client/components/ChatPane.tsx`, possibly
`src/server/services/goose.ts`

## Priority 3: Viewable file contents in Files tab

Clicking a file in the Files tab should expand or open a read-only view of
its content. For inline files (e.g., generated config.json), the content is
already in the ContainerSpec. For local or URL-sourced files, the backend
fetches and returns the content on demand.

**Files:** `src/client/components/spec-tabs/FilesTab.tsx`, possibly a new
backend endpoint for non-inline files.

## Priority 4: Dark mode and theme switching

Wire up the dark/light toggle in the masthead. Persist preference in
localStorage. Verify all pages render correctly in both themes. PatternFly 6
supports this via token-based theming.

**Files:** `src/client/components/AppLayout.tsx`, possibly a theme context
provider.

## Priority 5: On-cluster testing of other harnesses

Build and deploy the OpenClaw and Codex harnesses on an actual cluster.
OpenClaw exposes port 3000 (web UI) and uses SQLite (needs block storage).
Codex requires an OpenAI API key. Verify the generated manifests, Service,
and Route work correctly for harnesses with exposed ports.

## Priority 6: Shipwright Build support

The build layer (`src/server/services/build-backend.ts`) has a
`BuildBackend` interface so Shipwright can replace BuildConfig later. Add a
`ShipwrightBackend` implementation that uses Shipwright Build/BuildRun CRDs
instead of OpenShift BuildConfig. This is lower priority since BuildConfig
works fine for the prototype.

## Priority 7: Convert instruction-assembler to Goose skills

The spec originally called for Goose skills for progressive-disclosure
guidance. Currently the instruction-assembler builds a monolithic system
prompt from resource files. Converting to skills would let the agent load
guidance on demand rather than front-loading everything into the context
window. This is an optimization, not a functional change.
