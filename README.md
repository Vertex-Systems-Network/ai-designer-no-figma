# AI Designer No Figma

Generate and edit native, editable Figma layers with the AI app you already use. The default workflow needs no provider API, key, Ollama install, Figma AI credits, or Figma MCP: prepare a structured prompt, send it yourself to Claude Desktop or another assistant, then paste its JSON answer back for validation and insertion. Optional local Ollama inference is also available.

## Current release

- Public repository: [Vertex-Systems-Network/ai-designer-no-figma](https://github.com/Vertex-Systems-Network/ai-designer-no-figma)
- Download: [AI Designer No Figma 0.1.0 ZIP](artifacts/ai-designer-no-figma-0.1.0.zip)
- Open work: [GitHub Issues](https://github.com/Vertex-Systems-Network/ai-designer-no-figma/issues) and [engineering backlog](docs/BACKLOG.md)

## Project progress

| Phase | Progress | Status | Remaining gate |
|---|---:|---|---|
| 0 · Environment audit | `████████████████████` 100% | PASS | — |
| 1 · Engineering foundation | `████████████████████` 100% | PASS | — |
| 2 · Figma plugin and renderer | `███████████░░░░░░░░░` 55% | IN PROGRESS | Live Figma editor test; broader native node support |
| 3 · Specification and validation | `███████░░░░░░░░░░░░░` 35% | IN PROGRESS | Images, vectors, gradients, components, styles, variables |
| 4 · AI integration | `█████████████░░░░░░░` 65% | IN PROGRESS | Direct desktop bridges and live local-model checks |
| 5 · Selection editing | `███████████░░░░░░░░░` 55% | IN PROGRESS | Layout edits, revision checkpoints, live preservation test |
| 6 · Design system | `██████░░░░░░░░░░░░░░` 30% | IN PROGRESS | Typography/spacing scales and native reusable components |
| 7 · Application UI | `████████████░░░░░░░░` 60% | IN PROGRESS | Complete controls and visual/accessibility QA |
| 8 · Testing and hardening | `█████████████░░░░░░░` 65% | IN PROGRESS | Live Figma test, UI review, broader feature coverage |
| 9 · Build and packaging | `████████████████████` 100% | PASS | — |
| 10 · Final audit | `███████░░░░░░░░░░░░░` 35% | IN PROGRESS | Close open gates and publish final evidence report |

Progress percentages estimate completed acceptance scope for each phase; they are not schedule estimates. A phase reaches 100% only when its acceptance gate is verified. See [the backlog](docs/BACKLOG.md) for evidence and [open issues](https://github.com/Vertex-Systems-Network/ai-designer-no-figma/issues) for tracked work.

## Current task tracker

| Task | Status | Evidence / next step |
|---|---|---|
| VSN-branded startup loader | PASS · LIVE VERIFIED | User confirmed the re-imported plugin works in Figma. |
| Workspace reveal and interface transitions | PASS · LIVE VERIFIED | User confirmed the plugin works after the loader; reduced-motion preferences are respected. |
| Live Figma verification of this update | PASS | User confirmed the current build is working. Broader UI and renderer gates remain open. |

This tracker records implementation evidence separately from live Figma verification. Update it alongside each task change; do not mark a live check complete from a local build alone.

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

The manifest allowlists `http://localhost:8787`, which Figma accepts for local development. The optional companion process itself still binds only to `127.0.0.1`.

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
