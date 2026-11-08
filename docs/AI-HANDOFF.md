# AI development handoff

Updated: 2026-11-08. Start with root [`AGENTS.md`](../AGENTS.md), then [project status](PROJECT-STATUS.md), [registry](FEATURE-REGISTRY.json), [roadmap](DEVELOPMENT-ROADMAP.md), and relevant source/tests.

## Current state

- Existing plugin and optional Ollama runtime are preserved.
- User confirmed the VSN startup loader and plugin panel work in Figma.
- Selected export and patch geometry/undo were implemented and passed typecheck/lint/unit/integration/build/audit/package before this handoff update; live Figma verification of these latest controls is still needed.
- New repository-memory system is being established. MCP SDK dependency is installed, but no custom MCP server or plugin bridge exists yet.

## Exact next tasks

1. Finish source-aware documentation/registry audit commands and verify links/status consistency.
2. Implement a real stdio MCP server with a small honest tool catalog and SDK protocol tests.
3. Add a separate loopback bridge, explicit plugin pairing, correlated operation queue, cancellation and payload/time limits.
4. Connect only capabilities that are implemented end-to-end; expose real operation state in the plugin.
5. Reimport the current package in Figma and verify selected export, JSON round-trip, bounds edits, undo, and unaffected layers.
6. Test Ollama only if a local runtime/model is actually available; otherwise record NOT TESTED.

## Constraints

No Git CLI/GitHub CLI, official Figma MCP, paid model API, public bind, hidden telemetry, arbitrary model execution, or fabricated integration status. Use direct source/document changes and update README progress, registry, status, known issues, changelog and this handoff as work lands.

## Commands

`npm run verify` runs typecheck, lint, unit/integration tests, build, local audit and package. `npm run docs:validate` will be the source-of-truth doc validation command once repository-audit implementation is complete.
