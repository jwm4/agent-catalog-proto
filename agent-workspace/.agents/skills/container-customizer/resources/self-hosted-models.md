# Self-Hosted Model Reference

Use this guide when the user wants to connect their agent to a self-hosted
model (vLLM, OGX, or any OpenAI-compatible endpoint) instead of a cloud API.

## Tested Models

These models have been validated with agentic coding workloads:

| Model | Size | Context | GPU Requirements | Notes |
|-------|------|---------|-----------------|-------|
| openai/gpt-oss-120b | 120B | 131K | 4x GPU (e.g., A100) | Well-tested, strong tool use |
| RedHatAI/Qwen3.6-35B-A3B-NVFP4 | 35B (quantized) | 131K | 1x GPU | Good balance of quality and resources |
| Qwen/Qwen3-235B-A22B | 235B (MoE) | 131K | Multi-GPU | Large capacity |
| ibm-granite/granite-4.1-8b-instruct | 8B | 524K | 1x GPU | Extended context, smaller model |
| meta-llama/Llama-4-Maverick-17B-128E | 17B (MoE) | 1M+ | Multi-GPU | Massive context window |
| openai/gpt-oss-20b | 20B | up to 128K | 1x L4 (23GB VRAM) | Fits on smaller GPUs; context depends on GPU memory and vLLM config |
| meta-llama/Llama-3.1-8B-Instruct | 8B | 128K | 1x GPU | Small, fast, good for testing |

## Quality Warning

Agentic coding tools are optimized for frontier models (Claude, GPT-4). Open
source models may produce lower quality results, particularly for complex
multi-step tasks, tool use chains, and large codebases. Recommend including
language runtimes and test frameworks in the container so the agent can run
tests and catch its own mistakes.

## Context Window Configuration

**Always ask the user what context window their model is configured with.**
The context window depends on how vLLM is launched (the `--max-model-len`
flag), not just the model's theoretical maximum. Do not assume a value.

**Why this matters:** The system prompt alone uses ~23K tokens. A 32K context
leaves almost no room for conversation, file contents, or tool results. The
agent will autocompact constantly and lose track of context. 32K is a last
resort, not a reasonable default.

**Recommend 128K** as the target. If the user's setup supports it, use 128K
settings. If they are constrained to 32K, warn them that the agent will
struggle with multi-turn coding tasks and suggest they consider a larger
context window or a cloud API provider instead.

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
  "providers": {
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

**vLLM direct:** Use bare model ID, e.g., `openai/gpt-oss-120b`
**OGX gateway:** Use prefixed format, e.g., `vllm/openai/gpt-oss-120b`

## Authentication

Use `ANTHROPIC_AUTH_TOKEN` (not `ANTHROPIC_API_KEY`) for self-hosted endpoints.
The auth token skips interactive key confirmation prompts that would hang in a
container. If the endpoint has no authentication, set the token to `fake`.

- `addSecret("ANTHROPIC_AUTH_TOKEN", "Bearer token for the model endpoint (use 'fake' if no auth required)")`
- `setEnvVar("ANTHROPIC_BASE_URL", "<endpoint-url>")`

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

When the user is unsure which model to use, ask about:

1. **GPU resources available** (number and type of GPUs)
2. **Quality vs speed tradeoff** (larger models are better but slower)
3. **Context window needs** (large codebases need more context)

**Recommendations:**
- **Limited GPUs (1x consumer/L4):** 8B or 20B models
- **Moderate GPUs (1-2x A100):** 35B quantized models (e.g., Qwen3.6-35B)
- **Strong GPUs (4x A100+):** 120B+ models for best quality
- **Priority is quality:** Recommend Anthropic API instead of self-hosted

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
