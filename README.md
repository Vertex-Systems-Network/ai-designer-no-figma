# AI Designer No Figma

Generate and edit native, editable Figma layers with the AI app you already use. The default workflow needs no provider API, key, Ollama install, Figma AI credits, or Figma MCP: prepare a structured prompt, send it yourself to Claude Desktop or another assistant, then paste its JSON answer back for validation and insertion. Optional local Ollama inference is also available.

## Current release

- Public repository: [Vertex-Systems-Network/ai-designer-no-figma](https://github.com/Vertex-Systems-Network/ai-designer-no-figma)
- Download: [AI Designer No Figma 0.1.0 ZIP](artifacts/ai-designer-no-figma-0.1.0.zip)
- Open work: [GitHub Issues](https://github.com/Vertex-Systems-Network/ai-designer-no-figma/issues) and [engineering backlog](docs/BACKLOG.md)

## Requirements

- Node.js 20+ and npm to build/package the plugin.
- Figma Desktop or web editor to run the development plugin.
- Any AI assistant is optional and user-operated. No provider credentials are required by this project.
- Ollama and the companion service are optional alternatives, not required for generation, editing, import, or rendering.

## Build and install

```sh
npm install
npm run verify
```

In Figma, open **Plugins → Development → Import plugin from manifest…** and select `dist/manifest.json`. The development manifest intentionally has no invented plugin ID; Figma supplies the ID when the plugin is registered for distribution.

## Use any AI app without an API

1. Keep **AI workflow → Use any AI app · no API key** selected.
2. Enter the design brief and choose the design settings, then select **Prepare prompt for AI app**.
3. Copy the prompt to Claude Desktop or another AI app you already use. Ask it to return the requested JSON.
4. Paste the answer into **Import**, select **Validate specification**, review the result, then insert it into Figma.

The Edit tab follows the same handoff for selection-aware patch JSON. The plugin sends nothing to an AI app; copying and pasting are user-controlled. It accepts a JSON code fence but validates every layer and edit operation before Figma mutation.

## Optional local Ollama

Choose **Optional local Ollama model** in Generate/Edit, start the companion with `npm run runtime`, and use an installed model. The service binds to loopback and only contacts local Ollama. Manual import and external handoff continue working if the service or model is unavailable.

## Privacy and verification limits

There is no telemetry or required paid API. Any external AI app is operated separately by the user under that app's own account and data policies. Prompt history and tokens are stored in the plugin's local browser storage. The plugin host alone creates Figma document nodes.

Typecheck, lint, unit/integration tests, dependency audit, local security checks, build, and ZIP packaging are automated. Real Figma editor rendering and UI screenshot review must be recorded separately; automated tests are not evidence of a live Figma session. See [`docs/BACKLOG.md`](docs/BACKLOG.md) for current gates.
