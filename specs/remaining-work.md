# Remaining Work

**Date:** 2026-06-27
**Context:** Phases 1-3 are complete. Phase 4 is mostly done. Phase 5
is partially done. Phase 6 is not started.

---

## Quick wins

### Re-enable Build & Deploy after build failure

When a build fails, the Build & Deploy button stays disabled and the user
has to find and click "Close" on the old build panel before they can try
again. Typically the AI has already fixed the issue, so the user wants to
immediately retry. The UI should either automatically re-enable the button
after a failure, or provide a prominent "Retry Build" action, rather than
requiring the user to manually dismiss the failed build first.

**Files:** `src/client/components/BuildDeployPanel.tsx`

### Highlight Containerfile changes

When the AI modifies the ContainerSpec, boldface (or otherwise visually
highlight) the lines in the Containerfile tab that changed since the last
human message. Currently the user has to diff the Containerfile mentally to
see what the agent just did. A visual indicator of "what just changed" would
make it much easier to follow the conversation's effect on the build.

**Files:** `src/client/components/ContainerfileTab.tsx` (or equivalent),
possibly track a "last seen" snapshot of the Containerfile in the chat state.

### Post-deploy MLflow web UI link

After deployment, show a link to the MLflow web UI in the deployment status
panel. The correct URL comes from the ConsoleLink, not the direct route:
`oc get consolelink mlflow -o jsonpath='{.spec.href}'`. The gateway URL
handles OAuth; the direct route does not handle browser auth.

**Files:** `src/client/components/BuildDeployPanel.tsx`

### Dark mode and theme switching

Wire up the dark/light toggle in the masthead. Persist preference in
localStorage. Verify all pages render correctly in both themes. PatternFly 6
supports this via token-based theming.

**Files:** `src/client/components/AppLayout.tsx`, possibly a theme context
provider.

---

## High demo impact

### OpenCode web UI deployment option

OpenCode has a web UI mode in addition to its terminal TUI. Offer an option
to deploy OpenCode with the web UI exposed via an OpenShift Route, so users
can access it from a browser instead of logging into a terminal. This should
be optional since some users prefer the terminal. Implementation would need
the correct OpenCode startup command for web/serve mode, an exposed port
(and corresponding Service/Route), and possibly authentication in front of
the Route.

**Files:** `src/shared/harnesses.ts` (opencode harness config),
`agent-workspace/.agents/skills/container-customizer/resources/opencode.md`,
`src/server/services/deploy.ts` (Route generation)

### Test and refine the repo-based workflow

The agent can ask users what repo they're working on, but the end-to-end
flow for this has not been tested. Define the expected behavior: should the
agent clone the repo into the container, inspect its structure to suggest
language runtimes and tools, set up git credentials for push access, or
something else? Once the intended behavior is clear, verify the skill
guidance supports it and test the full path from "I'm working on
github.com/org/repo" through build and deploy.

**Files:** `agent-workspace/.agents/skills/container-customizer/SKILL.md`,
`agent-workspace/.agents/skills/container-customizer/resources/opencode.md`

### Upload local files into the container

Users should be able to specify files from their local machine to include in
the container image. For example, a user with an existing project directory
or config files should be able to upload them so the agent can operate on
them inside the container. This is different from document attachment in chat
(attaching files for the agent to reference during conversation); this is
about embedding files into the built image or mounting them as ConfigMaps.

Implementation would need:
- A file picker UI (possibly in the Files tab or a dedicated upload area)
- A backend endpoint to receive uploaded files and add them to the
  ContainerSpec as FileSpec entries with `sourceType: 'local'`
- Integration with the build context assembly so local files are included
  in the build

**Files:** `src/client/components/FilesTab.tsx`,
`src/server/services/build-context.ts`, `src/server/routes/session.ts`

---

## Medium priority

### Auto-discover available models on the cluster

When the user wants to connect to a self-hosted model on the RHOAI cluster,
the agent currently asks them to paste the service URL manually. Instead,
the agent should be able to discover what InferenceService or ServingRuntime
resources are already running on the cluster and present them as options.
The user can then pick a discovered model or enter a custom URL for an
external endpoint.

Implementation would need:
- An MCP tool or shell command to list InferenceService resources across
  accessible namespaces (e.g., `oc get inferenceservice -A`)
- Parsing the results to extract model names and internal service URLs
- Presenting the discovered models to the user as choices in the
  conversation
- Falling back to manual URL entry if no models are found or the user wants
  a different endpoint

**Files:** `agent-workspace/.agents/skills/container-customizer/SKILL.md`,
`agent-workspace/.agents/skills/container-customizer/resources/opencode.md`,
possibly a new MCP tool in `src/server/mcp-server/`

### Reconsider the Configuration tab

The Configuration tab was trimmed to avoid duplicating content shown in other
tabs (Containerfile, Env Vars, Files, Volumes). As a result, it may now be
too sparse or unclear in purpose. Decide what information genuinely belongs
there (e.g., a summary view, harness-level settings, deployment target
config), give it a more descriptive name if the scope narrows, and ensure it
provides value distinct from the other tabs.

**Files:** `src/client/components/ConfigurationTab.tsx` (or equivalent),
`src/client/components/CustomizePage.tsx`

### Document attachment in chat

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

### Agent behavioral quality

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
consequence of guidance delivered as a user message rather than a native
skill. Revisit after native skill delivery is available. If the issues
persist, consider whether the guidance needs to be shorter and more direct,
or whether the model needs explicit few-shot examples.

**Files:** `agent-workspace/.agents/skills/container-customizer/SKILL.md`

---

## Lower priority / blocked

### On-cluster testing of other harnesses

Build and deploy the OpenClaw and Codex harnesses on an actual cluster.
OpenClaw exposes port 3000 (web UI) and uses SQLite (needs block storage).
Codex requires an OpenAI API key. Verify the generated manifests, Service,
and Route work correctly for harnesses with exposed ports.

When adding a second harness, extract harness-agnostic content from
`opencode.md` into shared resource files. MLflow tracing, self-hosted model
auth, and RBAC setup are not OpenCode-specific and should be reusable across
harnesses. `self-hosted-models.md` is already shared; do the same for MLflow
and any other cross-cutting sections.

### Web search for the agent

The agent currently has no web search capability. It relies on its training
data and the resource files for all knowledge. This is usually sufficient,
but falls short when the user wants to work with an obscure technology stack,
asks about hardware-specific details that change frequently, or references a
tool the model has limited training data about.

Add a web search MCP server (e.g., Brave Search, Tavily) as an additional MCP
server registered alongside containerspec in the ACP session. This requires an
API key for the search provider, so it should be optional and configurable.

**Files:** `src/server/services/goose.ts` (register additional MCP server),
possibly a search API key in server config

### Shipwright Build support

The build layer (`src/server/services/build-backend.ts`) has a
`BuildBackend` interface so Shipwright can replace BuildConfig later. Add a
`ShipwrightBackend` implementation that uses Shipwright Build/BuildRun CRDs
instead of OpenShift BuildConfig. This is lower priority since BuildConfig
works fine for the prototype.

### Agent memory for learned lessons

The agent should maintain a memory file where it stores critical lessons
learned during conversations. When a build fails, the agent should analyze
whether there is a general lesson (e.g., "Gradle requires JDK, not just
JRE") and persist it so future sessions benefit. Memory should also support
other kinds of learned knowledge (user preferences, common patterns, etc.).

At scale, memories fall into two categories:
- **Global memories** that apply to all users (e.g., "microdnf does not have
  package X, use npm instead")
- **Per-user memories** that are specific to one user's environment or
  preferences

The prototype only needs to handle the single-user case, but the design
should have a credible story for multi-user. Possible approach: global
memories stored in a shared file within the agent workspace, per-user
memories keyed by a user identifier and stored separately. The agent reads
both at session start and appends during the session.

**Files:** `agent-workspace/.agents/skills/container-customizer/SKILL.md`
(guidance on when/how to write memories), new memory file(s) in
`agent-workspace/`, `src/server/services/instruction-assembler.ts`
(load memories into the agent context)

### Native Goose skill delivery in ACP mode (blocked upstream)

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

---

## End-to-end testing

Ongoing testing of the full workflow. Prior testing covered AI configuration
and build/deploy separately. Now testing the full path where the AI
conversation produces a complex configuration that is then built and deployed.

### Scenarios tested

- OpenCode with Java (Gradle) project and self-hosted vLLM: conversation
  flow tested, found and fixed duplicate Gradle install bug (dedup guards),
  Anthropic default bias (removed `default: true`), context window guidance
  issues (restructured docs), and build failure from missing `await` on
  namespace creation. Build retested and working (2026-06-24).
- Self-hosted model (vLLM) configuration flow tested multiple times. Found
  and improved: context window auto-discovery, per-harness auth guidance,
  unauthenticated endpoint handling.
- OpenCode with Java project, self-hosted vLLM, and GitHub secret: full
  customize-build-deploy cycle tested (2026-06-27). Found and fixed OpenCode
  config issues (wrong filename, schema, variable syntax).

### Scenarios still needed

1. **OpenCode with a Python project:** Tell the agent you're working on a
   Python 3.12 project with FastAPI, pytest, and ruff. Verify the agent adds
   the right setupCommands/runCommands, then build and deploy. Connect to the
   pod and confirm the tools are installed.

2. **OpenCode with Anthropic API key:** Configure the Anthropic backend via
   the Configuration tab. Verify the secret appears in the Env Vars tab,
   the K8s Secret is generated during deploy, and the env var is available
   inside the container.

3. **OpenCode with custom files:** Ask the agent to add a config file (e.g.,
   opencode.json or .opencode/opencode.json). Verify it appears in the Files
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

---

## Completed

### Typing indicator through full response

Resolved 2026-06-23. The `isLoading` spinner now persists on the active bot
message until the SSE stream completes. Only cleared in the `finally` block
and error handlers.

### Error handling in AI conversation

Resolved 2026-06-23. Added empty response detection (shows "The agent didn't
respond" message) and network error handling during welcome polling (shows
"Unable to connect to the agent" after 30 failed attempts). Malformed SSE
events are silently skipped. Tool call result validation deferred.

### Viewable file contents in Files tab

Resolved 2026-06-23. Inline files expand in the Files tab using PatternFly
expandable table rows with `CodeBlock` content display. Files without inline
content (local/URL sourced) are not expandable.

### Build failure from missing await

Resolved 2026-06-24. `ensureNamespaceExists()` in `build.ts` was not awaited,
so `prepare()` ran before the namespace existed. The ImageStream `oc apply`
failed silently (error swallowed by try/catch), then `oc start-build` failed
with "InvalidOutputReference: Output image could not be resolved." Fix: added
`await`, removed silent error swallowing from `build-backend.ts` (oc apply is
idempotent), and added stderr capture to `ocApplyStdin` for better error
messages.

### Volume mount file shadowing

Resolved 2026-06-25. Files COPYed into the image under a volume mount path
(e.g., `/workspace/.opencode/config.json`) were hidden at runtime when the
PersistentVolume was mounted over the image layer. Fix: detect volume-shadowed
files during Containerfile generation, stage them to `/opt/agent-init/files/`,
and generate an init script that copies them into the volume on first start
with `cp -n` (no-clobber preserves user modifications).

### Build log feedback to Goose

Resolved 2026-06-26. When a build fails, the client auto-injects the error
and a truncated tail of build logs into the Goose conversation. The agent
analyzes the failure and suggests spec fixes. A `getBuildLogs` MCP tool lets
the agent fetch more log lines on demand. Also fixed a bug where build logs
were discarded on failure (`logLines: []` in the catch block).

### OpenCode config filename, schema, and variable syntax

Resolved 2026-06-27. The skill resource file (`opencode.md`) was generating
config that OpenCode silently ignored due to three issues: wrong filename
(`.opencode/config.json` instead of `.opencode/opencode.json`), wrong config
schema (v2 format with `providers` plural, `mcp.servers`, `api` object instead
of v1 format with `provider` singular, flat `mcp`, `options.baseURL`), and
wrong variable syntax (`${VAR}` instead of `{env:VAR}`). Found by end-to-end
testing with a self-hosted vLLM model.

### MLflow auto-discovery

Resolved 2026-06-27. The skill resource file tells the agent to run
`oc get svc mlflow -n redhat-ods-applications` to auto-discover the tracking
URI rather than asking the user to paste it. If the command fails, the agent
falls back to asking. The post-deploy MLflow web UI link is tracked
separately.
