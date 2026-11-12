# Project status

Last status review: 2026-11-12. [`FEATURE-REGISTRY.json`](FEATURE-REGISTRY.json) is authoritative for capability state; [`EXECUTION-PLAN.md`](EXECUTION-PLAN.md) is authoritative for task priority; test evidence is recorded separately.

- Reconciled the duplicated roadmap, stale product checklist, conflicting test counts, README status claims, and coding-agent instructions. `npm run docs:validate` passes with 0 findings. `CODE-01` and `CODE-02` are automated verified; the schema 1.0 import/export field matrix is in [`EXPORT-FIDELITY-MATRIX.md`](EXPORT-FIDELITY-MATRIX.md). The latest ZIP was built and locally verified; publish this exact snapshot before treating `PUB-01` as current.

## Completed / verified

- Local-first plugin shell, structured JSON validation/import, provider-neutral prompt copy/paste, history/tokens/theme/settings, native rendering for supported basic node types.
- Optional Ollama loopback service now receives the full schema/category prompt, streams bounded NDJSON output to the UI, and propagates cancellation; deterministic HTTP integration tests use a local test double and do not verify a real model.
- VSN startup loader and plugin UI were confirmed working by the user in Figma.
- Custom stdio MCP server and authenticated loopback bridge: protocol initialization, tested tool discovery, schema rejection, job correlation, session isolation and result return are covered by automated integration tests.
- Settings now accepts the loopback pairing endpoint/token, and Agent Activity receives real bridge status and operation events. This is build-verified; live pairing is not yet tested.
- Bridge polling and HTTP requests now run in the plugin UI iframe; the restricted Figma JSVM host only executes validated Figma document operations and sends correlated results back. Connect now hides the panel after the loopback session is confirmed while the iframe keeps polling. The plugin also reads the signed-in Figma user's display name through the explicit `currentuser` permission. Automated host-runtime regressions pass; live hidden-panel operation is not yet tested.
- `npm run release:verify` passes with selected image Fill/Fit/Tile/custom crop patches; design specs round-trip crop transforms and TILE scaling factors. Live Figma image appearance and undo remain NOT TESTED.
- Added an advisory design-quality audit for low-contrast text against solid ancestor fills, generic layer names, missing explicit font sizes, and multi-child containers without Auto Layout. It is deterministic, non-blocking, and test-covered; it is not a screenshot/rendering or subjective design-quality score.
- Added an AI-orchestrated visual feedback path: after render, the first root frame is selected; Claude MCP can request a JPEG preview of one selected frame, bounded to 1024 px wide / 700 KiB, and `figma_get_job_result` returns it as an MCP image block. The agent can inspect that image, submit a targeted patch, and capture again. This does not run without an AI client invoking the tools, and live Figma capture/image review remain NOT TESTED.

## Partial

- Design-spec schema 1.0 now validates native components/instances, bounded SVG paths, PNG/JPEG image payloads capped at 256 KiB each, gradients, shadows, named color/text tokens, responsive constraints and frame grids. The renderer creates native nodes, local color Variables and Text Styles; live Figma rendering remains NOT TESTED.
- Design quality can be checked for several measurable specification issues; visual hierarchy, responsive behavior, overlap, perceived polish and head-to-head Figma Agent quality are NOT TESTED and are not certified by this audit.
- Visual screenshot critique is available through MCP tool calls; no autonomous plugin-side retry policy or visual-model invocation is built in. Actual export size behavior, image delivery to Claude Desktop, and repair cycles require live validation.
- Selection edits support text/fill/name/bounds, Auto Layout, image Fill/Fit/Tile/custom crop-reposition, image replacement, instance-to-component replacement, and session undo; geometry/override/undo live preservation is NOT TESTED.
- Selection patches can swap an existing `INSTANCE` to a selected `COMPONENT`, preserving Figma's compatible overrides; the old main component and property values are captured for plugin-session rollback. Live override behavior is NOT TESTED.
- Auto Layout direction, spacing, padding and primary-axis alignment can be proposed as a safe frame patch; final automated verification and live preservation checks remain.
- The AI Assets view now persists sanitized SVG/raster source bytes locally with SHA-256 deduplication, size/item caps, preview, reuse, select and delete/clear actions. Live Figma insertion/editability remains NOT TESTED.
- Design System manages locally persisted typography/spacing scales and up to 20 named presets. Spec imports create/reuse native color variables and text styles and bind layer fills/text to named tokens. Live document behavior is NOT TESTED.
- Selected-tree export now serializes frames, groups, components, supported instances, vectors, embedded PNG/JPEG, linear/radial/angular/diamond gradients, up to eight stacked solid/linear-gradient/radial-gradient/angular-gradient/diamond-gradient/image paints, up to four native strokes plus effects (drop/inner shadows and normal/progressive layer/background blur), grids/constraints and referenced local color/text tokens. It deliberately fails on other unsupported effects and unsupported gradient/effect types, token modes that cannot be resolved, or instances without an accessible main component. Export/render round-trip is automated-fixture covered but NOT TESTED in live Figma.
- Fixed a silent selected-export loss: bound color variables and text styles were collected during async traversal, but the export snapshot was assembled before traversal completed. A behavior-level host test now confirms token definitions and their node references are included in exported JSON. Release verification: 101 unit and 17 integration tests; live Figma remains NOT TESTED.
- Fixed selected export silently omitting non-uniform native text data: mixed font/line-height styling and multiple range-bound text color variables now fail with actionable errors. Host behavior coverage also verifies vector paths, detached component definitions and instance references, embedded raster bytes/crop transforms, gradient/shadow fields, and rejection of unsupported effects, node types, and multi-stroke outlines. Latest full release verification: 108 unit and 17 integration tests; live Figma remains NOT TESTED.
- Completed the schema 1.0 import/export fidelity matrix. Corrected text export to emit one canonical color field, made text-style tokens apply before explicit typography overrides, and rejected unsupported text/line radius before render. Latest `npm run release:verify`: 108 unit + 17 integration tests; docs audit has 0 findings; ZIP integrity and SHA-256 pass. Live Figma round-trip remains NOT TESTED.
- Preserved translated linear-gradient matrices and broader native font weight levels during export. A rectangle using a raster fill now exports as a shape paint stack when it also has rounded corners or a visible outline, preserving those shape attributes; visible strokes on frame/component/text/vector layers are explicitly rejected because schema 1.0 has no corresponding fields.
- Instance export now rejects direct component overrides and non-default scale-tool factors that schema 1.0 cannot retain; vector export rejects compound paths instead of exporting only the first path. Real-host fixtures assert native layout-grid variants and text/style token fields. Matrix completion remains in progress.
- Export now also fails with an actionable error for non-normal layer, paint, and shadow blend modes that schema 1.0 cannot represent; this prevents silent visual loss. Automated policy tests pass; live Figma export remains NOT TESTED.
- Frame and component `clipsContent` now survives specification validation, native rendering, and selected-tree export. The field is rejected on groups; live clipping appearance remains NOT TESTED.
- Line import/export now preserves the single visible stroke's opacity; selected export explicitly rejects multiple visible strokes, unsupported stroke types, and non-normal line-stroke blending rather than dropping them. Automated coverage passes; live line rendering remains NOT TESTED.
- Frames, components, and rectangles now validate, render, and export per-corner radii plus corner smoothing; uniform radii retain the compact `radius` form. Live visual round-trip remains NOT TESTED.
- Native node rotation is bounded to -180°–180° and survives validation, render, and selected-tree export. Live Figma rotation behavior remains NOT TESTED.
- Optional Ollama integration has a fake-server integration suite; installed runtime/model behavior is NOT TESTED.
- MCP client identity is a supplied label, not authenticated identity. The loopback pairing token authenticates local bridge access; it does not establish who authored a queued request.

## Planned / blocked

- Live Figma pairing and MCP-driven mutation, screenshot/visual validation, universal Figma compatibility layer and client-specific setup verification remain open.
- A Figma Desktop session cannot be driven by the current executor; user-confirmed UI is not evidence for newly added export/undo features. Real Ollama and client-specific MCP/generated-file access are also not available here.
- Hidden-panel background work is scoped to the currently open Figma document and live plugin session. Closing Figma or the document terminates it; creating/opening a new Draft file automatically requires a separate local desktop runner and is not implemented.
- The compatibility adapter isolates schema Auto Layout modes and primary-axis alignment against the locked Figma typings; other API mappings, Figma-version behavior, token modes, visual accessibility screenshot QA and live renderer preservation still need verification.

## Release gate

Do not mark the product 100% until required capabilities are implemented and acceptance evidence exists. No aggregate completion percentage is published. Progress bars in README count named registry/task gates only; they do not imply release readiness or live integration success.

- Selection-aware edit patches accept rotation changes from -180° to 180°, target only selected-tree nodes, and capture/restore rotation in the existing undo checkpoint. Automated validation and host-source regression tests pass; live Figma application/undo remains NOT TESTED.

- Optional Figma MCP reference handoff accepts bounded user-supplied design notes, not remote MCP calls; automated prompt tests pass. Live cross-client and screenshot fidelity remain NOT TESTED. See [`OFFICIAL-FIGMA-MCP-INTEROP.md`](integrations/OFFICIAL-FIGMA-MCP-INTEROP.md).
