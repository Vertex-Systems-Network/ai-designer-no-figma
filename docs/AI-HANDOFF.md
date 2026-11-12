# AI development handoff

Updated: 2026-11-12. Start with root [`AGENTS.md`](../AGENTS.md), [`MASTER-ENGINEERING-PROMPT.md`](MASTER-ENGINEERING-PROMPT.md), [`EXECUTION-PLAN.md`](EXECUTION-PLAN.md), then the relevant registry entries and source/tests.

## Current state

- Existing plugin and optional Ollama runtime are preserved.
- User confirmed the VSN startup loader and plugin panel work in Figma.
- Selected export and patch geometry/undo were implemented and passed typecheck/lint/unit/integration/build/audit/package before this handoff update; live Figma verification of these latest controls is still needed.
- Custom MCP stdio server, authenticated loopback bridge, job broker, pairing settings, and Agent Activity timeline are implemented. Protocol, security, session isolation, and job-result behavior pass automated tests. Live Figma pairing and client-specific setup are still NOT TESTED.
- Bridge HTTP polling now runs only in the plugin UI iframe (the browser runtime); Figma host code receives validated jobs and performs document operations. After initial connection confirmation, **Connect & hide panel** calls `figma.ui.hide()`; the hidden iframe continues running and keeps the same document session connected. Figma's `currentuser` permission supplies the operator name and signed-in state for Agent Activity. Automated checks cover the host runtime, but live hidden-mode behavior is NOT TESTED.
- Manual SVG and PNG/JPEG/GIF imports are implemented with shared input bounds, a 5 MiB MCP/local-file raster limit with 64 KiB SHA-256 checked chunks above the 192 KiB direct-transfer threshold, and a bounded authenticated loopback asset library with private file persistence. This avoids Figma `clientStorage`, browser `localStorage`, IndexedDB, and plugin-ID requirements. Save/reload/reuse and live paired MCP transfer still need confirmation; import remains usable when the local service is disconnected.
- Selection patches include reviewed frame-only Auto Layout, bounded image replacement, FILL/FIT/TILE/custom CROP image scale edits, and targeted `INSTANCE` → selected `COMPONENT` replacement. Crop accepts a bounded invertible affine 2×3 matrix and TILE a factor up to 10; bytes and other paint attributes are retained, while rollback restores prior fills. Design specs preserve crop matrices and tile scale factors for standalone image nodes and image paint stacks. Live image appearance, replacement, override preservation and undo remain NOT TESTED.
- Selected export explicitly rejects non-normal blend modes on nodes, paints, and shadow effects when schema 1.0 has no matching field; tests cover Normal, container pass-through, and rejected paint/effect modes.
- Design spec 1.0 now preserves `clipsContent` for frames/components through validation, render, and selected export. Group clipping is rejected. Live clipping appearance remains NOT TESTED.
- Line stroke opacity round-trips through the schema and renderer; export rejects multiple visible line strokes and unsupported/non-normal stroke variants. Live line rendering/export remains NOT TESTED.
- Design spec 1.0 supports named per-corner radii and corner smoothing for frames, components and rectangles. Uniform values export as `radius`; distinct corner values remain named in `cornerRadii`. Live visual round-trip remains NOT TESTED.
- Selection-aware `set-rotation` edits are bounded to -180°–180° and restore rotation on undo.
- Native node rotation is accepted between -180° and 180° and is applied on render/export; live Figma transform behavior remains NOT TESTED.
- Design-system color, typography and spacing scales remain locally persisted with up to 20 presets. Design-spec 1.0 now supports bounded PNG/JPEG image nodes, color and text-style tokens, responsive constraints and row/column/grid definitions. Rendering creates native image fills, local Figma color Variables and Text Styles, applies supported constraints/grids, and binds declared tokens.
- `npm run release:verify` passes for the current change set: 115 unit tests and 20 integration tests, typecheck, lint, local audit, build/package, strict docs audit (0 findings), ZIP integrity and SHA-256. `npm run compatibility:check` reports metadata/typing only and does not certify a live Figma session.
- Added a non-blocking `auditDesignQuality()` pass after successful JSON validation. It flags measurable contrast issues (when solid fills are known), generic names, missing explicit font sizes and repeated containers without Auto Layout. The prompt now directs the connected AI app to produce coherent, semantically named and readable design systems. Unit tests cover the audit; it cannot prove rendered visual quality or superiority to Figma Agent.
- Implemented `figma_capture_selection`: the plugin host exports one selected frame as a JPEG using progressive 1024/768/512 px widths, a 700 KiB byte cap, and strict selection/aspect/height bounds. Generated pages select their first root frame. The local MCP server returns a completed preview job as an image content block so an AI client can visually inspect it and then call targeted patch tools. The plugin does not autonomously invoke the AI or choose repeated repairs; live Figma + Claude test remains open.
- Figma compatibility mapping isolates schema Auto Layout modes and primary-axis alignment, with round-trip unit tests against installed Plugin API types. Other API mappings and live versions remain unverified.
- Local Ollama generation now uses the full provider-neutral schema/category prompt; its NDJSON stream is output-bounded and the UI reports received characters while cancellation aborts the upstream request. Fake-server tests pass; no real installed model is available to verify.
- Design-spec 1.0 supports bounded PNG/JPEG image nodes (256 KiB per image), design tokens (including text case, decoration, letter/paragraph spacing, vertical alignment and text resize behavior), responsive constraints and grids, alongside components/instances, vectors, gradients (including bounded affine transforms), up to eight stacked solid/linear-gradient/image paints, and up to four ordered drop/inner-shadow, normal blur, and progressive layer/background blur effects. Selected-tree export preserves supported features and rejects unsupported paint/effect/mode/component cases with actionable errors. Category-specific generation recipes cover website, dashboard, mobile, admin, WordPress admin, e-commerce, landing page and custom interface. Live Figma rendering and export/import round-trip remain NOT TESTED.

## Exact next tasks

Authoritative order and acceptance tests are in [`EXECUTION-PLAN.md`](EXECUTION-PLAN.md). `PLAN-01` is complete: documentation audit reports 0 findings. `CODE-01` and `CODE-02` are AUTOMATED VERIFIED; the full schema 1.0 import/export mapping and rejection boundaries are in [`EXPORT-FIDELITY-MATRIX.md`](EXPORT-FIDELITY-MATRIX.md). Next start Phase 3 / `CODE-03` component property/variant implementation. Desktop-dependent `LIVE-*` checks remain blocked until Figma/Claude/Ollama can be tested against the exact build. `PUB-01` is LIVE VERIFIED only for the previously published source snapshot; republish after the current verification succeeds.

## Constraints

No Git CLI/GitHub CLI, official Figma MCP, paid model API, public bind, hidden telemetry, arbitrary model execution, or fabricated integration status. Use direct source/document changes and update README/backlog/roadmap progress bars, registry, status, known issues, changelog and this handoff as work lands.

## Commands

`npm run verify` runs typecheck, lint, unit/integration tests, build, local audit and package. `npm run docs:validate` enforces project documentation/registry/source references. `npm run release:verify` includes package integrity and required contents. `npm run mcp` starts the custom MCP stdio server and loopback bridge.

## 2026-11-12 official Figma guide audit

`INTEROP-01` adds an optional user-supplied Figma reference field to the external handoff only. The official guide is a remote MCP configuration/skills repository, not a server package; no automatic Figma MCP connectivity or live client verification is claimed. See [`OFFICIAL-FIGMA-MCP-INTEROP.md`](integrations/OFFICIAL-FIGMA-MCP-INTEROP.md). Phase 1 / `AGENT-02` is automated verified; next is Phase 2 / `AGENT-03`.

## 2026-11-12 local-agent correction

User intent is to learn from Figma Agent techniques while keeping our own local MCP, Plugin API, optional local AI and no Figma hosted token. `AGENT-01` adds the token-free schema audit MCP tool and geometry findings. See [`LOCAL-DESIGN-AGENT-ROADMAP.md`](integrations/LOCAL-DESIGN-AGENT-ROADMAP.md). `CODE-03` is next; live screenshot/agent loop remains unverified.

## 2026-11-12 README task table

README now presents one goal-driven task table with status, acceptance and next actions; the canonical execution plan includes `AGENT-02`–`AGENT-06` and `EVAL-01`. No new design capability is claimed by this documentation update.

## 2026-11-12 Phase 1 checkpoint

Implemented bounded current-page component and local document variable/style identity inventory via `figma_get_local_design_system`; unit, host behavior and MCP protocol tests pass. It returns mode IDs, not fully resolved token values or library imports. Live editor observation remains Phase 6. Next run: Phase 3 / `CODE-03` native component variants and properties.

## 2026-11-12 Phase 2 checkpoint

Plan 1.0 validator and `figma_validate_design_plan` MCP tool are automated verified. It maps top-level frames, actual token use and in-section image/vector assets; component candidates are checked against caller-supplied inventory but are not instantiated. Next run: Phase 3 / `CODE-03`.
