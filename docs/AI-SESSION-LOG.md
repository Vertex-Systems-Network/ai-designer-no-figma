## 2026-11-09 — image crop transform round-trip

- Extended schema 1.0 image nodes and image paint entries with bounded affine `imageTransform`, available only for CROP mode. Figma rendering applies it and selected export serializes it, preserving crop and reposition through design JSON round trips.
- Added schema, paint-mapping, and host regressions for valid/singular matrices and non-CROP rejection. Typecheck, lint, and 85 unit tests pass; live Figma visual round-trip remains NOT TESTED.

## 2026-11-09 — selected image crop and reposition

- Added `set-image-crop` patches for FILL/FIT or custom CROP with a finite, invertible 2×3 affine transform bounded to ±10. The host targets exactly one visible image fill, preserves image hash and paint metadata, and reuses the fill snapshot/undo path.
- Selection summaries expose current image scale mode and crop matrix. Edit UI includes scale-mode controls, a matrix editor, and reviewed apply; AI patch prompts and MCP capability reporting include the operation.
- Typecheck, lint and 83 unit tests passed at this implementation checkpoint. Live Figma crop appearance and undo remain NOT TESTED.

## 2026-11-09 — safe selected image replacement

- Added a bounded replace-image patch for one target in the selected Figma tree. PNG/JPEG bytes are validated before queuing and again in the host, capped at 128 KiB, and applied only when the target has exactly one visible image fill. Existing scale mode, opacity, blend settings and other fills are preserved; existing plugin patch snapshots enable undo.
- Added Edit-tab file selection for a target image in the current selection summary, provider-neutral patch guidance, MCP capability reporting and negative/positive payload tests.
- Release verification passes with 80 unit and 17 integration tests, typecheck, lint, local security audit, build/package, strict docs audit (0 findings), ZIP integrity and SHA-256 recorded in artifacts/SHA256SUMS.txt. Live Figma replacement and undo remain NOT TESTED.

## 2026-11-09 — text layout controls

- Added paragraph spacing to nodes and typography tokens, plus text vertical alignment and resize mode to individual text nodes. Export preserves node-level settings and refuses mixed paragraph spacing rather than flattening it.
- Release verification passes with 78 unit and 17 integration tests, typecheck, lint, local security audit, build/package, strict docs audit (0 findings), ZIP integrity and SHA-256 recorded in artifacts/SHA256SUMS.txt. Live Figma text overflow/alignment rendering remains NOT TESTED.

## 2026-11-09 — text style fidelity

- Added validated letter spacing in pixel/percent units, text case and text decoration to schema 1.0. Import applies native Figma typography properties; selected export preserves uniform values and rejects mixed per-character styling it cannot represent.
- Prompt guidance and regression coverage updated. Release verification passes with 78 unit and 17 integration tests, typecheck, lint, local security audit, build/package, strict docs audit (0 findings), ZIP integrity and SHA-256 recorded in artifacts/SHA256SUMS.txt. Live Figma typography rendering remains NOT TESTED.

## 2026-11-09 — native shape outlines

- Added bounded rectangle/ellipse stroke color, opacity, weight, and alignment to schema 1.0. The Figma renderer creates native editable strokes and selected-tree export preserves a supported single solid stroke; unsupported multiple/blended strokes fail explicitly.
- Updated provider-neutral prompt guidance and renderer/schema regressions. Typecheck and 76 unit tests pass. Full release verification passes with 76 unit and 17 integration tests, lint, local audit, build/package, strict docs audit (0 findings), ZIP integrity and SHA-256 recorded in artifacts/SHA256SUMS.txt. Live Figma outline fidelity remains NOT TESTED.

## 2026-11-09 — progressive blur effect stacks

- Added schema-validated progressive layer/background blur with bounded start/end radii and normalized start/end offsets. Native Figma renderer and selected-tree export preserve blur kind and metadata.
- Prompt guidance, feature/backlog documentation and release progress now describe the supported effect. `npm run release:verify` passes with 74 unit and 17 integration tests, typecheck, lint, local security audit, build/package, strict docs audit (0 findings), ZIP integrity and SHA-256 recorded in artifacts/SHA256SUMS.txt. Live Figma visual/effect round-trip remains NOT TESTED.

# AI session log

## 2026-11-09 — angular and diamond gradient stacks

- Added bounded angular/diamond gradient paint specs, native Figma rendering and selected-tree export preserving affine transform, ordered stops and opacity. Singular transforms are rejected during validation.
- Schema, renderer and host tests cover both gradient kinds. Other unsupported effects and live Figma visual round-trip remain NOT TESTED.

## 2026-11-09 — radial gradient stacks

- Added schema-validated radial gradient paint items with bounded, invertible affine transforms. Figma rendering creates native radial gradient paints; selected-tree export preserves transform, ordered stops, stop alpha and paint opacity.
- `npm run release:verify` passes with 74 unit and 17 integration tests, typecheck, lint, local audit, production build/package, strict docs audit (0 findings), ZIP integrity and SHA-256. Progressive blur and live Figma visual round-trip remain NOT TESTED.

## 2026-11-09 — affine linear-gradient round-trip

- Added bounded 2×3 affine transforms to linear-gradient specifications, preserving diagonal and rotated Figma linear gradients in paint stacks and legacy single-gradient fields. Renderer applies the supplied transform and exporter serializes it instead of rejecting transformed linear gradients.
- `npm run release:verify` passes with 68 unit and 17 integration tests, typecheck, lint, local audit, build/package, strict docs audit (0 findings), ZIP integrity and SHA-256, recorded in the release manifest. Radial gradients remain unsupported; live Figma visual round-trip is NOT TESTED.

## 2026-11-09 — native blur and inner-shadow stacks

- Added schema-validated ordered effects for inner/drop shadow and normal layer/background blur, capped at four per node. Renderer and selected-tree exporter preserve the supported effect type, order, color, opacity, offsets, spread and blur radius. Progressive blur and unsupported Figma effect variants fail with explicit messages.
- `npm run release:verify` passes with 66 unit and 17 integration tests, typecheck, lint, local audit, production build/package, strict docs audit (0 findings), ZIP integrity and SHA-256 (`e1f9aa9bc28374e057515cdb2072b60a4d1418a695d04f64bf827f9d44c59705`). Live Figma visual/effect round-trip remains NOT TESTED.

## 2026-11-09 — embedded image paint stacks

- Added bounded PNG/JPEG image paints to schema 1.0 paint stacks, including validation of decoded size, image signature/MIME match, scale mode, and opacity.
- Renderer now creates native Figma image paints in the declared stack order. Selected-tree export embeds supported PNG/JPEG fill bytes and preserves scale mode and opacity; legacy single rectangle image export remains supported.
- Unit and integration coverage passes: 63 unit and 17 integration tests. `npm run release:verify` also passes typecheck, lint, local audit, build/package, strict docs audit (0 findings), ZIP integrity and SHA-256 (`d9a23ff4e91be71569e5cae67754eabcb5acba52be191e2ebeec14dcd6de2437`). Live Figma image-fill round-trip remains NOT TESTED.

## 2026-11-09 — bounded paint-stack import/export

- Added a schema-validated `paints` stack for solid and linear-gradient fills, preserving Figma paint order and independent opacity on import/export.
- Schema, renderer, export and host regression tests pass; live Figma visual round-trip remains NOT TESTED.
- Extended schema 1.0 and the native renderer/exporter for up to four ordered drop shadows. Unsupported effect types and larger stacks fail with actionable errors; live Figma verification remains NOT TESTED.

## 2026-11-09 — targeted component replacement

- Added a validated `swap-component` patch requiring both the instance target and replacement component ID to appear in the current selection. The Figma host checks node types and snapshots the original component and properties for rollback.
- Unit, prompt, host and integration suites pass; Figma override heuristics and live undo behavior remain NOT TESTED.

## 2026-11-09 — advanced native design nodes

- Added schema 1.0 support and bounded validation for reusable components/instances, SVG path vectors, linear gradients, and drop shadows. Components must be declared before instances; unsafe path syntax and out-of-order gradient stops are rejected.
- Renderer now maps these values to native Figma component/vector nodes and gradient/shadow paints. Prompts and MCP capability output were updated to reflect the actual feature surface.
- Focused schema/host tests and strict TypeScript checking passed. Live rendering in the user's Figma is NOT TESTED because the user is unavailable; image nodes in the schema, native Variables/styles and complete export round-trip remain.

## 2026-11-09 — bounded visual capture and MCP image return

- Implemented one-frame visual capture in the Figma host. It exports JPG at progressive widths (1024, 768, 512), caps bytes at 700 KiB, validates selection/type/aspect/height, and encodes bytes without TextEncoder/btoa dependencies.
- New renders focus/select the first root frame. Added `figma_capture_selection`, plus MCP result handling that sends the actual captured image to AI clients as `image/jpeg` content. Tool descriptions invite inspect → targeted patch → recapture.
- Added base64, MCP image validation and host-operation regression tests; integration discovery now checks the new capture operation.
- `npm run release:verify` passed: 45 unit and 15 integration tests, typecheck/lint, local audit, production build/package, strict docs audit (0 findings), ZIP integrity and SHA-256. The generated package hash is in `artifacts/SHA256SUMS.txt`. Live verification in the user's Figma/Claude setup remains open. This is agent-driven via tool calls, not a model loop running autonomously inside the plugin.

## 2026-11-08 — design-quality prompt and advisory audit

- Added concrete design instructions to provider-neutral generation prompts and a deterministic non-blocking audit for measurable text contrast, generic names, unspecified sizes, and repeated containers without Auto Layout.
- Import UI now displays path-specific suggestions without blocking valid insertion. Added regression coverage for all findings and validity preservation.
- Validation complete: `npm run release:verify` passes with 45 unit and 15 integration tests, strict typecheck/lint, local security audit, production build/package, strict documentation audit (0 findings), ZIP integrity and SHA-256. Current package checksum is recorded in `artifacts/SHA256SUMS.txt`. No live Figma screenshot review or Figma Agent benchmark was performed.

## 2026-11-08 — hidden Claude/Figma job session and signed-in operator

- Moved authenticated bridge HTTP polling from the restricted Figma JSVM host to the browser UI iframe. The UI now sends typed jobs to the plugin host and posts the actual correlated Figma result back to the bridge; active-job heartbeats continue while rendering.
- Added **Connect & hide panel**. It hides the plugin UI only after pairing/session registration succeeds; Figma's UI iframe continues running. Added the `currentuser` manifest permission and an Agent Activity row showing the signed-in Figma account and active operation. Figma notifications surface working, done and failed states while the panel is hidden.
- Added a regression test that prevents `fetch`, `URL`, `AbortController`, `AbortSignal`, and timer globals from returning to the Figma host. Added a UI-ready handshake so the current-user status is not lost before React installs its message listener.
- Validation: `npm run release:verify` passed with 39 unit and 15 integration tests, typecheck/lint, local security audit, build/package, docs audit (0 findings), ZIP contents and SHA-256. `npm run compatibility:check` completed and correctly reports that it is not a live test. The current artifact checksum is recorded in `artifacts/SHA256SUMS.txt`.
- The environment supplied an npm `http-proxy` config key that npm warned is unknown. Running release verification with the two lowercase/uppercase `NPM_CONFIG_HTTP_PROXY` aliases unset removed the warning without changing project configuration. Figma Desktop is unavailable to this executor, so hidden-mode live completion remains NOT TESTED. Closing Figma/current document ends the plugin session; unattended new Draft-file creation still requires a separately implemented local desktop runner.

## 2026-11-08 — Figma pairing and local asset persistence repair

- Fixed the pairing failure caused by Figma's plugin JSVM lacking the global `URL` constructor; endpoint validation now checks the exact loopback endpoint directly.
- Fixed the next runtime incompatibility: plugin-host bridge requests no longer require `AbortController`, which Figma's JSVM does not provide. A five-second race timeout now reports a reconnect hint without calling the missing global.
- Pairing tokens now persist across Claude Desktop bridge restarts. Asset source bytes use validated, bounded persistence in the private local bridge file because the user's Figma context denies browser and plugin storage.
- TypeScript typecheck, ESLint, production plugin build, Claude `.mcpb` package and source ZIP package pass. Live Windows Claude Desktop/Figma pairing, asset save/reload/reuse, and final import remain pending.

## 2026-11-08 — local SVG and raster asset vertical slice

- Added bounded conservative SVG sanitization and PNG/JPEG/GIF signature, structure, dimension and checksum validation.
- Added UI manual asset import, Figma native SVG/image-fill host operations, bounded custom MCP validate/insert tools, capability reporting, and recent local metadata.
- Added asset capability/transport/architecture/test docs and refreshed README, backlog and roadmap progress bars.
- Full release verification passed: 26 unit and 15 integration tests, typecheck, lint, local audit, build, package, strict docs audit (0 findings), ZIP integrity and SHA-256. Live Figma asset insertion and AI-client generated-file handoff remain NOT TESTED.
- Earlier implementation used Figma host-side clientStorage and was later superseded after the user's development plugin rejected writes due to its missing assigned ID. Current persistence is handled by the paired local bridge as documented in the newer entry above.

## 2026-11-08 — repository-memory and connectivity extension

- **Request:** Continue the project with custom universal MCP connectivity, secure plugin bridge, agent activity, compatibility engineering, documentation registry and handoff automation.
- **Baseline:** React/TypeScript Figma plugin; schema 1.0; basic native renderer; optional Ollama HTTP runtime; tests/build/package; no MCP server or bridge.
- **Preserved recent work:** user-verified VSN loader/UI; bounds patch and plugin-session undo; selected design export. The latter three patch/export behaviors need live Figma re-verification.
- **Current work complete:** canonical AGENTS/client rules, project docs/registry, source-aware docs audit, custom MCP stdio tools, authenticated loopback bridge, plugin pairing and agent activity UI, MCP integration tests, compatibility metadata report, build and release verification.
- **Restrictions:** no Git CLI, no paid AI APIs, no official Figma MCP; report mocks and live checks distinctly.
- **Next:** re-import the latest package in the user's Figma Desktop and verify pairing, agent status, selection inspect, schema import, selected patch/export and job result. This environment cannot operate the user's local Figma session.

## 2026-11-09 — image nodes, design tokens and responsive layout

- Added versioned schema support for bounded PNG/JPEG nodes, named color/text-style tokens, responsive constraints and row/column/grid definitions. Validation checks byte bounds, MIME signatures and token references.
- Renderer creates native Figma image fills, color Variables and Text Styles, applies supported constraints/grids and binds token references. Selected-tree export now preserves supported image/paint/layout/token metadata and returns actionable failures for unsupported cases.
- Added category-specific prompt recipes for website, dashboard, mobile, admin, WordPress admin, e-commerce, landing and custom interfaces.
- `npm run release:verify` passed: 55 unit and 17 integration tests, typecheck/lint, local audit, production build/package, strict docs audit (0 findings), ZIP integrity and SHA-256. Live Figma rendering, token binding and export/import round-trip are NOT TESTED.


## 2026-11-09 — compatibility adapter and streamed local inference

- Extracted schema Auto Layout mode and primary-axis alignment conversions into `src/plugin/compatibility.ts`; round-trip tests compile against the installed official Figma Plugin API typings and reject silent coercion for unmapped native values. This is scoped adapter coverage, not complete compatibility certification.
- Local Ollama requests now share the external design prompt's schema/category guidance and include the UI-supported Auto Layout patch operation. Runtime streams NDJSON, enforces a 500 KB response cap, and propagates browser cancellation to the local model request; the UI reports actual received character counts.
- Typecheck, lint, and 17 MCP/runtime integration tests passed. `npm run release:verify` then passed with 55 unit and 17 integration tests, local audit, build/package, strict docs audit (0 findings), ZIP integrity and SHA-256. A localhost Ollama probe found no model service; live Figma remains unavailable.
