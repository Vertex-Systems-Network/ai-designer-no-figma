# Changelog

## Unreleased — repository intelligence and MCP foundation

- Added canonical cross-agent repository instructions and source-aware project status documents.
- Added the official `@modelcontextprotocol/server` SDK dependency (2.4.0); no MCP server is claimed until its stdio implementation and tests exist.
- Added selected Figma layer export, bounded selection geometry edits and plugin-session undo in the current code line; see README and backlog for verification state.
- Added bounded native SVG and PNG/JPEG/GIF asset imports, validation MCP tools, the AI Assets UI, local recent-import metadata, and explicit client capability reporting. Automated validation exists; native asset rendering has not been live-verified.

## 0.1.0

- Initial local-first Figma plugin, editable basic node renderer, JSON import/validation, external AI handoff, optional local Ollama service, history/tokens and ZIP packaging.
# 0.2.0 work in progress — 2026-11-08

- Added custom stdio MCP tools for connection state, sessions, capabilities, selection inspection, schema import, selected-layer patches/export and job lifecycle.
- Added a token-authenticated loopback bridge with session-correlated queue, payload bounds, origin allowlist and result handling.
- Added plugin pairing settings and an Agent Activity timeline driven by actual bridge events.
- Added bundled MCP server build, docs/source registration auditing, compatibility metadata reporting and release verification.
- Automated verification for the current asset-inclusive source: 26 unit tests and 15 integration tests, typecheck, lint, local security audit, build, packaging, strict docs audit, ZIP integrity and SHA-256 checks pass. Live Figma asset rendering, pairing and client-specific setup remain unverified.
