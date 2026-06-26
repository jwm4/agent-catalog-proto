# Remaining Work

**Date:** 2026-06-26
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

### Testing done so far

- OpenCode with Java (Gradle) project and self-hosted vLLM: conversation
  flow tested, found and fixed duplicate Gradle install bug (dedup guards),
  Anthropic default bias (removed `default: true`), context window guidance
  issues (restructured docs), and build failure from missing `await` on
  namespace creation. Build currently being retested (2026-06-24).
- Self-hosted model (vLLM) configuration flow tested multiple times. Found
  and improved: context window auto-discovery, per-harness auth guidance,
  unauthenticated endpoint handling.

### Test scenarios still needed

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
- Build failures inject log context into the Goose conversation
- Deploy completes within the timeout (120s)
- Connect command works and the agent tool is available
- Secret values are not logged or leaked in build output
- Errors surface clearly in the UI, not silent failures

## ~~Priority 2: Typing indicator through full response~~ DONE

Resolved 2026-06-23. The `isLoading` spinner now persists on the active bot
message until the SSE stream completes. Only cleared in the `finally` block
and error handlers.

## ~~Priority 3: Error handling in AI conversation~~ DONE

Resolved 2026-06-23. Added empty response detection (shows "The agent didn't
respond" message) and network error handling during welcome polling (shows
"Unable to connect to the agent" after 30 failed attempts). Malformed SSE
events are silently skipped. Tool call result validation deferred.

## ~~Priority 4: Viewable file contents in Files tab~~ DONE

Resolved 2026-06-23. Inline files expand in the Files tab using PatternFly
expandable table rows with `CodeBlock` content display. Files without inline
content (local/URL sourced) are not expandable.

## ~~Priority 4.5: Build failure from missing await~~ DONE

Resolved 2026-06-24. `ensureNamespaceExists()` in `build.ts` was not awaited,
so `prepare()` ran before the namespace existed. The ImageStream `oc apply`
failed silently (error swallowed by try/catch), then `oc start-build` failed
with "InvalidOutputReference: Output image could not be resolved." Fix: added
`await`, removed silent error swallowing from `build-backend.ts` (oc apply is
idempotent), and added stderr capture to `ocApplyStdin` for better error
messages.

## ~~Priority 4.6: Volume mount file shadowing~~ DONE

Resolved 2026-06-25. Files COPYed into the image under a volume mount path
(e.g., `/workspace/.opencode/config.json`) were hidden at runtime when the
PersistentVolume was mounted over the image layer. Fix: detect volume-shadowed
files during Containerfile generation, stage them to `/opt/agent-init/files/`,
and generate an init script that copies them into the volume on first start
with `cp -n` (no-clobber preserves user modifications).

## ~~Priority 4.7: Build log feedback to Goose~~ DONE

Resolved 2026-06-26. When a build fails, the client auto-injects the error
and a truncated tail of build logs into the Goose conversation. The agent
analyzes the failure and suggests spec fixes. A `getBuildLogs` MCP tool lets
the agent fetch more log lines on demand. Also fixed a bug where build logs
were discarded on failure (`logLines: []` in the catch block).

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

When adding a second harness, extract harness-agnostic content from
`opencode.md` into shared resource files. MLflow tracing, self-hosted model
auth, and RBAC setup are not OpenCode-specific and should be reusable across
harnesses. `self-hosted-models.md` is already shared; do the same for MLflow
and any other cross-cutting sections.

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
- ~~**Duplicate tool calls** (e.g., installing Gradle twice, which caused a
  build failure).~~ MITIGATED: code-level dedup guards added to
  `applyAddRunCommand` and `applyAddPackage` in `tools.ts`. The agent may
  still make duplicate calls, but they are now idempotent.
- ~~**Anthropic shown as "default" provider.**~~ FIXED: removed `default: true`
  from Anthropic in `opencode.ts`.

Remaining issues (checklist dumping, unprompted installs) may partly be a
consequence of Priority 0 (guidance delivered as a user message rather than a
native skill). Revisit after native skill delivery is available. If the issues
persist, consider whether the guidance needs to be shorter and more direct, or
whether the model needs explicit few-shot examples.

**Files:** `agent-workspace/.agents/skills/container-customizer/SKILL.md`

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

