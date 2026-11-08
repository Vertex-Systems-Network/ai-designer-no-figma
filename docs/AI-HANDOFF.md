# AI development handoff

Updated: 2026-11-08. Start with root [`AGENTS.md`](../AGENTS.md), then [project status](PROJECT-STATUS.md), [registry](FEATURE-REGISTRY.json), [roadmap](DEVELOPMENT-ROADMAP.md), and relevant source/tests.

## Current state

- Existing plugin and optional Ollama runtime are preserved.
- User confirmed the VSN startup loader and plugin panel work in Figma.
- Selected export and patch geometry/undo were implemented and passed typecheck/lint/unit/integration/build/audit/package before this handoff update; live Figma verification of these latest controls is still needed.
- Custom MCP stdio server, authenticated loopback bridge, job broker, pairing settings, and Agent Activity timeline are implemented. Protocol, security, session isolation, and job-result behavior pass automated tests. Live Figma pairing and client-specific setup are still NOT TESTED.
- Bridge HTTP polling now runs only in the plugin UI iframe (the browser runtime); Figma host code receives validated jobs and performs document operations. After initial connection confirmation, **Connect & hide panel** calls `figma.ui.hide()`; the hidden iframe continues running and keeps the same document session connected. Figma's `currentuser` permission supplies the operator name and signed-in state for Agent Activity. Automated checks cover the host runtime, but live hidden-mode behavior is NOT TESTED.
- Manual SVG and PNG/JPEG/GIF imports are implemented with shared input bounds, a 5 MiB MCP/local-file raster limit with 64 KiB SHA-256 checked chunks above the 192 KiB direct-transfer threshold, and a bounded authenticated loopback asset library with private file persistence. This avoids Figma `clientStorage`, browser `localStorage`, IndexedDB, and plugin-ID requirements. Save/reload/reuse and live paired MCP transfer still need confirmation; import remains usable when the local service is disconnected.
- Selection patches now include reviewed frame-only Auto Layout mode/gap/padding/alignment changes and include layout state in rollback snapshots; live Figma preservation remains NOT TESTED.
- Design-system color, typography and spacing tokens are locally persisted and included in both manual AI handoff and optional Ollama generation. Up to 20 named local presets can be saved, loaded, duplicated and deleted. Native Figma text styles/Variables are still not created.
- Latest `npm run release:verify`: 40 unit tests and 15 integration tests, typecheck, lint, local audit, production build/package, strict docs audit (0 findings), ZIP integrity and SHA-256 all passed. `npm run compatibility:check` reports metadata/typing only; it does not certify a live Figma session.
- Added a non-blocking `auditDesignQuality()` pass after successful JSON validation. It flags measurable contrast issues (when solid fills are known), generic names, missing explicit font sizes and repeated containers without Auto Layout. The prompt now directs the connected AI app to produce coherent, semantically named and readable design systems. Unit tests cover the audit; it cannot prove rendered visual quality or superiority to Figma Agent.

## Exact next tasks

1. Reimport `dist/manifest.json` in Figma Desktop and use **Connect & hide panel** in plugin Settings; no token entry is needed.
2. Confirm Figma operator display, then issue one Claude MCP operation with the panel hidden; verify actual result and that reopening the plugin shows Agent Activity.
3. Verify selection inspect, import, targeted patch, selected export, export/import round-trip, bounds edits, undo and unaffected siblings in Figma.
4. Test Ollama only if a local runtime/model is actually available; otherwise record NOT TESTED.
5. Verify new SVG/raster insertion and Auto Layout patch/undo in Figma. Remaining engineering items are live paired large-file transfer verification, schema-backed assets, gradients/components/variables, and accessibility/screenshot QA.
6. Closed-file operation is still a separate product requirement: Figma plugin sessions stop with the host document. A local desktop runner must be designed to launch/select a Draft file and run the plugin before claiming that Claude can work with Figma fully closed.
7. Compare generated output against Figma Agent only in a controlled live evaluation with the same briefs and visual review; no superiority claim is supported yet.

## Constraints

No Git CLI/GitHub CLI, official Figma MCP, paid model API, public bind, hidden telemetry, arbitrary model execution, or fabricated integration status. Use direct source/document changes and update README/backlog/roadmap progress bars, registry, status, known issues, changelog and this handoff as work lands.

## Commands

`npm run verify` runs typecheck, lint, unit/integration tests, build, local audit and package. `npm run docs:validate` enforces project documentation/registry/source references. `npm run release:verify` includes package integrity and required contents. `npm run mcp` starts the custom MCP stdio server and loopback bridge.
