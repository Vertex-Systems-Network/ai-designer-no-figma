# AI development handoff

Updated: 2026-11-08. Start with root [`AGENTS.md`](../AGENTS.md), then [project status](PROJECT-STATUS.md), [registry](FEATURE-REGISTRY.json), [roadmap](DEVELOPMENT-ROADMAP.md), and relevant source/tests.

## Current state

- Existing plugin and optional Ollama runtime are preserved.
- User confirmed the VSN startup loader and plugin panel work in Figma.
- Selected export and patch geometry/undo were implemented and passed typecheck/lint/unit/integration/build/audit/package before this handoff update; live Figma verification of these latest controls is still needed.
- Custom MCP stdio server, authenticated loopback bridge, job broker, pairing settings, and Agent Activity timeline are implemented. Protocol, security, session isolation, and job-result behavior pass automated tests. Live Figma pairing and client-specific setup are still NOT TESTED.
- Manual SVG and PNG/JPEG/GIF imports are implemented with shared input bounds, a 5 MiB MCP/local-file raster limit with 64 KiB SHA-256 checked chunks above the 192 KiB direct-transfer threshold, and a bounded Figma `clientStorage` library routed through the plugin host message bridge, keyed by SHA-256 for persistent bytes, preview, reuse and deletion. The UI iframe does not access localStorage or IndexedDB for asset records. The clientStorage host bridge, asset readback, and chunked transfer changes are awaiting the final release verification in this round. AI-client native file generation/access/automatic transfer and live native Figma asset save/reuse remain NOT VERIFIED; clientStorage may require the Figma-assigned plugin ID.
- Selection patches now include reviewed frame-only Auto Layout mode/gap/padding/alignment changes and include layout state in rollback snapshots; live Figma preservation remains NOT TESTED.
- Design-system color, typography and spacing tokens are locally persisted and included in both manual AI handoff and optional Ollama generation. Up to 20 named local presets can be saved, loaded, duplicated and deleted. Native Figma text styles/Variables are still not created.
- Previous `npm run release:verify` result: 31 unit tests, 15 integration tests, typecheck/lint, production build, local audit, strict docs audit (0 findings), ZIP integrity and SHA-256 all passed before the storage fallback change. Latest verification after the storage fix: 35 unit tests and 15 integration tests, typecheck/lint, production build, local audit, strict docs audit (0 findings), ZIP integrity and SHA-256 all pass.

## Exact next tasks

1. Reimport `dist/manifest.json` in Figma Desktop and pair Settings with the local token from `~/.ai-designer-no-figma/bridge-token`.
2. Verify a custom MCP client's `figma_get_connection_status`, selection inspect, import, targeted patch, selected export and job result in the live editor.
3. Confirm that Agent Activity shows actual status and result events, and that an invalid token stays disconnected.
4. Verify selected export/import round-trip, bounds edits, undo and unaffected siblings in Figma.
5. Test Ollama only if a local runtime/model is actually available; otherwise record NOT TESTED.
6. Verify new SVG/raster insertion and Auto Layout patch/undo in Figma. Remaining engineering items are live paired large-file transfer verification, schema-backed assets, gradients/components/variables, and accessibility/screenshot QA.

## Constraints

No Git CLI/GitHub CLI, official Figma MCP, paid model API, public bind, hidden telemetry, arbitrary model execution, or fabricated integration status. Use direct source/document changes and update README/backlog/roadmap progress bars, registry, status, known issues, changelog and this handoff as work lands.

## Commands

`npm run verify` runs typecheck, lint, unit/integration tests, build, local audit and package. `npm run docs:validate` enforces project documentation/registry/source references. `npm run release:verify` includes package integrity and required contents. `npm run mcp` starts the custom MCP stdio server and loopback bridge.
