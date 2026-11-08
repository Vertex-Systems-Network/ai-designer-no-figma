# AI session log

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
