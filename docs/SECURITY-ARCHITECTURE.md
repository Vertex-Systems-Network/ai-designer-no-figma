# Security architecture

## Current controls

- JSON specs are size/depth/node bounded and schema validated before renderer mutation.
- Patch operations are limited to explicit operations and selected logical IDs.
- The optional runtime binds to loopback, checks browser origins, limits bodies and only contacts loopback Ollama.
- Build audit checks no paid AI SDK requirement, no remote UI assets, loopback runtime and no Git invocation in build/package scripts.

## New MCP/bridge requirements

- MCP stdio stdout must contain protocol frames only; log to stderr.
- The local bridge must bind to loopback, require a pairing/session secret for commands, validate Origin when present, reject oversized and malformed payloads, and enforce command timeouts.
- Pairing credentials must not be embedded in client bundles or printed to ordinary protocol output. Store local secrets with restrictive filesystem permissions; use constant-time comparison where practical.
- Correlate each command with a unique operation ID and session ID. Reject replay/duplicate execution, bound queue length, and scope edits to the connected plugin's selected document/nodes.
- Destructive node deletion/replacement must require explicit preview/confirmation in the plugin. Never silently apply arbitrary MCP requests.
- Model output remains inert JSON. No shell, eval, dynamic import or remote script execution.

## Threat model gaps

MCP/bridge pairing and cross-session isolation are not implemented yet. Do not expose MCP mutation tools until these controls and tests exist. Loopback alone is not authentication.
