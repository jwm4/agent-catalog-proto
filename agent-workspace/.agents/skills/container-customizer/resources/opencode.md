# OpenCode Harness

## Base Image and Standard Setup

The container starts from UBI 10 minimal
(`registry.access.redhat.com/ubi10/ubi-minimal:latest`). The standard harness
setup installs:

- **Node.js** and **npm** (from UBI repos)
- **OpenCode** (opencode-ai npm package, v1.17.1)
- **git**, **curl**, **jq**, **tar**, **gzip**, **vim-minimal**

These are already in the Containerfile under "Harness setup." Do NOT install
them again.

## What Typically Needs Adding

- **Python runtime:** Use `addPackage("microdnf", ["python3.12", "python3.12-pip"])`.
- **Go, Rust, Java:** Use `addPackage("microdnf", [...])` or `addRunCommand(...)`.
- **Build tools:** make, cmake, gradle, maven as needed.
- **Linting and formatting:** eslint, prettier, ruff, golangci-lint as needed.
- **GitHub CLI (gh):** Not pre-installed. Use `addRunCommand(...)` to install
  if needed for PR workflows.
- **LLM provider credentials** (as secrets, see below).

## Container Environment

- **User:** Runs as non-root. OpenShift assigns a random UID with GID 0 via
  restricted-v2 SCC.
- **Workspace:** `/workspace` with a 1Gi persistent volume already configured.
  Do NOT add another volume at `/workspace`; it is pre-configured in the base
  setup. You can see it in the Volumes tab.
- **Entrypoint:** `/bin/bash` by default. User can customize.

## OpenCode Configuration File

OpenCode reads its configuration from a JSON file. In a container, the best
location is `/workspace/.opencode/config.json`. Use `addFile` to place it:

```
addFile("opencode-config.json", "/workspace/.opencode/config.json", "inline",
  JSON.stringify(configObject, null, 2))
```

Build up the config object throughout the conversation as the user makes
choices (provider, model, MCP servers, permissions, etc.), then write it as
a single file at the end.

The config file supports JSONC (comments allowed). All fields are optional.
Key top-level fields:

| Field | Purpose |
|-------|---------|
| `model` | Default model, format `provider/alias` (e.g., `anthropic/sonnet`) |
| `providers` | Custom or self-hosted provider definitions |
| `mcp` | MCP server configuration |
| `permissions` | Tool permission rules |
| `agents` | Per-agent overrides (model, system prompt, steps) |
| `instructions` | Paths to instruction files to load automatically |
| `shell` | Default shell (e.g., `bash`, `zsh`) |
| `snapshots` | Enable undo/revert snapshots (boolean) |

## LLM Provider Setup

OpenCode has built-in support for these well-known providers. For standard
providers, the user only needs to set the API key as an environment variable;
no config file entry is required.

### Anthropic

- `addSecret("ANTHROPIC_API_KEY", "Anthropic API key (starts with sk-ant-...)")`
- Set model in config: `{ "model": "anthropic/sonnet" }`
- Other model aliases: `opus`, `haiku`

### OpenAI

- `addSecret("OPENAI_API_KEY", "OpenAI API key")`
- Set model in config: `{ "model": "openai/gpt-4o" }`
- Other aliases: `o3`, `gpt-4.1`

### Google Vertex AI

- `addSecret("GOOGLE_APPLICATION_CREDENTIALS_JSON", "GCP service account key JSON")`
- Use `addFile` to place the key at `/var/secrets/google/key.json`
- `setEnvVar("GOOGLE_APPLICATION_CREDENTIALS", "/var/secrets/google/key.json")`
- Set model in config: `{ "model": "google-vertex/claude-sonnet" }`

The service account needs the Vertex AI User role in the GCP project.

### OpenRouter

- `addSecret("OPENROUTER_API_KEY", "OpenRouter API key")`
- Set model in config: `{ "model": "openrouter/anthropic/claude-sonnet" }`

OpenRouter provides access to many models through a single API.

### Custom / Self-Hosted (vLLM, OGX)

For users running their own model server on OpenShift, define a custom
provider in the config file:

```json
{
  "model": "my-vllm/my-model",
  "providers": {
    "my-vllm": {
      "name": "Self-hosted vLLM",
      "env": ["VLLM_API_KEY"],
      "api": {
        "type": "native",
        "url": "http://vllm-service.<namespace>.svc.cluster.local/v1",
        "settings": {}
      },
      "models": {
        "my-model": {
          "name": "Llama 3.1 70B",
          "limit": {
            "context": 32768,
            "output": 4096
          }
        }
      }
    }
  }
}
```

- Ask the user for the service URL and model name.
- Set `limit.context` and `limit.output` to match the served model's
  capabilities; this controls compaction and output budgets.
- **If the endpoint requires authentication:**
  `addSecret("VLLM_API_KEY", "Bearer token for the vLLM endpoint")` and
  include `"env": ["VLLM_API_KEY"]` in the provider definition as shown above.
- **If the endpoint has no authentication:** omit the `env` field from the
  provider definition entirely and do not register a secret.

For OGX (RHOAI model gateway in front of vLLM), the setup is the same but
the URL points to the OGX service and the model ID may be prefixed with the
backend name (e.g., `vllm/my-model`).

## Model Selection

Models are referenced as `provider/alias` strings. Use unpinned aliases
(e.g., `anthropic/sonnet`) rather than version-pinned IDs so the agent
automatically gets the latest version.

Set the default model in the config file:

```json
{ "model": "anthropic/sonnet" }
```

Override per-agent (e.g., use a cheaper model for subagents):

```json
{
  "model": "anthropic/sonnet",
  "agents": {
    "code": { "model": "anthropic/opus" }
  }
}
```

## MCP Server Configuration

OpenCode supports MCP (Model Context Protocol) servers to extend agent
capabilities. Configure them in the `mcp` section of the config file.

### Local MCP server (stdio transport)

```json
{
  "mcp": {
    "servers": {
      "filesystem": {
        "type": "local",
        "command": ["npx", "-y", "@modelcontextprotocol/server-filesystem", "/workspace"],
        "environment": { "DEBUG": "false" }
      }
    }
  }
}
```

The `command` field is an array (not a string). The server process runs as a
child of OpenCode and communicates via stdio.

### Remote MCP server (HTTP+SSE transport)

```json
{
  "mcp": {
    "servers": {
      "github": {
        "type": "remote",
        "url": "https://api.githubcopilot.com/mcp/",
        "headers": {
          "Authorization": "Bearer ${GITHUB_PAT}"
        }
      }
    }
  }
}
```

Token references like `${GITHUB_PAT}` are expanded from environment variables
at runtime, so register them as secrets.

### MCP server options

Both local and remote servers support:
- `disabled` (boolean): temporarily disable without removing
- `timeout` (integer, ms): per-server timeout override

Global MCP timeout: `{ "mcp": { "timeout": 30000 } }`

## Permissions

OpenCode's permission system controls which tools the agent can use without
asking. Configure in the `permissions` field as an array of rules:

```json
{
  "permissions": [
    { "action": "Bash", "resource": "npm install *", "effect": "allow" },
    { "action": "Bash", "resource": "git push *", "effect": "ask" },
    { "action": "Bash", "resource": "rm -rf *", "effect": "deny" },
    { "action": "Read", "resource": "/workspace/**", "effect": "allow" }
  ]
}
```

Each rule has:
- `action`: tool name (e.g., `Bash`, `Read`, `Write`)
- `resource`: glob pattern for the argument
- `effect`: `"allow"`, `"deny"`, or `"ask"`

For sandboxed containers where the agent runs non-interactively, a permissive
default is common:

```json
{
  "permissions": [
    { "action": "*", "resource": "*", "effect": "allow" }
  ]
}
```

Discuss the security tradeoff with the user: permissive permissions let the
agent work autonomously but mean it can make external calls (git push, API
requests) without confirmation.

## Git Credentials

If the user needs the agent to push code or create PRs:

- `addSecret("GITHUB_PAT", "GitHub Personal Access Token with repo scope")`
- `setEnvVar("GIT_USER_NAME", "<name>")` (ask the user what name to use)
- `setEnvVar("GIT_USER_EMAIL", "<email>")` (ask the user what email to use)

Ask the user for their preferred git user name and email before setting these.
Do not suggest or offer generic defaults. Wait for the user to provide their
actual name and email. Recommend scoping the PAT to specific repositories and
using the minimum required permissions.

## Persistence

Recommend adding a volume for the workspace so agent state survives pod
restarts:

- `addVolume("/workspace", "1Gi", "ReadWriteOnce")`

Session history, project context, and any cloned repositories persist here.
The `.opencode/` directory within the workspace stores conversation history
and session snapshots.

Note: ReadWriteOnce volumes require `Recreate` deployment strategy (not
rolling updates).

## RHOAI Integration Features

These are optional but available for users on Red Hat OpenShift AI.

### MLflow Tracing

MLflow captures traces of agent sessions (tool calls, token counts, latency)
for observability and debugging.

- `addPackage("pip", ["mlflow[kubernetes]==3.12.0"])`
- `setEnvVar("MLFLOW_TRACKING_URI", "https://mlflow.<rhoai-namespace>.svc:8443/mlflow")`
- `setEnvVar("MLFLOW_EXPERIMENT_NAME", "opencode-traces")`
- `setEnvVar("MLFLOW_TRACKING_AUTH", "kubernetes-namespaced")`

**Auto-discovering the tracking URI:** Run
`oc get svc mlflow -n redhat-ods-applications` from your shell tools to check
if the MLflow service exists. Do not ask the user to run this themselves. If
the command succeeds, construct the tracking URI as
`https://mlflow.redhat-ods-applications.svc:8443/mlflow` and configure it
automatically. If the command fails (not logged in, service not found), ask the
user for the tracking URI.

**RBAC setup:** The pod's service account needs the
`mlflow-operator-mlflow-integration` ClusterRole (shipped with RHOAI 3.4+ via
the MLflow operator). This role grants access scoped to `mlflow.kubeflow.org`
and `mlflow.opendatahub.io` API groups only, with no access to core Kubernetes
resources. Create a dedicated ServiceAccount and bind it via a
namespace-scoped RoleBinding. Do not recommend the `edit` ClusterRole, which
is overly permissive for this purpose.

### Model Serving with vLLM

Users can serve open-source models on OpenShift AI using vLLM and connect the
agent to them. This avoids sending data to external APIs. See the
"Custom / Self-Hosted" provider section above for config details.

Discuss with the user:
- What model they want to serve (and whether it fits their GPU resources)
- Context window and output token limits for their chosen model
- The tradeoff between model quality (Claude via API) and data locality
  (self-hosted via vLLM)

## Secrets Summary

Depending on the provider, these secrets are typically needed:

| Provider | Secret Name | Description |
|----------|-------------|-------------|
| Anthropic | `ANTHROPIC_API_KEY` | API key from Anthropic |
| OpenAI | `OPENAI_API_KEY` | API key from OpenAI |
| OpenRouter | `OPENROUTER_API_KEY` | API key from OpenRouter |
| Vertex AI | `GOOGLE_APPLICATION_CREDENTIALS_JSON` | GCP service account key |
| Custom/vLLM | (user-defined) | Bearer token for endpoint (skip if no auth) |
| Git | `GITHUB_PAT` | GitHub Personal Access Token |

Always register secrets with `addSecret(name, description)`. Direct the user
to enter the actual values in the **Configuration tab** on the right side of the
screen.

## Example Complete Config

Here is a full example for Anthropic with a GitHub MCP server:

```json
{
  "model": "anthropic/sonnet",
  "mcp": {
    "servers": {
      "github": {
        "type": "remote",
        "url": "https://api.githubcopilot.com/mcp/",
        "headers": {
          "Authorization": "Bearer ${GITHUB_PAT}"
        }
      }
    }
  },
  "permissions": [
    { "action": "Bash", "resource": "npm *", "effect": "allow" },
    { "action": "Bash", "resource": "git *", "effect": "allow" },
    { "action": "Read", "resource": "/workspace/**", "effect": "allow" },
    { "action": "Write", "resource": "/workspace/**", "effect": "allow" }
  ],
  "snapshots": true
}
```
