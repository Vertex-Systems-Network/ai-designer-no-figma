# Changelog

## Unreleased — repository intelligence and MCP foundation

- Added canonical cross-agent repository instructions and source-aware project status documents.
- Added the official `@modelcontextprotocol/server` SDK dependency (2.4.0); no MCP server is claimed until its stdio implementation and tests exist.
- Added selected Figma layer export, bounded selection geometry edits and plugin-session undo in the current code line; see README and backlog for verification state.

## 0.1.0

- Initial local-first Figma plugin, editable basic node renderer, JSON import/validation, external AI handoff, optional local Ollama service, history/tokens and ZIP packaging.
# 0.2.0 work in progress — 2026-11-08

- Added custom stdio MCP tools for connection state, sessions, capabilities, selection inspection, schema import, selected-layer patches/export and job lifecycle.
- Added a token-authenticated loopback bridge with session-correlated queue, payload bounds, origin allowlist and result handling.
- Added plugin pairing settings and an Agent Activity timeline driven by actual bridge events.
- Added bundled MCP server build, docs/source registration auditing, compatibility metadata reporting and release verification.
- Automated verification: 21 unit tests, 14 integration tests, typecheck, lint, local audit and release package checks pass. Live Figma pairing and client-specific setup remain unverified.
