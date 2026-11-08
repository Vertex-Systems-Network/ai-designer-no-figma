# System architecture

## Current implemented flows

1. User describes a design in the plugin or imports JSON.
2. The UI can prepare a provider-neutral prompt; the user chooses whether to copy it to an AI application.
3. `src/shared/spec.ts` validates imported or generated data against schema 1.0 and resource limits.
4. Typed messages cross the UI/host boundary through `src/shared/protocol.ts`.
5. `src/plugin/code.ts` creates or edits native Figma nodes through the Plugin API.
6. Optional Ollama requests go from UI to the loopback companion service, which calls only a loopback Ollama endpoint.
7. Manual asset import accepts pasted SVG or a local PNG/JPEG/GIF file; shared validators run before the plugin host creates an SVG node or raster image fill.
8. Optional custom MCP asset tools validate caller-supplied vector/image data, then send bounded commands over the authenticated loopback bridge to the same plugin host adapter.

## Target extension boundaries

`MCP client → custom stdio MCP server → authenticated local job bridge → bounded command queue → Figma plugin session → Figma Plugin API`

The custom MCP server must not depend on undocumented Figma endpoints or the official Figma MCP. The bridge transports commands/results only; the plugin remains the sole document mutation authority. The universal design schema, MCP tool contracts, and Figma adapter each receive separate versions.

The custom MCP and bridge path is implemented and automated-tested, but live Figma pairing remains unverified. Client generation/file access is not inferred. The standalone asset path is separate from the JSON design schema. MCP raster transfer supports up to 5 MiB in checksum-verified chunks; the paired bridge stores local source bytes in a private content-addressed file because Figma blocks browser and plugin storage in this development context. Replacement/crop operations and live post-insert verification remain open.

## Safety boundaries

- AI responses are data, never executable code.
- Validation precedes document mutation.
- Edit operations target IDs in the current bounded selection and capture rollback state.
- Local runtimes bind to loopback; requests have size/time bounds.
- Stdio MCP stdout is reserved for protocol frames; logs go to stderr.

See [data flow](architecture/DATA-FLOW.md), [module dependencies](architecture/MODULE-DEPENDENCIES.md), and [security](SECURITY-ARCHITECTURE.md).
