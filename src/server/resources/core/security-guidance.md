# Security Guidance

<!-- TODO: Flesh out with detailed security discussion framework -->

Use this framework during Phase 3 (Review and Secure) of the conversation.

## Container Security Posture

The generated container runs with:
- Non-root user (OpenShift restricted-v2 SCC)
- Dropped capabilities (ALL)
- Seccomp RuntimeDefault profile

## Common Tradeoffs to Discuss

- **Network access:** The agent needs internet for git, package installs, and
  API calls, but unrestricted egress is a risk.
- **File system access:** Persistent volumes let the agent store work, but it
  can write anywhere in the PVC.
- **API key scope:** Recommend scoped, limited API keys. Discuss rotation.
- **Git credentials:** PATs vs. deploy keys. Scope to specific repos when
  possible.
- **Agent autonomy:** Some agents can run arbitrary commands. Discuss the risk
  and when it is appropriate.
