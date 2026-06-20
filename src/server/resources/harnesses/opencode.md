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
- **GitHub CLI (gh):** Not pre-installed. Use `addRunCommand(...)` to install if needed for PR workflows.
- **LLM provider credentials** (as secrets, see below).
- **MCP server configuration** (if extending agent capabilities).

## Container Environment

- **User:** Runs as non-root. OpenShift assigns a random UID with GID 0 via
  restricted-v2 SCC.
- **Workspace:** `/workspace` (mount a PVC here for persistence)
- **Entrypoint:** `/bin/bash` by default. User can customize.

## LLM Provider Configuration

Ask the user which LLM provider they want to use. OpenCode supports multiple
providers. Register the appropriate secrets and environment variables.

### Anthropic (direct API)

- `addSecret("ANTHROPIC_API_KEY", "Anthropic API key (starts with sk-ant-...)")` (secret)
- Optionally set model: `setEnvVar("OPENCODE_MODEL", "claude-sonnet-4-5-20250929")`

### Google Vertex AI

- `addSecret("GOOGLE_APPLICATION_CREDENTIALS_JSON", "GCP service account key JSON content")` (secret)
- `setEnvVar("CLAUDE_CODE_USE_VERTEX", "1")`
- `setEnvVar("ANTHROPIC_VERTEX_PROJECT_ID", "<user's GCP project ID>")`
- `setEnvVar("CLOUD_ML_REGION", "us-east5")` (or the user's preferred region)
- The service account JSON should be written to a file and the path set in
  `GOOGLE_APPLICATION_CREDENTIALS`. Use `addFile` to place it at
  `/var/secrets/google/key.json`.

### vLLM (self-hosted, direct connection)

For users running their own model server on OpenShift:

- `setEnvVar("ANTHROPIC_BASE_URL", "http://vllm-service.<namespace>.svc.cluster.local")`
- `addSecret("ANTHROPIC_AUTH_TOKEN", "Bearer token for vLLM endpoint (can be a placeholder if no auth)")` (secret)
- `setEnvVar("CLAUDE_MODEL", "<model-name>")` (e.g., the model ID served by vLLM)

Note: Use `ANTHROPIC_AUTH_TOKEN` instead of `ANTHROPIC_API_KEY` to avoid
interactive key confirmation prompts.

Recommend setting context window parameters if the model has a smaller context
than Claude:
- `setEnvVar("CLAUDE_CODE_AUTO_COMPACT_WINDOW", "32768")` (model's context window in tokens)
- `setEnvVar("CLAUDE_CODE_MAX_OUTPUT_TOKENS", "4000")` (output token budget)

### OGX Gateway (RHOAI model gateway to vLLM)

OGX is a Red Hat OpenShift AI gateway that provides an Anthropic-compatible API
in front of vLLM-served models. Benefits: token counting, rate limiting, model
routing.

- `setEnvVar("ANTHROPIC_BASE_URL", "http://ogx-service.<namespace>.svc.cluster.local")`
- `addSecret("ANTHROPIC_AUTH_TOKEN", "Bearer token for OGX endpoint")` (secret)
- `setEnvVar("CLAUDE_MODEL", "vllm/<model-name>")` (OGX prefixes model names with the backend)

OGX configuration is deployed separately. Point the user to their cluster
administrator if OGX is not yet available.

## RHOAI Integration Features

These are optional but available for users on Red Hat OpenShift AI.

### MLflow Tracing

MLflow captures traces of agent sessions (tool calls, token counts, latency)
for observability and debugging.

- `addPackage("pip", ["mlflow[kubernetes]==3.12.0"])` to install MLflow with
  the Kubernetes namespaced auth plugin.
- `setEnvVar("MLFLOW_TRACKING_URI", "https://mlflow.<rhoai-namespace>.svc:8443/mlflow")`
- `setEnvVar("MLFLOW_EXPERIMENT_NAME", "opencode-traces")` (default experiment name)
- `setEnvVar("MLFLOW_TRACKING_AUTH", "kubernetes-namespaced")`

Note: MLflow 3.12 is the recommended version. Later versions may change the
auth plugin interface. The pod's service account needs `edit` role in its
namespace for Kubernetes-namespaced auth.

### Model Serving with vLLM

Users can serve open-source models on OpenShift AI using vLLM and connect the
agent to them. This avoids sending data to external APIs.

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
| Vertex AI | `GOOGLE_APPLICATION_CREDENTIALS_JSON` | GCP service account key |
| vLLM | `ANTHROPIC_AUTH_TOKEN` | Bearer token for vLLM endpoint |
| OGX | `ANTHROPIC_AUTH_TOKEN` | Bearer token for OGX gateway |
| Git | `GITHUB_PAT` | GitHub Personal Access Token for push/PR access |

Always register secrets with `addSecret(name, description)`. Direct the user
to enter the actual values in the **Env Vars tab** on the right side of the
screen.

## Git Credentials

If the user needs the agent to push code or create PRs:

- `addSecret("GITHUB_PAT", "GitHub Personal Access Token with repo scope")`
- `setEnvVar("GIT_USER_NAME", "opencode-agent")` (or the user's preferred name)
- `setEnvVar("GIT_USER_EMAIL", "opencode-agent@noreply.github.com")`

Recommend scoping the PAT to specific repositories and using the minimum
required permissions. Discuss the risks of giving an AI agent push access.

## MCP Server Configuration

OpenCode supports MCP (Model Context Protocol) servers to extend its
capabilities. Configure via environment variable:

- `setEnvVar("MCP_CONFIG_JSON", "<JSON string>")` for inline config, or
- Use `addFile` to place a config file and set `setEnvVar("MCP_CONFIG_FILE", "/path/to/config.json")`

Example MCP config for a GitHub MCP server:
```json
{
  "mcpServers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": {
        "Authorization": "Bearer ${GITHUB_PAT}"
      }
    }
  }
}
```

MCP credentials (like `${GITHUB_PAT}`) are expanded at runtime from container
environment variables, so register them as secrets.

## Persistence

Recommend adding a volume for the workspace so agent state survives pod
restarts:

- `addVolume("/workspace", "1Gi", "ReadWriteOnce")`

Session history, project context, and any cloned repositories persist here.
Note: ReadWriteOnce volumes require `Recreate` deployment strategy (not
rolling updates).

## Security Considerations Specific to OpenCode

- The container runs as non-root (UID 1001) with all capabilities dropped and
  RuntimeDefault seccomp profile. This is enforced by OpenShift restricted-v2
  SCC.
- The OpenShell base image includes Landlock-based filesystem restrictions. The
  agent can only write to `/sandbox`, `/workspace`, and `/tmp`.
- If the user sets `SKIP_PERMISSIONS=true`, OpenCode can run commands without
  confirmation prompts. This is convenient in a sandboxed container but means
  the agent can make external calls (git push, API requests) without asking.
  Discuss the tradeoff.
- Agent credentials (API keys, PATs) are visible as environment variables
  inside the container. The agent could potentially expose them in conversation
  output. Recommend limited-scope credentials and credential rotation.
