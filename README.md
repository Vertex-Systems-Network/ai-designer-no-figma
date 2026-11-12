# AI Designer No Figma

Generate and edit native, editable Figma layers with the AI app you already use. The default workflow needs no provider API, key, Ollama install, Figma AI credits, or Figma MCP: prepare a structured prompt, send it yourself to Claude Desktop or another assistant, then paste its JSON answer back for validation and insertion. Optional local Ollama inference is also available.

## Current release

- Public repository: [Vertex-Systems-Network/ai-designer-no-figma](https://github.com/Vertex-Systems-Network/ai-designer-no-figma)
- GitHub package snapshot: [AI Designer No Figma 0.1.0 ZIP](artifacts/ai-designer-no-figma-0.1.0.zip) (source-matched archive; `PUB-01` verifies source and binary publication.)
- Claude Desktop installer: [AI Designer No Figma `.mcpb`](artifacts/ai-designer-no-figma-claude.mcpb) (`npm run package:claude`)
- Open work: [GitHub Issues](https://github.com/Vertex-Systems-Network/ai-designer-no-figma/issues) and [engineering backlog](docs/BACKLOG.md)

## Sequential delivery phases

One phase is implemented per development run. “Automated verified” means code and protocol tests pass; actual Figma visuals remain a separate final acceptance phase.

| Phase | Deliverable | Completion evidence | Status |
|---|---|---|---|
| 1 | Read-only local design-system inventory | Exact component/variable/style IDs, bounded output and preserved selection; host behavior and MCP protocol tests | **AUTOMATED VERIFIED**; live Figma pending Phase 6 |
| 2 | Validated agent design plan | Bounded sections, component/token/asset references and plan-to-schema tests | **AUTOMATED VERIFIED**; native candidate reuse remains Phase 3 |
| 3 | Native component variants and instance properties | Import/export/rollback tests; no silent unsupported data loss | **AUTOMATED VERIFIED** for family 1.0 subset; live editor pending Phase 6 |
| 4 | Responsive layout and actual asset composition | Explicit two-width native specs with constraint geometry and supplied asset payload checks | **AUTOMATED VERIFIED** for bounded absolute layout; live visual checks remain Phase 6 |
| 5 | Agent screenshot critique and targeted repair | Capture and selection bound to one measured patch; recapture hashes and session order checked | **AUTOMATED VERIFIED** for evidence contract; live visual verdict pending Phase 6 |
| 6 | Live Figma acceptance and same-brief comparison | Recorded editor/client versions, build hash, actual native editability, screenshots, review rubric and defects | BLOCKED on user desktop/client environment |

## Development plan

The goal is an independent design agent that creates editable Figma layers through this plugin and its local MCP bridge. Figma's hosted MCP and REST tokens are not required. The default AI handoff works without an inference API; autonomous generation and visual critique require an available AI client or installed local model. [The execution plan](docs/EXECUTION-PLAN.md) holds the detailed acceptance criteria and evidence.

| ID | Priority | Task and deliverable | Status | Done when / next action |
|---|---|---|---|---|
| `PLAN-01` | P0 | One canonical work contract, status vocabulary and traceable release gates | **AUTOMATED VERIFIED** | Plan, registry, handoff and documentation audit agree. |
| `CODE-01` | P1 | Behavioral tests for native render/edit rollback and preserved siblings | **AUTOMATED VERIFIED** | Real host module passes fault and undo fixtures. |
| `CODE-02` | P1 | Schema 1.0 native import/export field fidelity and explicit unsupported errors | **AUTOMATED VERIFIED** | Field matrix and round-trip/rejection tests pass. |
| `AGENT-01` | P1 | Local MCP preflight for schema and measurable design issues | **AUTOMATED VERIFIED** | `figma_audit_design_schema` reports validation, contrast, naming, layout, overflow and text collision findings. |
| `AGENT-02` | P1 | Discover reusable components, variables and styles in the open Figma file | **AUTOMATED VERIFIED** | `figma_get_local_design_system` returns current-page component identities and local variable/style identities with bounds and truncation flags. Live Figma result is Phase 6. |
| `AGENT-03` | P1 | Plan sections, component roles, tokens and assets before native creation | **AUTOMATED VERIFIED** | `figma_validate_design_plan` checks all top-level frames, token usage, supplied assets and candidate IDs against a supplied inventory snapshot; returns validated schema 1.0. Candidate reuse is Phase 3. |
| `CODE-03` | P1 | Native component variants and properties with instance binding | **AUTOMATED VERIFIED** for family 1.0 subset | Separate contract creates 2–8 Style variants with Label TEXT property and native instances; readback, portable export and page rollback tested. Existing library reuse and schema 1.0 instance linkage are outside this subset. |
| `AGENT-04` | P1 | Rendered design review and targeted repair loop | **PARTIAL** | `figma_prepare_visual_repair` binds a capture, selected layer, observed defect and one patch. `figma_verify_visual_repair` checks ordered recapture hashes. A real vision client must judge the before/after images in Phase 6. |
| `AGENT-05` | P2 | Responsive layout and typography fidelity | **PARTIAL** | Supported sizing/wrapping rules tested at two widths with real text; no clipped actions or unintended overlap in screenshots. |
| `AGENT-06` | P2 | Reuse real local image/vector assets in generated compositions | **PARTIAL** | Existing bounded SVG/raster import and storage need live save/reload/reuse and visual asset placement checks; never fabricate bytes. |
| `EVAL-01` | P1 | Compare against Figma Agent on the same briefs | **OPEN** | Same inputs and sizes, native editability, design-system reuse, screenshots and recorded reviewers; report observed gaps, not a claimed equivalence. |
| `LIVE-01`–`LIVE-04` | P1/P2 | Figma, Claude bridge, assets and Ollama acceptance | **BLOCKED · USER DESKTOP/MACHINE** | Run the exact build in those applications; record build hash, actions and actual outcomes. |
| `INTEROP-01` | P2 | Optional external Figma reference handoff | **AUTOMATED VERIFIED** | Bounded user-supplied notes are included in a copy/paste prompt; separate from the local agent goal. |
| `PUB-01` | P1 | Publish tested source with matching ZIP and checksums | **LIVE VERIFIED** | Verify archive hash, Git blob and required files for each release-bound change. |
| `BLOCK-01`–`BLOCK-02` | — | Closed-document automation and arbitrary client file/identity access | **OUT OF PLUGIN SCOPE / NOT VERIFIED** | Requires separate authenticated desktop/client capabilities; do not advertise as plugin features. |

**Current release evidence:** `npm run release:verify` passed typecheck, lint, 120 unit tests, 21 integration tests, local audit, build/package, strict docs audit (0 findings), ZIP integrity and SHA-256. This verifies code and packaging, not real Figma rendering or parity with Figma Agent. Phase 4 adds `figma_compose_responsive_plan` for two explicit widths, constraint geometry and supplied image/vector payloads; actual typography and screenshots remain Phase 6. Next is Phase 6 live editor acceptance.

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

## Native component families

The local MCP can create and export a [bounded native component family](docs/integrations/COMPONENT-FAMILY-1.0.md): Style variants, editable Label property and review instances on a new page. This separate contract leaves design-spec 1.0 unchanged. Other component property types and existing library reuse are not claimed.

## Local agent design plan

`figma_validate_design_plan` accepts a [versioned section plan](docs/integrations/DESIGN-PLAN-1.0.md) with an embedded native design spec. It checks exact frame, token, asset and optional inventory-candidate references, then returns the validated spec for the existing import tool. It does not automatically generate design content or instantiate existing Figma components.

## Local agent design review

Our custom MCP exposes `figma_audit_design_schema`: validate generated JSON and review contrast, semantic names, Auto Layout, explicit overflow and text collisions before inserting editable layers. An agent can then import, capture the actual frame, inspect the JPEG, apply a selected-ID patch and capture again. The [local design agent roadmap](docs/integrations/LOCAL-DESIGN-AGENT-ROADMAP.md) maps the official Figma guide’s useful workflows to this no-hosted-token architecture and distinguishes implemented steps from live verification.

## Optional official Figma MCP reference

If an external AI client is separately connected to Figma MCP, fetch a focused frame’s design context, variable definitions and screenshot there. Paste concise factual notes into **Generate → Figma reference context**; the bounded reference is included in the copy/paste handoff prompt. A Figma URL alone is not inspected by this plugin. This is an optional manual workflow; see [interoperability audit](docs/integrations/OFFICIAL-FIGMA-MCP-INTEROP.md).

## Optional local Ollama

Choose **Optional local Ollama model** in Generate/Edit, start the companion with `npm run runtime`, and use an installed model. The service binds to loopback and only contacts local Ollama. Manual import and external handoff continue working if the service or model is unavailable.

## Privacy and verification limits

There is no telemetry or required paid API. Any external AI app is operated separately by the user under that app's own account and data policies. Prompt history and tokens are stored in the plugin's local browser storage. The plugin host alone creates Figma document nodes.

Typecheck, lint, unit/integration tests, dependency audit, local security checks, build, and ZIP packaging are automated. Real Figma editor rendering and UI screenshot review must be recorded separately; automated tests are not evidence of a live Figma session. See [`docs/BACKLOG.md`](docs/BACKLOG.md) for current gates.

Live browser check (2026-11-08): Figma Web sign-in succeeded and a blank `Untitled` test file was created under Drafts. The cloud editor did not open: Figma showed unsynced offline changes and the cloud Chromium renderer reported `gpuSystem->init failed`. No existing file was synced or modified, and plugin UI rendering remains **NOT TESTED** in Figma.

Follow-up local Figma console evidence identified the blank panel cause: the build inlined Vite's entry script in `<head>` but stripped `type="module"`, so it ran before `#root` existed. The build now preserves module/deferred execution and checks for that attribute. The VSN startup loader and workspace options were re-imported and confirmed working by the user. Targeted bounds patches and plugin-session undo are automated-check verified; live edit preservation and undo still need a Figma check.
