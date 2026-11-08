# Engineering backlog

Status means evidence in this repository, not an estimate.

| Phase | Scope | Progress | Status | Evidence / next gate |
|---|---|---:|---|---|
| 0 | Environment and existing-work audit | 100% | PASS | Node/npm available; blank target workspace; organization `open-designer` inspected as a separate desktop/web editor, not a drop-in plugin. |
| 1 | TypeScript foundation, schema, tooling, docs | 100% | PASS | Dependency install, strict typecheck, lint, unit tests, runtime integration tests, and build completed. |
| 2 | Plugin lifecycle and native renderer | 60% | IN PROGRESS | Host/UI bridge and editable renderer work for supported nodes. User confirmed the latest re-imported VSN loader and plugin UI work in Figma. Broader node support and renderer coverage remain. |
| 3 | Versioned specification and validation | 40% | IN PROGRESS | JSON Schema 1.0, bounded validation, and validated export of one supported Figma selection; images/vectors/gradients/components remain. |
| 4 | Provider-neutral AI integration and custom MCP | 70% | IN PROGRESS | User-operated no-API handoff and optional Ollama remain; custom MCP stdio server is implemented and protocol-tested. Client-specific setup and live Figma actions remain unverified. |
| 5 | Selection-aware editing and rollback | 70% | IN PROGRESS | Geometry-aware selection summary, safe `set-bounds`/text/fill/name patches, preview, rollback snapshots, and up to 20 plugin-session undo checkpoints implemented; component replacement, Auto Layout operations, and live preservation test remain. |
| 6 | Design system engine | 30% | IN PROGRESS | Local color token CRUD/import/export/apply works; typography scales, spacing presets, components, native Variables and style reuse remain. |
| 7 | Complete premium UI | 80% | IN PROGRESS | Generate/Edit, external AI handoff, import/export, tokens, history, themes, settings, VSN loader, patch review/undo, MCP pairing/activity and responsive controls exist; broader visual/accessibility QA remains. |
| 8 | Testing and hardening | 75% | IN PROGRESS | 21 unit and 14 integration tests, typecheck/lint/build/package and local privacy audit pass. Full renderer/edit preservation, live bridge pairing and local-model checks remain. |
| 9 | Build and release packaging | 100% | PASS | Plugin/runtime bundles, source ZIP, SHA-256 manifest, ZIP integrity, and reproducible archive hash verified. |
| 10 | Final audit and evidence report | 50% | IN PROGRESS | Traceability and release verification pass; startup UI is user-confirmed live. Close remaining feature gates and report renderer/edit preservation, local-model, screenshot, client pairing and registration evidence. A separate Figma Web cloud session failed GPU initialization; no offline edits were synced. |

## Custom MCP workstream

| Work item | Progress | Status / evidence |
|---|---:|---|
| MCP stdio server and actual tool catalog | 100% | Protocol integration test covers initialization, discovery, validation errors and capabilities. |
| Token-authenticated loopback bridge | 100% | Broker and HTTP integration tests cover token/origin rejection, session isolation, correlated delivery and result return. |
| Plugin pairing and Agent Activity UI | 80% | Build-verified and connected to host status/events; live re-import/pairing is not tested. |
| Cross-client installation and Figma live actions | 0% | Not tested in this environment; use installation guide and confirm on desktop. |

## Acceptance rule

Progress percentages are estimates of acceptance scope completed, not schedule estimates. Do not mark a gate PASS based on intent or a code stub. Each row must link to working code and a recorded command result. Figma editor validation, direct desktop-app integrations, local Ollama, and environment-dependent checks get explicit `BLOCKED` or `NOT TESTED` states when unavailable. The current agent executor has no attached native apps (`cua.getState()` reports `apps: []`), no graphical display session, and no Figma executable on its PATH, so the user's installed desktop Figma cannot currently be driven from this session. The shared Figma Web session is separate; it authenticated on 2026-11-08, but its cloud renderer failed GPU initialization and retained unsynced offline changes.
