# System architecture

## Current implemented flow

1. User describes a design in the plugin or imports JSON.
2. The UI can prepare a provider-neutral prompt; the user chooses whether to copy it to an AI application.
3. `src/shared/spec.ts` validates imported or generated data against schema 1.0 and resource limits.
4. Typed messages cross the UI/host boundary through `src/shared/protocol.ts`.
5. `src/plugin/code.ts` creates or edits native Figma nodes through the Plugin API.
6. Optional Ollama requests go from UI to the loopback companion service, which calls only a loopback Ollama endpoint.

## Target extension boundaries

`MCP client → custom stdio MCP server → authenticated local job bridge → bounded command queue → Figma plugin session → Figma Plugin API`

The custom MCP server must not depend on undocumented Figma endpoints or the official Figma MCP. The bridge transports commands/results only; the plugin remains the sole document mutation authority. The universal design schema, MCP tool contracts, and Figma adapter each receive separate versions.

The target path is not yet implemented end-to-end. Current status is tracked under MCP/bridge feature IDs in the registry. Do not expose nonfunctional Figma mutation tools.

## Safety boundaries

- AI responses are data, never executable code.
- Validation precedes document mutation.
- Edit operations target IDs in the current bounded selection and capture rollback state.
- Local runtimes bind to loopback; requests have size/time bounds.
- Stdio MCP stdout is reserved for protocol frames; logs go to stderr.

See [data flow](architecture/DATA-FLOW.md), [module dependencies](architecture/MODULE-DEPENDENCIES.md), and [security](SECURITY-ARCHITECTURE.md).
