# Project status

Last source audit: 2026-11-08. Implementation evidence is in [`FEATURE-REGISTRY.json`](FEATURE-REGISTRY.json); test evidence is reported independently.

## Completed / verified

- Local-first plugin shell, structured JSON validation/import, provider-neutral prompt copy/paste, history/tokens/theme/settings, native rendering for supported basic node types.
- Optional Ollama loopback service and deterministic HTTP integration tests using a local test double; this does not verify a real model.
- VSN startup loader and plugin UI were confirmed working by the user in Figma.
- Custom stdio MCP server and authenticated loopback bridge: protocol initialization, tested tool discovery, schema rejection, job correlation, session isolation and result return are covered by automated integration tests.
- Settings now accepts the loopback pairing endpoint/token, and Agent Activity receives real bridge status and operation events. This is build-verified; live pairing is not yet tested.
- Current verification passed: typecheck, lint, 26 unit tests, 15 integration tests, local security checks, production build, package, strict docs audit (0 findings), ZIP integrity and SHA-256 verification.

## Partial

- Design-spec schema still omits image/vector assets, gradients, effects, components and variables. A separate bounded import path now creates sanitized SVG vector nodes and validated PNG/JPEG/GIF image fills; those new imports are automated-tested but NOT TESTED in live Figma.
- Selection edits support text/fill/name/bounds plus session undo; geometry/undo live preservation is NOT TESTED.
- Export serializes one supported selected layer tree; unsupported node/paint types fail explicitly. Export/import round-trip is NOT TESTED.
- Optional Ollama integration has a fake-server integration suite; installed runtime/model behavior is NOT TESTED.
- MCP client identity is a supplied label, not authenticated identity. The loopback pairing token authenticates local bridge access; it does not establish who authored a queued request.

## Planned / blocked

- Live Figma pairing and MCP-driven mutation, screenshot/visual validation, universal Figma compatibility layer and client-specific setup verification remain open.
- A Figma Desktop session cannot be driven by the current executor; user-confirmed UI is not evidence for newly added export/undo features.
- Component/variable/style APIs, API compatibility monitoring and complete accessibility screenshot QA need implementation and environment verification.

## Release gate

Do not mark the product 100% until required capabilities are implemented and acceptance evidence exists. The README phase percentages are approximate scope estimates, not live integration results.
