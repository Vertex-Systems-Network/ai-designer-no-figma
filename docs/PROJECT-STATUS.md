# Project status

Last source audit: 2026-11-08. Implementation evidence is in [`FEATURE-REGISTRY.json`](FEATURE-REGISTRY.json); test evidence is reported independently.

## Completed / verified

- Local-first plugin shell, structured JSON validation/import, provider-neutral prompt copy/paste, history/tokens/theme/settings, native rendering for supported basic node types.
- Optional Ollama loopback service and deterministic HTTP integration tests using a local test double; this does not verify a real model.
- VSN startup loader and plugin UI were confirmed working by the user in Figma.
- Custom stdio MCP server and authenticated loopback bridge: protocol initialization, tested tool discovery, schema rejection, job correlation, session isolation and result return are covered by automated integration tests.
- Settings now accepts the loopback pairing endpoint/token, and Agent Activity receives real bridge status and operation events. This is build-verified; live pairing is not yet tested.
- Bridge polling and HTTP requests now run in the plugin UI iframe; the restricted Figma JSVM host only executes validated Figma document operations and sends correlated results back. Connect now hides the panel after the loopback session is confirmed while the iframe keeps polling. The plugin also reads the signed-in Figma user's display name through the explicit `currentuser` permission. Automated host-runtime regressions pass; live hidden-panel operation is not yet tested.
- Latest `npm run release:verify` passed: typecheck, lint, 40 unit tests, 15 integration tests, local security checks, production build/package, strict docs audit (0 findings), ZIP integrity and SHA-256 verification. The compatibility metadata check also completed; it explicitly does not claim a live Figma compatibility test.
- Added an advisory design-quality audit for low-contrast text against solid ancestor fills, generic layer names, missing explicit font sizes, and multi-child containers without Auto Layout. It is deterministic, non-blocking, and test-covered; it is not a screenshot/rendering or subjective design-quality score.

## Partial

- Design-spec schema still omits image/vector assets, gradients, effects, components and variables. A separate bounded import path now creates sanitized SVG vector nodes and validated PNG/JPEG/GIF image fills; those new imports are automated-tested but NOT TESTED in live Figma.
- Design quality can be checked for several measurable specification issues; visual hierarchy, responsive behavior, overlap, perceived polish and head-to-head Figma Agent quality are NOT TESTED and are not certified by this audit.
- Selection edits support text/fill/name/bounds plus session undo; geometry/undo live preservation is NOT TESTED.
- Auto Layout direction, spacing, padding and primary-axis alignment can be proposed as a safe frame patch; final automated verification and live preservation checks remain.
- The AI Assets view now persists sanitized SVG/raster source bytes locally with SHA-256 deduplication, size/item caps, preview, reuse, select and delete/clear actions. Live Figma insertion/editability remains NOT TESTED.
- Design System now manages locally persisted typography and spacing scales alongside color tokens, and supports up to 20 named local presets with save/load/duplicate/delete. Imported values are bounded, versioned JSON exports include the scales, and generated design prompts receive the user tokens. Native Variables, Figma text styles, and reusable components remain open.
- Export serializes one supported selected layer tree; unsupported node/paint types fail explicitly. Export/import round-trip is NOT TESTED.
- Optional Ollama integration has a fake-server integration suite; installed runtime/model behavior is NOT TESTED.
- MCP client identity is a supplied label, not authenticated identity. The loopback pairing token authenticates local bridge access; it does not establish who authored a queued request.

## Planned / blocked

- Live Figma pairing and MCP-driven mutation, screenshot/visual validation, universal Figma compatibility layer and client-specific setup verification remain open.
- A Figma Desktop session cannot be driven by the current executor; user-confirmed UI is not evidence for newly added export/undo features.
- Hidden-panel background work is scoped to the currently open Figma document and live plugin session. Closing Figma or the document terminates it; creating/opening a new Draft file automatically requires a separate local desktop runner and is not implemented.
- Component/variable/style APIs, API compatibility monitoring and complete accessibility screenshot QA need implementation and environment verification.

## Release gate

Do not mark the product 100% until required capabilities are implemented and acceptance evidence exists. The README phase percentages are approximate scope estimates, not live integration results.
