# Threat Model: Agent Catalog Prototype

## 1. System context

A single-user, laptop-hosted prototype for browsing, customizing, and deploying
AI coding agent containers to an OpenShift cluster. The user interacts with a
React frontend in a browser, which connects to a Node.js backend over localhost.
The backend proxies chat messages to a Goose AI agent (goosed) and hosts a
ContainerSpec MCP server in-process. The AI agent uses Vertex AI (Claude model)
for inference. Container images are built on-cluster via OpenShift BuildConfig
and deployed to the same cluster.

**Security assumptions:**
- The prototype runs on localhost. No remote users, no multi-tenancy.
- The user has `oc` CLI access and appropriate RBAC on the target OpenShift
  cluster.
- Google Cloud ADC credentials are present in the environment for Vertex AI.
- The Goose agent has file system and bash access on the host (scoped by its
  built-in developer extension).

## 2. Assets

| Asset | Description | Sensitivity |
|---|---|---|
| api_keys | LLM provider API keys (Anthropic, OpenAI, Vertex AI) | high |
| git_credentials | Git PATs for repo cloning in containers | high |
| mcp_auth_tokens | Auth tokens for MCP servers configured in deployed agents | high |
| google_adc | Google Application Default Credentials for Vertex AI | high |
| kubeconfig | OpenShift cluster credentials (via oc login) | high |
| container_spec | ContainerSpec state (Containerfile content, env vars, file paths) | medium |
| chat_transcript | Goose conversation history (may contain project details) | medium |
| container_images | Built images in the OpenShift internal registry | medium |
| k8s_secrets | Kubernetes Secret objects on the cluster | high |

## 3. Entry points and trust boundaries

| Entry point | Description | Trust boundary | Reachable assets |
|---|---|---|---|
| browser_ui | React frontend on localhost | local user | container_spec, chat_transcript |
| backend_api | Express REST API on localhost | local user | container_spec, api_keys, git_credentials |
| sse_stream | SSE stream from goosed to browser (via backend proxy) | local process | chat_transcript |
| websocket | WebSocket for spec updates (backend to browser) | local process | container_spec |
| goose_mcp | MCP tool calls from Goose to ContainerSpec server | local process | container_spec |
| goose_developer | Goose built-in developer extension (file/bash access) | local process | host filesystem |
| oc_cli | oc commands issued by the backend to the cluster | cluster RBAC | k8s_secrets, container_images |
| vertex_ai | Outbound API calls to Vertex AI for LLM inference | remote API | google_adc, chat_transcript |

## 4. Threats

| ID | Threat | Actor | Impact | Likelihood | Status |
|---|---|---|---|---|---|
| T1 | Secret values leak into AI chat transcript | local user error | high | medium | mitigated |
| T2 | Goose agent executes unintended host commands via developer extension | goose agent | high | low | accepted |
| T3 | K8s Secrets readable by namespace users (base64, not encrypted) | cluster user | high | medium | accepted_for_prototype |
| T4 | Chat transcript sent to Vertex AI contains sensitive project details | remote API | medium | medium | accepted |
| T5 | Container images in internal registry lack vulnerability scanning | supply chain | medium | medium | not_mitigated |
| T6 | Goose recipe injection via crafted harness definition | local attacker | high | low | not_mitigated |
| T7 | Backend holds secret values in memory between UI entry and K8s Secret creation | local process | high | low | accepted_for_prototype |
| T8 | SSRF via Goose web browsing extension (agent fetches attacker-controlled URL) | remote content | medium | low | accepted |

## 5. Deprioritized

| Threat | Reason |
|---|---|
| XSS via chat rendering | PatternFly chatbot component sanitizes output. Standard framework protection. |
| CSRF on backend API | Prototype is localhost-only with no authentication. No session to hijack. |
| DDoS on backend | Single-user localhost prototype. No external exposure. |
| Man-in-the-middle on Vertex AI calls | HTTPS enforced by Google client libraries. |
| Privilege escalation in deployed containers | Containers run as non-root (restricted-v2 SCC). Standard OpenShift enforcement. |

## 6. Open questions

- Should the product collect secret values in the UI at all, or should users
  pre-provision Kubernetes Secrets and the catalog only reference them by name?
- Should Goose's developer extension (file/bash) be restricted to a sandboxed
  directory, or is host access acceptable for a single-user prototype?
- Should chat transcripts be persisted, and if so, how should they be protected?
- What vulnerability scanning should apply to images built via BuildConfig?

## 7. Provenance

- mode: bootstrap
- date: 2026-06-20
- source: Derived from specs/agent-catalog-prototype-spec.md, Sections 3.3
  (Secrets Handling), 4.1 (Architecture), 5.4 (Build Strategy)

## 8. Recommended mitigations

| Mitigation | Threat IDs | Effort | Status |
|---|---|---|---|
| Secret values never sent to Goose/LLM; collected via separate UI path | T1 | Done | implemented_in_spec |
| Recipe system prompt instructs AI to redirect secret entry to Env Vars tab | T1 | Done | implemented_in_spec |
| Backend holds secrets in memory only, never on disk, discards after K8s Secret creation | T7 | S | designed |
| Product: use etcd encryption or external secrets operator for K8s Secrets at rest | T3 | L | future |
| Product: integrate container image scanning (Quay, ACS) into build pipeline | T5 | M | future |
| Sanitize/validate harness definition fields before injecting into Goose recipe | T6 | S | future |
| Product: restrict Goose developer extension scope or sandbox file access | T2 | M | future |
