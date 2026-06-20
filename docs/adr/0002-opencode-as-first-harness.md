# 2. OpenCode as First Harness to Implement

Date: 2026-06-18
Updated: 2026-06-20

## Status

Accepted

## Context

The Agent Catalog supports four harnesses: Claude Code, OpenCode, OpenClaw, and
Codex. We needed to choose which to implement first to get an end-to-end demo
working as quickly as possible.

Key factors:

- Claude Code has no redistributable base image due to Anthropic licensing.
- OpenClaw requires plugin configuration and SQLite (block storage dependency).
- Codex deployment patterns are not yet established.
- OpenCode is MIT-licensed, has a mature npm package, and a straightforward
  install via `npm install -g opencode-ai`.

All harnesses now build from UBI 10 minimal
(`registry.access.redhat.com/ubi10/ubi-minimal:latest`) and install the agent
during the container build. There are no pre-built agent-specific base images.
See the `setupCommands` field in `ContainerSpec` for the harness-defined install
commands.

## Decision

Start with OpenCode. It is open source (MIT), has no license complications, and
the AI Platform CC team has established deployment patterns for it. The
customization conversation covers language runtimes, build tools, LLM provider
credentials, and project-specific configuration.

## Consequences

**Positive:**
- Fastest path to a working end-to-end demo.
- MIT license, no redistribution complications.
- Well-understood deployment patterns from the agentic-starter-kits project.
- Same UBI-based build approach as all other harnesses, so patterns transfer.

**Negative:**
- OpenCode upstream has been archived and renamed to Crush. Existing releases
  remain functional.
