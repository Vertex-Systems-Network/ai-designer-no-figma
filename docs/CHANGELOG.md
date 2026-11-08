# Changelog

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
