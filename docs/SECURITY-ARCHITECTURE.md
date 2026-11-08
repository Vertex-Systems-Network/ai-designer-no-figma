# Security architecture

## Current controls

- JSON specs are size/depth/node bounded and schema validated before renderer mutation.
- Patch operations are limited to explicit operations and selected logical IDs.
- The optional runtime binds to loopback, checks browser origins, limits bodies and only contacts loopback Ollama.
- Build audit checks no paid AI SDK requirement, no remote UI assets, loopback runtime and no Git invocation in build/package scripts.

## MCP/bridge controls

- MCP stdio stdout must contain protocol frames only; log to stderr.
- The local bridge must bind to loopback, require a pairing/session secret for commands, validate Origin when present, reject oversized and malformed payloads, and enforce command timeouts.
- Pairing credentials must not be embedded in client bundles or printed to ordinary protocol output. Store local secrets with restrictive filesystem permissions; use constant-time comparison where practical.
- Correlate each command with a unique operation ID and session ID. Reject replay/duplicate execution, bound queue length, and scope edits to the connected plugin's selected document/nodes.
- Keep HTTP polling in the plugin UI iframe; the JSVM host receives typed messages and validates/executes only the supported Figma operations. Never move `fetch`, URL parsing, or browser timeout APIs into the host runtime.
- Request the `currentuser` permission only to display the active Figma operator; do not export profile data to the local bridge.
- Destructive node deletion/replacement must require explicit preview/confirmation in the plugin. Never silently apply arbitrary MCP requests.
- Model output remains inert JSON. No shell, eval, dynamic import or remote script execution.

## Threat model gaps

Hidden-panel operation and user identity have automated compatibility checks but still need a live Figma test. Loopback pairing is not a general remote agent service, and closing the Figma app or current document stops the plugin session. Loopback alone is not authentication.
