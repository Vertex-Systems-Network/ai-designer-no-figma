# AI development handoff

Updated: 2026-11-08. Start with root [`AGENTS.md`](../AGENTS.md), then [project status](PROJECT-STATUS.md), [registry](FEATURE-REGISTRY.json), [roadmap](DEVELOPMENT-ROADMAP.md), and relevant source/tests.

## Current state

- Existing plugin and optional Ollama runtime are preserved.
- User confirmed the VSN startup loader and plugin panel work in Figma.
- Selected export and patch geometry/undo were implemented and passed typecheck/lint/unit/integration/build/audit/package before this handoff update; live Figma verification of these latest controls is still needed.
- Custom MCP stdio server, authenticated loopback bridge, job broker, pairing settings, and Agent Activity timeline are implemented. Protocol, security, session isolation, and job-result behavior pass automated tests. Live Figma pairing and client-specific setup are still NOT TESTED.

## Exact next tasks

1. Reimport `dist/manifest.json` in Figma Desktop and pair Settings with the local token from `~/.ai-designer-no-figma/bridge-token`.
2. Verify a custom MCP client's `figma_get_connection_status`, selection inspect, import, targeted patch, selected export and job result in the live editor.
3. Confirm that Agent Activity shows actual status and result events, and that an invalid token stays disconnected.
4. Verify selected export/import round-trip, bounds edits, undo and unaffected siblings in Figma.
5. Test Ollama only if a local runtime/model is actually available; otherwise record NOT TESTED.
6. Continue feature scope for images/SVG/gradients/components/variables, native design tokens and accessibility/screenshot QA.

## Constraints

No Git CLI/GitHub CLI, official Figma MCP, paid model API, public bind, hidden telemetry, arbitrary model execution, or fabricated integration status. Use direct source/document changes and update README progress, registry, status, known issues, changelog and this handoff as work lands.

## Commands

`npm run verify` runs typecheck, lint, unit/integration tests, build, local audit and package. `npm run docs:validate` enforces project documentation/registry/source references. `npm run release:verify` includes package integrity and required contents. `npm run mcp` starts the custom MCP stdio server and loopback bridge.
