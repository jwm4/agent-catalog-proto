# 2. OpenCode as First Harness to Implement

Date: 2026-06-18

## Status

Accepted

## Context

The Agent Catalog supports four harnesses: Claude Code, OpenCode, OpenClaw, and
Codex. We needed to choose which to implement first to get an end-to-end demo
working as quickly as possible.

Key factors:

- Claude Code has no redistributable base image due to Anthropic licensing. The
  Containerfile must install it at build time.
- OpenCode has a public base image
  (`quay.io/aipcc/agentic-ci/opencode-runner:latest`, ~223MB) maintained by the
  AI Platform CC team, with the agent pre-installed.
- OpenClaw requires plugin configuration and SQLite (block storage dependency).
- Codex deployment patterns are not yet established.

## Decision

Start with OpenCode. The base image already exists, is public, and includes the
agent binary plus dev tooling (gh CLI, glab, shellcheck, uv, git). The
customization conversation focuses on adding language runtimes, build tools, and
project-specific configuration rather than installing the agent itself.

## Consequences

**Positive:**
- Fastest path to a working end-to-end demo.
- Simpler customization flow (agent already installed).
- MIT license, no redistribution complications.
- Non-root user (`agent-ci`), OpenShift `restricted-v2` compatible.

**Negative:**
- OpenCode upstream has been archived and renamed to Crush. Existing releases
  remain functional.
- The `opencode-runner` image is CI-oriented and will be replaced by a more
  official RHOAI-hosted image later.
