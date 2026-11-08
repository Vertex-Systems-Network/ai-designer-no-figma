# Changelog

## Unreleased — repository intelligence and MCP foundation

- Added canonical cross-agent repository instructions and source-aware project status documents.
- Added the official `@modelcontextprotocol/server` SDK dependency (2.4.0); no MCP server is claimed until its stdio implementation and tests exist.
- Added selected Figma layer export, bounded selection geometry edits and plugin-session undo in the current code line; see README and backlog for verification state.
- Added bounded native SVG and PNG/JPEG/GIF asset imports, validation MCP tools, the AI Assets UI, local recent-import metadata, and explicit client capability reporting. Automated validation exists; native asset rendering has not been live-verified.
- Moved the bounded asset library into Figma host `clientStorage` through a typed UI message bridge, avoiding iframe IndexedDB/localStorage restrictions. Added SHA-256 integrity checks, persistent image/vector bytes, preview, reuse, deletion and clear actions. Added post-insert Figma node readback checks for dimensions, vector children and native image fills. Added atomic MCP batch queueing and 64 KiB SHA-256-verified raster chunks for transfers up to 5 MiB.
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
