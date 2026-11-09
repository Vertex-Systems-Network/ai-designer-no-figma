# Project status

Last source audit: 2026-11-09. Implementation evidence is in [`FEATURE-REGISTRY.json`](FEATURE-REGISTRY.json); test evidence is reported independently.

## Completed / verified

- Local-first plugin shell, structured JSON validation/import, provider-neutral prompt copy/paste, history/tokens/theme/settings, native rendering for supported basic node types.
- Optional Ollama loopback service now receives the full schema/category prompt, streams bounded NDJSON output to the UI, and propagates cancellation; deterministic HTTP integration tests use a local test double and do not verify a real model.
- VSN startup loader and plugin UI were confirmed working by the user in Figma.
- Custom stdio MCP server and authenticated loopback bridge: protocol initialization, tested tool discovery, schema rejection, job correlation, session isolation and result return are covered by automated integration tests.
- Settings now accepts the loopback pairing endpoint/token, and Agent Activity receives real bridge status and operation events. This is build-verified; live pairing is not yet tested.
- Bridge polling and HTTP requests now run in the plugin UI iframe; the restricted Figma JSVM host only executes validated Figma document operations and sends correlated results back. Connect now hides the panel after the loopback session is confirmed while the iframe keeps polling. The plugin also reads the signed-in Figma user's display name through the explicit `currentuser` permission. Automated host-runtime regressions pass; live hidden-panel operation is not yet tested.
- `npm run release:verify` passes for this change set: 55 unit tests, 17 integration tests, typecheck, lint, local audit, build/package, strict docs audit (0 findings), ZIP integrity and SHA-256. Live Figma validation remains separate and NOT TESTED.
- Added an advisory design-quality audit for low-contrast text against solid ancestor fills, generic layer names, missing explicit font sizes, and multi-child containers without Auto Layout. It is deterministic, non-blocking, and test-covered; it is not a screenshot/rendering or subjective design-quality score.
- Added an AI-orchestrated visual feedback path: after render, the first root frame is selected; Claude MCP can request a JPEG preview of one selected frame, bounded to 1024 px wide / 700 KiB, and `figma_get_job_result` returns it as an MCP image block. The agent can inspect that image, submit a targeted patch, and capture again. This does not run without an AI client invoking the tools, and live Figma capture/image review remain NOT TESTED.

## Partial

- Design-spec schema 1.0 now validates native components/instances, bounded SVG paths, PNG/JPEG image payloads capped at 256 KiB each, gradients, shadows, named color/text tokens, responsive constraints and frame grids. The renderer creates native nodes, local color Variables and Text Styles; live Figma rendering remains NOT TESTED.
- Design quality can be checked for several measurable specification issues; visual hierarchy, responsive behavior, overlap, perceived polish and head-to-head Figma Agent quality are NOT TESTED and are not certified by this audit.
- Visual screenshot critique is available through MCP tool calls; no autonomous plugin-side retry policy or visual-model invocation is built in. Actual export size behavior, image delivery to Claude Desktop, and repair cycles require live validation.
- Selection edits support text/fill/name/bounds plus session undo; geometry/undo live preservation is NOT TESTED.
- Auto Layout direction, spacing, padding and primary-axis alignment can be proposed as a safe frame patch; final automated verification and live preservation checks remain.
- The AI Assets view now persists sanitized SVG/raster source bytes locally with SHA-256 deduplication, size/item caps, preview, reuse, select and delete/clear actions. Live Figma insertion/editability remains NOT TESTED.
- Design System manages locally persisted typography/spacing scales and up to 20 named presets. Spec imports create/reuse native color variables and text styles and bind layer fills/text to named tokens. Live document behavior is NOT TESTED.
- Selected-tree export now serializes frames, groups, components, supported instances, vectors, embedded PNG/JPEG, linear gradients, drop shadows, grids/constraints and referenced local color/text tokens. It deliberately fails on multiple fills, unsupported effects, token modes that cannot be resolved, or instances without an accessible main component. Export/render round-trip is automated-fixture covered but NOT TESTED in live Figma.
- Optional Ollama integration has a fake-server integration suite; installed runtime/model behavior is NOT TESTED.
- MCP client identity is a supplied label, not authenticated identity. The loopback pairing token authenticates local bridge access; it does not establish who authored a queued request.

## Planned / blocked

- Live Figma pairing and MCP-driven mutation, screenshot/visual validation, universal Figma compatibility layer and client-specific setup verification remain open.
- A Figma Desktop session cannot be driven by the current executor; user-confirmed UI is not evidence for newly added export/undo features. Real Ollama and client-specific MCP/generated-file access are also not available here.
- Hidden-panel background work is scoped to the currently open Figma document and live plugin session. Closing Figma or the document terminates it; creating/opening a new Draft file automatically requires a separate local desktop runner and is not implemented.
- The compatibility adapter isolates schema Auto Layout modes and primary-axis alignment against the locked Figma typings; other API mappings, Figma-version behavior, token modes, visual accessibility screenshot QA and live renderer preservation still need verification.

## Release gate

Do not mark the product 100% until required capabilities are implemented and acceptance evidence exists. The README phase percentages are approximate scope estimates, not live integration results.
