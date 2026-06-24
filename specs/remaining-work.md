# Remaining Work

**Date:** 2026-06-23
**Context:** Phases 1-3 are complete. Phase 4 is mostly done (skill structure
in place, behavioral guidance written, but delivered as a workaround). Phase 5
is partially done. Phase 6 is not started.

## Priority 0: Native Goose skill delivery in ACP mode

The container-customizer skill exists at
`agent-workspace/.agents/skills/container-customizer/SKILL.md` with five
resource files. However, Goose's ACP mode does not deliver SKILL.md body
content to the agent (the Summon extension is not fully implemented for
`goosed serve`). As a workaround, `instruction-assembler.ts` reads the
SKILL.md body and sends it as the first user message.

This works but likely underperforms native skill loading because:
- The guidance arrives as a user message rather than a system-level skill
- The model may treat user-message instructions with less authority
- No structured skill invocation (the agent reads resource files via `cat`)

**Upstream issues:** goose#6642, goose#7309, goose#7697

**When to revisit:** When Goose ships ACP skill content delivery, remove the
`readSkillBody()` workaround in `instruction-assembler.ts` and let the skill
system handle it natively.

**Files:** `src/server/services/instruction-assembler.ts`,
`agent-workspace/.agents/skills/container-customizer/`

## Priority 1: End-to-End Testing

Do a thorough end-to-end test of the existing workflow. Prior testing covered
AI configuration and build/deploy separately, but not the full path where the
AI conversation produces a complex configuration that is then built and
deployed.

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

## Priority 2: Typing indicator through full response

The chat loading indicator (`isLoading`) currently clears on the first text
chunk or tool call. It should persist until the SSE stream sends `[DONE]`,
so the user sees the AI is still working during multi-tool-call sequences.

**Files:** `src/client/components/ChatPane.tsx`
**Scope:** Small change, mainly adjusting when `isLoading` is set to `false`.

## Priority 3: Error handling in AI conversation

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

## Priority 4: Viewable file contents in Files tab

Clicking a file in the Files tab should expand or open a read-only view of
its content. For inline files (e.g., generated config.json), the content is
already in the ContainerSpec. For local or URL-sourced files, the backend
fetches and returns the content on demand.

**Files:** `src/client/components/spec-tabs/FilesTab.tsx`, possibly a new
backend endpoint for non-inline files.

## Priority 5: Dark mode and theme switching

Wire up the dark/light toggle in the masthead. Persist preference in
localStorage. Verify all pages render correctly in both themes. PatternFly 6
supports this via token-based theming.

**Files:** `src/client/components/AppLayout.tsx`, possibly a theme context
provider.

## Priority 6: On-cluster testing of other harnesses

Build and deploy the OpenClaw and Codex harnesses on an actual cluster.
OpenClaw exposes port 3000 (web UI) and uses SQLite (needs block storage).
Codex requires an OpenAI API key. Verify the generated manifests, Service,
and Route work correctly for harnesses with exposed ports.

## Priority 7: Shipwright Build support

The build layer (`src/server/services/build-backend.ts`) has a
`BuildBackend` interface so Shipwright can replace BuildConfig later. Add a
`ShipwrightBackend` implementation that uses Shipwright Build/BuildRun CRDs
instead of OpenShift BuildConfig. This is lower priority since BuildConfig
works fine for the prototype.

## Priority 8: Agent behavioral quality

The agent does not consistently follow the SKILL.md behavioral guidance.
Observed issues during testing (2026-06-23):

- **Dumps checklists** instead of asking one question at a time
- **Installs packages without asking**, violating "Recommend, then act"
- **Duplicate tool calls** (e.g., installing Gradle twice, which caused a
  build failure). A code-level dedup guard was added to `tools.ts`, but the
  agent should not be making duplicate calls in the first place.
- **Anthropic shown as "default" provider** when asking about LLM providers.
  OpenCode has no real default. The config schema (`opencode.ts`) marks
  Anthropic with `default: true`, which leaks into the prompt.

This may partly be a consequence of Priority 0 (guidance delivered as a user
message rather than a native skill). Revisit after native skill delivery is
available. If the issues persist, consider whether the guidance needs to be
shorter and more direct, or whether the model needs explicit few-shot examples.

**Files:** `agent-workspace/.agents/skills/container-customizer/SKILL.md`,
`src/shared/harness-configs/opencode.ts` (remove `default: true`)

## Priority 9: MLflow auto-discovery and web UI link

Two MLflow UX improvements identified during testing:

**Auto-discover tracking URI:** Instead of asking the user to paste the MLflow
URL, detect it automatically. If the user is logged into OpenShift, run
`oc get svc mlflow -n redhat-ods-applications` to construct the tracking URI.
If they are not logged in, provide the oc commands as instructions. The
opencode.md resource file already documents this, but the skill does not
attempt auto-discovery during the conversation.

**Web UI link post-deploy:** After deployment, show a link to the MLflow web
UI in the deployment status panel. The correct URL comes from the ConsoleLink,
not the direct route:
`oc get consolelink mlflow -o jsonpath='{.spec.href}'`. The gateway URL
handles OAuth; the direct route does not handle browser auth.

**Files:** `agent-workspace/.agents/skills/container-customizer/resources/opencode.md`,
`src/client/components/BuildDeployPanel.tsx` (for the post-deploy link)

## Priority 10: Document attachment in chat

The PatternFly Chatbot MessageBar includes a built-in attach button. It is
currently hidden (`hasAttachButton={false}`) because no upload handling is
implemented. Adding support would let users attach files (e.g., a
requirements.txt, existing Dockerfile, or project config) for the agent to
reference during the conversation.

Implementation would need:
- An `onAttach` handler in ChatPane.tsx
- A backend endpoint to receive the file and make it available to the Goose
  session (likely via the MCP server or a temporary file in agent-workspace)
- Passing the file content or path to the agent as part of the next message

**Files:** `src/client/components/ChatPane.tsx`, `src/server/routes/session.ts`

## Priority 11: Web search for the agent

The agent currently has no web search capability. It relies on its training
data and the resource files for all knowledge. This is usually sufficient, but
falls short when:

- The user wants to work with an obscure technology stack and the agent needs
  to look up the right packages and dependencies to install
- The user asks about GPU requirements, model compatibility, or other
  hardware-specific details that change frequently
- The user references a tool or framework the model has limited training data
  about

Add a web search MCP server (e.g., Brave Search, Tavily) as an additional MCP
server registered alongside containerspec in the ACP session. This requires an
API key for the search provider, so it should be optional and configurable.

**Files:** `src/server/services/goose.ts` (register additional MCP server),
possibly a search API key in server config

