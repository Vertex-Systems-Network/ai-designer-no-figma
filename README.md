# AI Designer No Figma

Generate and edit native, editable Figma layers with the AI app you already use. The default workflow needs no provider API, key, Ollama install, Figma AI credits, or Figma MCP: prepare a structured prompt, send it yourself to Claude Desktop or another assistant, then paste its JSON answer back for validation and insertion. Optional local Ollama inference is also available.

## Current release

- Public repository: [Vertex-Systems-Network/ai-designer-no-figma](https://github.com/Vertex-Systems-Network/ai-designer-no-figma)
- GitHub package snapshot: [AI Designer No Figma 0.1.0 ZIP](artifacts/ai-designer-no-figma-0.1.0.zip) (source-matched archive; `PUB-01` verifies source and binary publication.)
- Claude Desktop installer: [AI Designer No Figma `.mcpb`](artifacts/ai-designer-no-figma-claude.mcpb) (`npm run package:claude`)
- Open work: [GitHub Issues](https://github.com/Vertex-Systems-Network/ai-designer-no-figma/issues) and [engineering backlog](docs/BACKLOG.md)

## Project progress

There is no aggregate completion percentage: it hid the distinction between code that passes local automation and work that needs a live Figma/AI-client session. These bars count explicit gates only.

| Gate | Progress | Evidence / remaining action |
|---|---:|---|
| Automated release checks | `██████████` 8/8 | Latest recorded `npm run release:verify`: typecheck, lint, 101 unit tests, 17 integration tests, local audit, build/package, strict docs audit, ZIP integrity and SHA-256 passed. Re-run after changes. |
| Feature registry fully implemented | `█████░░░░░` 8/17 | Eight features are `IMPLEMENTED`; nine remain `PARTIAL`. Counts are registry entries, not product completion. |
| Live Figma/client acceptance | `░░░░░░░░░░` 0/4 | Four named live checks are in [`docs/EXECUTION-PLAN.md`](docs/EXECUTION-PLAN.md); current executor cannot drive the user's desktop session. |
| Remaining local engineering tasks | `░░░░░░░░░░` 0/3 | Three ordered code tasks are open in the execution plan. |
| Published binary matches verified source | `██████████` 1/1 | `PUB-01` LIVE VERIFIED: source/docs and ZIP are on `main`; uploaded blob equals the local archive bytes and the SHA-256 manifest passes. |

The [execution plan](docs/EXECUTION-PLAN.md) is the sole task board. Percentages are not used for overall project completion; each task closes against its own evidence.

## Remaining task tracker

| Task group | Status | Next action |
|---|---|---|
| Local code | OPEN | Start `CODE-01`: replace source-string-only host assertions with behavior tests for patch apply, sibling preservation, and rollback. |
| Live Figma and AI clients | BLOCKED · USER DESKTOP | Run `LIVE-01` through `LIVE-04` against the exact built package; record app, build hash, and observed result. |
| Repository publication | LIVE VERIFIED | `PUB-01`: source and exact verified ZIP/checksum are synced on `main`. |
| Plugin-only closed-file/background operation | OUT OF SCOPE | `BLOCK-01`: requires a separate supported desktop runner; the current plugin session ends when its document closes. |

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

In Figma, open **Plugins → Development → Import plugin from manifest…** and select `dist/manifest.json`. Local asset saving works on this development build without a plugin ID; registration is only needed if you later publish it through Figma.

The manifest allowlists `http://localhost:8787` for optional Ollama and `http://localhost:8788` for the custom token-protected MCP bridge. Both services bind only to `127.0.0.1`. The local asset library is stored with the companion bridge so it works when Figma blocks browser and plugin storage; connect Claude in Settings to enable save and reuse.

## Use any AI app without an API

1. Keep **AI workflow → Use any AI app · no API key** selected.
2. Enter the design brief and choose the design settings, then select **Prepare prompt for AI app**.
3. Copy the prompt to Claude Desktop or another AI app you already use. Ask it to return the requested JSON.
4. Paste the answer into **Import**, select **Validate specification**, review the result, then insert it into Figma.

The Edit tab follows the same handoff for selection-aware patch JSON. The plugin sends nothing to an AI app; copying and pasting are user-controlled. It accepts a JSON code fence but validates every layer and edit operation before Figma mutation.

## Connect Claude Desktop

The Claude Desktop extension package is `artifacts/ai-designer-no-figma-claude.mcpb`. Install it through **Settings → Desktop app → Manage extensions → Advanced settings → Install Extension**, then open Figma plugin **Settings** and click **Connect Claude**. The plugin pairs with the local bridge and confirms when the connection is active. No config-file editing, terminal commands, API key, or manual token copying is part of this user flow. Build the extension with `npm run package:claude`.

For visual refinement, ask Claude to generate/import the design, then use its Figma tools to capture the selected frame. The `figma_get_job_result` response includes the actual bounded JPEG image. Claude can inspect the result, propose a safe patch to existing selected IDs, apply it, and capture again. The tool loop is available to an AI client; the plugin itself does not perform automatic screenshot critique. Live Figma rendering still needs verification.

## Optional local Ollama

Choose **Optional local Ollama model** in Generate/Edit, start the companion with `npm run runtime`, and use an installed model. The service binds to loopback and only contacts local Ollama. Manual import and external handoff continue working if the service or model is unavailable.

## Privacy and verification limits

There is no telemetry or required paid API. Any external AI app is operated separately by the user under that app's own account and data policies. Prompt history and tokens are stored in the plugin's local browser storage. The plugin host alone creates Figma document nodes.

Typecheck, lint, unit/integration tests, dependency audit, local security checks, build, and ZIP packaging are automated. Real Figma editor rendering and UI screenshot review must be recorded separately; automated tests are not evidence of a live Figma session. See [`docs/BACKLOG.md`](docs/BACKLOG.md) for current gates.

Live browser check (2026-11-08): Figma Web sign-in succeeded and a blank `Untitled` test file was created under Drafts. The cloud editor did not open: Figma showed unsynced offline changes and the cloud Chromium renderer reported `gpuSystem->init failed`. No existing file was synced or modified, and plugin UI rendering remains **NOT TESTED** in Figma.

Follow-up local Figma console evidence identified the blank panel cause: the build inlined Vite's entry script in `<head>` but stripped `type="module"`, so it ran before `#root` existed. The build now preserves module/deferred execution and checks for that attribute. The VSN startup loader and workspace options were re-imported and confirmed working by the user. Targeted bounds patches and plugin-session undo are automated-check verified; live edit preservation and undo still need a Figma check.
