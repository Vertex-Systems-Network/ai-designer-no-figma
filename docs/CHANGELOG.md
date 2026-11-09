# Changelog

## Unreleased
- Preserved native image crop/reposition transforms in the versioned design spec for standalone image nodes and image paint stacks; the renderer restores them and selected export emits them. Schema checks require CROP mode and an invertible bounded affine transform.
- Added reviewed FILL/FIT/CROP mode and affine image reposition patches for one selected image fill. Crop matrices are finite, invertible 2×3 transforms bounded to ±10; paint opacity, blend and source bytes are preserved, and patch undo restores the original paint. The Edit UI exposes a mode selector and transform editor when an image fill is selected.
- Added reviewed replacement of exactly one existing selected image fill from a validated PNG/JPEG (128 KiB cap), preserving its scale/opacity and enabling patch undo. Live Figma crop appearance and rollback remain NOT TESTED.

- Text nodes and reusable typography tokens now support paragraph spacing; text nodes additionally import/export vertical alignment and fixed/height/auto resize behavior.

- Added schema-backed text letter spacing (pixels/percent), case transforms, and underline/strikethrough with native import and selected-layer export; mixed per-character formatting fails explicitly instead of being flattened.

- Added schema-validated solid outlines for rectangle and ellipse nodes, including opacity, width and alignment. Import renders native strokes; selected-layer export preserves single normal solid strokes and clearly rejects unsupported multi-stroke or blended outlines.
- Added native angular and diamond gradient paints with bounded affine transforms, schema checks, rendering, and selected-tree export round-trip.
- Added native radial-gradient paint stacks with bounded affine transforms, editable Figma paint rendering, validation against singular matrices, and selected-tree export round-trip.
- Added bounded affine 2×3 transforms for linear gradients. Diagonal and rotated linear gradients now preserve their Figma transform through import/export; radial, angular and diamond gradients are supported with bounded transforms.
- Added bounded native effect stacks for inner/drop shadows and normal and progressive layer/background blur. Import/export retains order and supported settings; other unsupported effects are rejected explicitly.
- Added schema-validated embedded PNG/JPEG image paints in ordered fill stacks, including opacity and FIT/FILL/CROP scale modes. Figma export re-embeds bounded raster bytes; unsupported effects and transformed gradients remain explicitly rejected.

## Unreleased
- Added validated schema support and native renderer/export round-trip for up to eight stacked solid, linear-gradient, and embedded PNG/JPEG fills, including independent paint opacity.
- Added bounded stacks of up to four native drop shadows with order/opacity preserved in render and selected-tree export; non-drop-shadow effects remain explicit errors.
- Added a reviewed `swap-component` patch for selected instances and components, with rollback snapshots for the previous main component and component property values.
- Release verification: 62 unit and 17 integration tests passed; typecheck, lint, local audit, build/package, strict docs audit (0 findings), ZIP integrity and SHA-256 passed. Live Figma visual round-trip remains NOT TESTED.

## 2026-11-09 — advanced native renderer and design schema

- Extended design-spec 1.0 with reusable components and instances, bounded SVG path vectors, horizontal/vertical linear gradients, and drop shadows.
- Added native Figma `ComponentNode`, instance, vector-path, gradient-paint, and drop-shadow rendering, plus prompt guidance and honest MCP capability reporting.
- Added positive and negative schema/renderer capability regression cases. Typecheck and focused tests pass; a live Figma render is NOT TESTED because the user is unavailable for that verification.
- Raster image nodes, Figma Variables/styles, and complete selected-tree export round-tripping remain open.

## 2026-11-09 — AI-orchestrated visual feedback loop

- Added Figma frame capture through `exportAsync` as a JPEG preview. The host tries 1024/768/512 px widths and enforces a 700 KiB byte cap, one selected frame, supported aspect ratio and 8192 px maximum preview height.
- Newly rendered pages select and zoom to their first root frame so an AI client can capture immediately.
- Added MCP `figma_capture_selection`; completed capture results are returned by `figma_get_job_result` as an actual image content block. Tool descriptions guide the agent to inspect, make targeted edits and capture again.
- Added byte encoding and preview validation tests. This supports an AI client driven review cycle; it does not make the plugin call Claude or prove live Figma image delivery.

## 2026-11-08 — design quality review slice

- Strengthened provider-neutral generation prompts with concrete hierarchy, grid, semantic naming, readable contrast, realistic content and layer-quality requirements.
- Added a non-blocking design-spec audit for low contrast when solid fills are known, generic layer names, missing explicit font sizes, and multi-child containers without Auto Layout. Findings are shown in Import with exact JSON paths; imports remain valid and insertable.
- Added deterministic positive/negative fixture coverage. This is not screenshot analysis or proof of visual superiority over Figma Agent.

## Unreleased — repository intelligence and MCP foundation

- Moved authenticated MCP bridge polling and network requests out of the Figma JSVM host into the browser-based plugin UI iframe. The host now handles only Figma document work and returns correlated job results to the UI. Added a Connect & hide flow using `figma.ui.hide()`, background heartbeat while jobs run, a Figma toast for each job's working/completed/failed state, and display of the signed-in Figma operator via the declared `currentuser` permission. Added a regression suite preventing browser network/timer globals from returning to the Figma host. Closing Figma or the current document still ends the session; new-file automation needs a separate desktop runner.
- Replaced Figma/browser storage for imported assets with validated, size-bounded persistence in the private local bridge file, because the user's Figma context denies IndexedDB and plugin storage. Pair credentials now persist across bridge restarts, and plugin bridge endpoint validation no longer uses the unavailable Figma JSVM `URL` global. Typecheck, lint, build, MCPB packaging and ZIP packaging pass; live Windows Claude/Figma confirmation is pending.
- Removed the plugin host's `AbortController` dependency from bridge requests; the Figma JSVM now uses a bounded timeout race and reports a useful reconnection message on slow requests.
- Added canonical cross-agent repository instructions and source-aware project status documents.
- Added the official `@modelcontextprotocol/server` SDK dependency (2.4.0); no MCP server is claimed until its stdio implementation and tests exist.
- Added selected Figma layer export, bounded selection geometry edits and plugin-session undo in the current code line; see README and backlog for verification state.
- Added bounded native SVG and PNG/JPEG/GIF asset imports, validation MCP tools, the AI Assets UI, local recent-import metadata, and explicit client capability reporting. Automated validation exists; native asset rendering has not been live-verified.
- Implemented SHA-256 integrity checks, persistent image/vector bytes, preview, reuse, deletion and clear actions. Added post-insert Figma node readback checks for dimensions, vector children and native image fills. Added atomic MCP batch queueing and 64 KiB SHA-256-verified raster chunks for transfers up to 5 MiB.
- Added reviewed frame-only Auto Layout patch operations with validation, application, rollback snapshots and undo support.
- Added locally persisted typography and spacing scales with bounded import/export validation; both scales are attached to local-model and external-AI design prompts.
- Added up to 20 named design-system presets with save/load/duplicate/delete controls.

## 0.1.0

- Initial local-first Figma plugin, editable basic node renderer, JSON import/validation, external AI handoff, optional local Ollama service, history/tokens and ZIP packaging.
# 0.2.0 work in progress — 2026-11-08

- Added custom stdio MCP tools for connection state, sessions, capabilities, selection inspection, schema import, selected-layer patches/export and job lifecycle.
- Added a token-authenticated loopback bridge with session-correlated queue, payload bounds, origin allowlist and result handling.
- Added plugin pairing settings and an Agent Activity timeline driven by actual bridge events.
- Added bundled MCP server build, docs/source registration auditing, compatibility metadata reporting and release verification.
- The 2026-11-08 release verification before the Figma storage compatibility fix passed 31 unit tests and 15 integration tests, typecheck, lint, local security audit, build, packaging, strict docs audit (0 findings), ZIP integrity and SHA-256. The earlier localStorage fallback passed 33 unit tests and 15 integration tests, then was replaced after the user confirmed Figma blocks UI iframe storage. The new Figma clientStorage host bridge and structural readback checks passed 36 unit tests and 15 integration tests, typecheck/lint, local security audit, build/package, strict docs audit (0 findings), ZIP integrity and SHA-256. Live Figma save/reuse confirmation is still pending.

## 2026-11-09 — image, token, responsive layout, and export coverage

- Added schema-backed bounded PNG/JPEG design nodes and deterministic base64/MIME validation.
- Added native color Variable and Text Style creation/binding, responsive constraints, and row/column/grid layout definitions in the Figma renderer.
- Extended supported selected-tree export for images, token references, grids, constraints, component definitions, gradients, vectors and shadows; unsupported data now fails explicitly.
- Added category-specific generation recipes for website, dashboard, mobile app, admin, WordPress admin, e-commerce, landing page and custom interfaces.
- Automated release verification passed with 55 unit and 17 integration tests, typecheck/lint, local audit, build/package, strict docs audit (0 findings), ZIP integrity and SHA-256. Live Figma rendering and export/import round-trip remain NOT TESTED.


## 2026-11-09 — compatibility mappings and local model streaming

- Added a typings-backed compatibility module for schema Auto Layout modes and primary-axis alignment, with deterministic mapping round-trip tests.
- Local Ollama generation now receives the complete provider-neutral schema/category instructions, streams bounded NDJSON to the UI, reports actual output received, and propagates cancellation upstream. Patch prompts now include the supported Auto Layout operation.
- Release verification passed: 55 unit and 17 integration tests, typecheck/lint, local audit, build/package and strict docs audit (0 findings). No local Ollama service or live Figma editor was available for verification.
