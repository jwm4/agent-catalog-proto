# Self-Hosted Model Reference

Use this guide when the user wants to connect their agent to a self-hosted
model (vLLM, OGX, or any OpenAI-compatible endpoint) instead of a cloud API.

## Tested Models

These models have been validated with agentic coding workloads. The names below
are registry identifiers (org/model format). The actual model ID served by vLLM
may differ depending on how the admin configured `--served-model-name`. Always
query `{base_url}/v1/models` to get the exact served model ID rather than using
these names directly.

| Model (registry name) | Size | Context | Notes |
|-----------------------|------|---------|-------|
| openai/gpt-oss-120b | 120B | 131K | Well-tested, strong tool use |
| RedHatAI/Qwen3.6-35B-A3B-NVFP4 | 35B (quantized) | 131K | Good balance of quality and resources |
| Qwen/Qwen3-235B-A22B | 235B (MoE) | 131K | Large capacity |
| ibm-granite/granite-4.1-8b-instruct | 8B | 524K | Extended context, smaller model |
| meta-llama/Llama-4-Maverick-17B-128E | 17B (MoE) | 1M+ | Massive context window |
| openai/gpt-oss-20b | 20B | up to 128K | Fits on smaller GPUs |
| meta-llama/Llama-3.1-8B-Instruct | 8B | 128K | Small, fast, good for testing |

## Quality Considerations

Self-hosted models keep data on the cluster and avoid external API
dependencies. Larger open source models (70B+) handle agentic coding tasks
well, especially with sufficient context window. Smaller models may need more
guidance and produce less reliable results for complex multi-step tasks.
Recommend including language runtimes and test frameworks in the container so
the agent can run tests and validate its own work regardless of model size.

## Context Window Configuration

**Auto-discover when possible.** Query the model endpoint directly to find the
served model ID and configured context window:

```bash
curl -s {base_url}/v1/models | jq '.data[0] | {id, max_model_len}'
```

Run this from your shell tools using the endpoint URL the user provided. Do not
ask the user to run curl themselves. Use the returned `id` as the model ID in
configuration (it may differ from the registry name in the table above). Use
`max_model_len` as the context window. If the request fails (e.g., network
error, endpoint not reachable from your host), fall back to asking the user for
the model ID and context window.

The context values in the table above are theoretical maximums. The actual
context window depends on GPU memory and how vLLM is launched (the
`--max-model-len` flag). Do not assume a value.

**Why this matters:** The system prompt alone uses ~23K tokens. A 32K context
leaves almost no room for conversation, file contents, or tool results. The
agent will autocompact constantly and lose track of context. 32K is a last
resort, not a reasonable default.

**Recommend 128K** as the target. If the user's setup supports it, use 128K
settings. If the discovered context window is small (e.g., 32K), explain
that the agent will struggle with multi-turn coding tasks and suggest
options in this order:
1. The cluster admin can redeploy this model with a larger `--max-model-len`
   if the GPU has enough memory
2. A different self-hosted model with a larger context window may be
   available on the cluster
3. Cloud API providers (Anthropic, OpenAI) offer 200K+ context as a
   fallback if no self-hosted option works

### Configuration (Claude Code harness)

Three environment variables control context window behavior:

| Variable | Purpose | Example |
|----------|---------|---------|
| `CLAUDE_CODE_AUTO_COMPACT_WINDOW` | Model's total context in tokens | `131072` |
| `CLAUDE_CODE_MAX_OUTPUT_TOKENS` | Output token budget | `28000` |
| `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` | Autocompaction threshold (%) | `75` |

Do NOT pre-subtract output tokens from the context window value.

**Recommended settings by context size:**

| Context | AUTO_COMPACT_WINDOW | MAX_OUTPUT_TOKENS | AUTOCOMPACT_PCT |
|---------|--------------------|--------------------|-----------------|
| 32K | 32768 | 4000 | 85 |
| 131K | 131072 | 28000 | 75 |
| 524K | 524288 | 64000 | 83 |
| 1M+ | 1048576 | 64000 | 83 |

### Configuration (OpenCode harness)

Set context limits in the OpenCode config file under the model definition:

```json
{
  "provider": {
    "my-vllm": {
      "models": {
        "my-model": {
          "limit": {
            "context": 131072,
            "output": 28000
          }
        }
      }
    }
  }
}
```

## Model Alias Mapping (Claude Code harness)

Claude Code uses internal aliases (haiku, sonnet, opus) that must map to actual
models on vLLM/OGX. Without these overrides, Claude Code sends requests for
model names like `claude-haiku-4-5-20251001` which return 404 errors.

Set all three aliases to the served model ID:

- `setEnvVar("ANTHROPIC_DEFAULT_HAIKU_MODEL", "<model-id>")`
- `setEnvVar("ANTHROPIC_DEFAULT_SONNET_MODEL", "<model-id>")`
- `setEnvVar("ANTHROPIC_DEFAULT_OPUS_MODEL", "<model-id>")`

Use the exact model ID from `/v1/models` (e.g., `gpt-oss-120b`).
For OGX, prefix with `vllm/` (e.g., `vllm/gpt-oss-120b`).

## Authentication

Authentication setup depends on the harness.

### Claude Code harness

Use `ANTHROPIC_AUTH_TOKEN` (not `ANTHROPIC_API_KEY`) for self-hosted endpoints.
The auth token skips interactive key confirmation prompts that would hang in a
container.

- `addSecret("ANTHROPIC_AUTH_TOKEN", "Bearer token for the model endpoint")`
- `setEnvVar("ANTHROPIC_BASE_URL", "<endpoint-url>")`

If the endpoint has no authentication, set the token to `fake`. Claude Code
requires this variable to be set or it will prompt interactively, which hangs
in a container.

### OpenCode harness

If the endpoint requires authentication, register a secret and reference it in
the provider config's `env` field:

- `addSecret("VLLM_API_KEY", "Bearer token for the model endpoint")`
- Include `"env": ["VLLM_API_KEY"]` in the provider definition

If the endpoint has no authentication, skip the secret entirely and omit the
`env` field from the provider config. No placeholder value is needed.

## Endpoint URL Formats

Ask the user for their endpoint URL. Common patterns:

- **Cluster-internal service:** `http://model-name.namespace.svc.cluster.local:8000`
- **External route (HTTPS):** `https://vllm-route.apps.cluster.example.com`
- **OGX gateway:** `http://ogx-service.namespace.svc.cluster.local:8321` (port 8321)

If the user provides a hostname without a scheme, prepend `https://`. If it
looks like a Kubernetes service name, help them construct the full internal URL.

## vLLM vs OGX

**vLLM direct** is simpler: the agent connects straight to the vLLM server.

**OGX** (Open Gateway for AI) is a Red Hat gateway that sits in front of vLLM
and provides API translation, token counting, rate limiting, and model routing.
Benefits:
- Translates between OpenAI and Anthropic API formats automatically
- Token counting and usage tracking
- Can route to multiple backend models

When using OGX, the model ID must be prefixed with the provider name
(e.g., `vllm/openai/gpt-oss-120b` instead of `openai/gpt-oss-120b`).

OGX configuration is deployed separately by the cluster administrator. If the
user does not have an OGX endpoint, recommend connecting directly to vLLM.

## Choosing a Model

Self-hosted models are the preferred path for Red Hat OpenShift AI. They keep
data on-cluster, avoid external API costs, and work in air-gapped
environments. Cloud API providers are a valid alternative, not the default
recommendation.

When the user is unsure which model to use, ask about:

1. **What models are already deployed** on their cluster (start here)
2. **Context window needs** (large codebases need more context)
3. **Quality vs speed tradeoff** (larger models are better but slower)

For self-hosted, larger models generally produce better agentic coding
results. If the user's cluster does not have a suitable model deployed,
suggest they work with their cluster admin to serve one, or consider a
cloud API provider as a fallback.

## Common Issues

**404 "Model not found":** Model alias mismatch. Ensure all
`ANTHROPIC_DEFAULT_*_MODEL` vars match the exact model ID served by vLLM.
For OGX, remember to add the `vllm/` prefix.

**"max_tokens must be at least 1, got negative number":** Context window too
small for the system prompt plus output tokens. Set the context window
environment variables from the table above.

**Connection timeout:** Ask the user to verify the endpoint URL is reachable
from within the cluster. Suggest running `curl <url>/health` from a pod in the
same namespace.

**API key confirmation hangs:** Using `ANTHROPIC_API_KEY` instead of
`ANTHROPIC_AUTH_TOKEN`. Switch to auth token for self-hosted endpoints.
