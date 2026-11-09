# AI Designer No Figma

Generate and edit native, editable Figma layers with the AI app you already use. The default workflow needs no provider API, key, Ollama install, Figma AI credits, or Figma MCP: prepare a structured prompt, send it yourself to Claude Desktop or another assistant, then paste its JSON answer back for validation and insertion. Optional local Ollama inference is also available.

## Current release

- Public repository: [Vertex-Systems-Network/ai-designer-no-figma](https://github.com/Vertex-Systems-Network/ai-designer-no-figma)
- GitHub package snapshot: [AI Designer No Figma 0.1.0 ZIP](artifacts/ai-designer-no-figma-0.1.0.zip) (source changes may be newer; use `npm run package` to rebuild.)
- Claude Desktop installer: [AI Designer No Figma `.mcpb`](artifacts/ai-designer-no-figma-claude.mcpb) (`npm run package:claude`)
- Open work: [GitHub Issues](https://github.com/Vertex-Systems-Network/ai-designer-no-figma/issues) and [engineering backlog](docs/BACKLOG.md)

## Project progress

**Overall completion: 93%** — rounded mean of the 11 phase estimates below. Schema-backed images, native Variables/text styles, responsive constraints/grids, bounded solid/linear-gradient/radial-gradient/image paints, native shadow/blur effects and affine gradient transforms, advanced layer export, and category-specific prompt recipes now have implementation and automated coverage; live desktop confirmation and remaining product gates are still open. It is not a release-readiness claim.

| Phase | Progress | Status | Remaining gate |
|---|---:|---|---|
| 0 · Environment audit | `████████████████████` 100% | PASS | — |
| 1 · Engineering foundation | `████████████████████` 100% | PASS | — |
| 2 · Figma plugin and renderer | `███████████████████░` 99% | IN PROGRESS | Live native renderer verification; progressive blur/unsupported effect variants |
| 3 · Specification and validation | `███████████████████░` 99% | IN PROGRESS | Live image/render check and full metadata round-trip across radial/progressive variants |
| 4 · AI integration | `████████████████░░░░` 80% | IN PROGRESS | Additional client interoperability and live local-model checks |
| 5 · Selection editing | `██████████████████░░` 90% | IN PROGRESS | Live instance replacement, undo and preservation verification |
| 6 · Design system | `███████████████████░` 93% | IN PROGRESS | Live verification of native Variables/styles and broader token round-trip |
| 7 · Application UI | `██████████████████░░` 90% | IN PROGRESS | Pairing/activity/asset UI needs Figma live confirmation and accessibility review |
| 8 · Testing and hardening | `███████████████████░` 99% | IN PROGRESS | Live Figma renderer/preservation and real local-model checks remain environment-dependent |
| 9 · Build and packaging | `████████████████████` 100% | PASS | — |
| 10 · Final audit | `███████████████░░░░░` 74% | IN PROGRESS | Complete live Figma and client interoperability evidence |

Progress percentages estimate completed acceptance scope for each phase; they are not schedule estimates. A phase reaches 100% only when its acceptance gate is verified. See [the backlog](docs/BACKLOG.md) for evidence and [open issues](https://github.com/Vertex-Systems-Network/ai-designer-no-figma/issues) for tracked work.

## Remaining task tracker

Completed engineering rows have been removed. Remaining work is split between live verification and code/environment gates, with each status called out in its row.

### Requires live Figma or Claude verification

| Verification task | Status | What must be observed |
|---|---|---|
| Render images, components, instances, vectors, gradients, shadows, grids, constraints and Variables/styles | NOT TESTED | Confirm schema features appear as editable Figma nodes, variable bindings, text styles and responsive layout. |
| Pair Claude and run a hidden-panel job | NOT TESTED | Confirm background bridge response and Agent Activity in the signed-in desktop session. |
| Export selected design and re-import it | NOT TESTED | Confirm supported node, paint, token and layout data round-trips in live Figma. |
| Save, reload and reuse SVG/raster assets | NOT TESTED | Confirm local library persistence and native asset insertion in Figma. |
| Patch, Auto Layout, instance replacement, undo and sibling preservation | NOT TESTED | Confirm only intended layers change and rollback restores the selection. |
| Preview → AI review → patch → recapture | NOT TESTED | Confirm actual preview image reaches Claude and a repair cycle works. |

Live rows are not treated as passes based on mocks. There are also unfinished engineering/environment tasks; they remain visible below rather than being counted as completed.

### Remaining implementation and environment gates

| Task | Status | Remaining work |
|---|---|---|
| Create/open a new Draft file and work after Figma/plugin closure | BLOCKED · NOT IMPLEMENTED | Current plugin sessions end when Figma or the open document closes. A supported desktop automation runner and a Windows Figma session are required. |
| Export unsupported gradient/effect variants | OPEN | Solid, linear-gradient, radial-gradient and embedded PNG/JPEG paints (up to 8 ordered fills), four-entry drop/inner-shadow and normal blur effect stacks, and component swaps are implemented. Progressive blur, angular/diamond gradients and other unsupported effects still fail explicitly. |
| Verify generation with a real local Ollama model | NOT TESTED | No Ollama endpoint or installed model is available in this executor; the fake-server suite only verifies the stream contract. |
| Run screenshot-based responsive/accessibility review | NOT TESTED | Needs a live Figma renderer or a browser build with realistic Figma host mocks; no rendered screenshot is claimed. |
| Verify per-client MCP and generated-file access | NOT VERIFIED | Client-specific local MCP launch, file discovery, and tool use need separate tests in Claude/Codex/Cursor/Gemini. |

## Master Prompt 04 · AI assets progress

| Phase | Progress | Status | Evidence / next gate |
|---|---:|---|---|
| 1 · Repository audit | `██████████` 100% | PASS | Existing MCP, bridge, renderer, UI, registry, and tests inspected. |
| 2 · Client capability discovery | `████░░░░░░` 40% | PARTIAL | Server explicitly reports native generation and automatic file access as NOT VERIFIED; per-client probes/matrix remain. |
| 3 · Asset transport | `████████░░` 80% | IMPLEMENTED · AUTOMATED VERIFIED | MCP accepts raster files up to 5 MiB, transfers larger payloads in 64 KiB checksum-verified chunks, and atomically reserves all bridge jobs. Live paired transfer remains. |
| 4 · Safe SVG import | `██████░░░░` 60% | IMPLEMENTED · AUTOMATED VERIFIED | Conservative sanitizer, geometry allowlist, size/dimension bounds, and native SVG-node insertion; live Figma editability untested. |
| 5 · Raster image import | `██████░░░░` 60% | IMPLEMENTED · AUTOMATED VERIFIED | PNG/JPEG/GIF signatures/dimensions/checksums and native image fills are validated; live rendering untested. |
| 6 · Capability routing | `██░░░░░░░░` 20% | PARTIAL | Honest manual/local options and unsupported client claims are reported; no generic AI client router is verified. |
| 7 · Agent activity | `███░░░░░░░` 30% | PARTIAL | Actual import completion result appears in plugin UI; intermediate lifecycle events are not implemented. |
| 8 · Local asset library | `█████████░` 90% | IMPLEMENTED · BUILD VERIFIED | SHA-256 dedupe, bounded local bridge file storage, preview, reuse and explicit delete/clear controls no longer depend on Figma plugin ID or iframe storage; live refresh/reuse confirmation remains. |
| 9 · AI Assets UI | `███████░░░` 75% | IMPLEMENTED · AUTOMATED VERIFIED | Manual vector/raster import and local library actions are wired; UI screenshot/layout review in live Figma is pending. |
| 10 · Structural verification | `███░░░░░░░` 30% | PARTIAL | Import handlers validate bytes and return dimensions/node IDs; post-insert readback and bounded repair remain. |
| 11 · Compatibility/security | `████░░░░░░` 40% | PARTIAL | SVG allowlist, input bounds, image signatures and no remote fetch; client matrix/live security checks remain. |
| 12 · Tests and release | `██████████` 100% | PASS · AUTOMATED | Latest `npm run release:verify` passed: 70 unit and 17 integration tests, typecheck, lint, local audit, build/package, strict docs audit (0 findings), ZIP integrity and SHA-256. Live Figma belongs to the compatibility gate. |
| 13 · Repository documentation | `██████████` 100% | PASS · AUDITED | README, backlog, roadmap, feature registry, status, known issues, changelog and handoff reflect the current build; strict audit reported 0 findings. |

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
