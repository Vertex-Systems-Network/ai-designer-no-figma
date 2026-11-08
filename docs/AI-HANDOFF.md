# AI development handoff

Updated: 2026-11-09. Start with root [`AGENTS.md`](../AGENTS.md), then [project status](PROJECT-STATUS.md), [registry](FEATURE-REGISTRY.json), [roadmap](DEVELOPMENT-ROADMAP.md), and relevant source/tests.

## Current state

- Existing plugin and optional Ollama runtime are preserved.
- User confirmed the VSN startup loader and plugin panel work in Figma.
- Selected export and patch geometry/undo were implemented and passed typecheck/lint/unit/integration/build/audit/package before this handoff update; live Figma verification of these latest controls is still needed.
- Custom MCP stdio server, authenticated loopback bridge, job broker, pairing settings, and Agent Activity timeline are implemented. Protocol, security, session isolation, and job-result behavior pass automated tests. Live Figma pairing and client-specific setup are still NOT TESTED.
- Bridge HTTP polling now runs only in the plugin UI iframe (the browser runtime); Figma host code receives validated jobs and performs document operations. After initial connection confirmation, **Connect & hide panel** calls `figma.ui.hide()`; the hidden iframe continues running and keeps the same document session connected. Figma's `currentuser` permission supplies the operator name and signed-in state for Agent Activity. Automated checks cover the host runtime, but live hidden-mode behavior is NOT TESTED.
- Manual SVG and PNG/JPEG/GIF imports are implemented with shared input bounds, a 5 MiB MCP/local-file raster limit with 64 KiB SHA-256 checked chunks above the 192 KiB direct-transfer threshold, and a bounded authenticated loopback asset library with private file persistence. This avoids Figma `clientStorage`, browser `localStorage`, IndexedDB, and plugin-ID requirements. Save/reload/reuse and live paired MCP transfer still need confirmation; import remains usable when the local service is disconnected.
- Selection patches now include reviewed frame-only Auto Layout mode/gap/padding/alignment changes and include layout state in rollback snapshots; live Figma preservation remains NOT TESTED.
- Design-system color, typography and spacing scales remain locally persisted with up to 20 presets. Design-spec 1.0 now supports bounded PNG/JPEG image nodes, color and text-style tokens, responsive constraints and row/column/grid definitions. Rendering creates native image fills, local Figma color Variables and Text Styles, applies supported constraints/grids, and binds declared tokens.
- `npm run release:verify` passes for this change set: 53 unit tests, 15 integration tests, typecheck, lint, local audit, build/package, strict docs audit (0 findings), ZIP integrity and SHA-256. `npm run compatibility:check` reports metadata/typing only and does not certify a live Figma session.
- Added a non-blocking `auditDesignQuality()` pass after successful JSON validation. It flags measurable contrast issues (when solid fills are known), generic names, missing explicit font sizes and repeated containers without Auto Layout. The prompt now directs the connected AI app to produce coherent, semantically named and readable design systems. Unit tests cover the audit; it cannot prove rendered visual quality or superiority to Figma Agent.
- Implemented `figma_capture_selection`: the plugin host exports one selected frame as a JPEG using progressive 1024/768/512 px widths, a 700 KiB byte cap, and strict selection/aspect/height bounds. Generated pages select their first root frame. The local MCP server returns a completed preview job as an image content block so an AI client can visually inspect it and then call targeted patch tools. The plugin does not autonomously invoke the AI or choose repeated repairs; live Figma + Claude test remains open.
- Design-spec 1.0 supports bounded PNG/JPEG image nodes (256 KiB per image), design tokens, responsive constraints and grids, alongside components/instances, vectors, gradients and shadows. Selected-tree export preserves supported features and rejects unsupported paint/effect/mode/component cases with actionable errors. Category-specific generation recipes cover website, dashboard, mobile, admin, WordPress admin, e-commerce, landing page and custom interface. Live Figma rendering and export/import round-trip remain NOT TESTED.

## Exact next tasks

1. Reimport `dist/manifest.json` in Figma Desktop and use **Connect & hide panel** in plugin Settings; no token entry is needed.
2. Confirm Figma operator display, then issue one Claude MCP operation with the panel hidden; verify actual result and that reopening the plugin shows Agent Activity.
3. Verify selection inspect, import, targeted patch, selected export, export/import round-trip, bounds edits, undo and unaffected siblings in Figma.
4. Test Ollama only if a local runtime/model is actually available; otherwise record NOT TESTED.
5. Verify native component/instance/vector/image/gradient/shadow rendering, Variables/Text Styles, responsive grids/constraints, SVG/raster insertion, selected export/import round-trip and Auto Layout patch/undo in Figma.
6. Closed-file operation is still a separate product requirement: Figma plugin sessions stop with the host document. A local desktop runner must be designed to launch/select a Draft file and run the plugin before claiming that Claude can work with Figma fully closed.
7. Compare generated output against Figma Agent only in a controlled live evaluation with the same briefs and visual review; no superiority claim is supported yet.
8. In Figma, run Claude Desktop MCP: render a design, call `figma_capture_selection`, inspect the image in `figma_get_job_result`, apply a bounded patch, and capture again. Confirm image content reaches Claude, rendered text remains legible, and result-size limits behave as intended.

## Constraints

No Git CLI/GitHub CLI, official Figma MCP, paid model API, public bind, hidden telemetry, arbitrary model execution, or fabricated integration status. Use direct source/document changes and update README/backlog/roadmap progress bars, registry, status, known issues, changelog and this handoff as work lands.

## Commands

`npm run verify` runs typecheck, lint, unit/integration tests, build, local audit and package. `npm run docs:validate` enforces project documentation/registry/source references. `npm run release:verify` includes package integrity and required contents. `npm run mcp` starts the custom MCP stdio server and loopback bridge.
