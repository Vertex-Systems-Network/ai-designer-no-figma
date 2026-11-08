# Engineering backlog

Status means evidence in this repository, not an estimate.

| Phase | Scope | Progress | Status | Evidence / next gate |
|---|---|---:|---|---|
| 0 | Environment and existing-work audit | 100% | PASS | Node/npm available; blank target workspace; organization `open-designer` inspected as a separate desktop/web editor, not a drop-in plugin. |
| 1 | TypeScript foundation, schema, tooling, docs | 100% | PASS | Dependency install, strict typecheck, lint, unit tests, runtime integration tests, and build completed. |
| 2 | Plugin lifecycle and native renderer | 60% | IN PROGRESS | Host/UI bridge and editable renderer work for supported nodes. User confirmed the latest re-imported VSN loader and plugin UI work in Figma. Broader node support and renderer coverage remain. |
| 3 | Versioned specification and validation | 40% | IN PROGRESS | JSON Schema 1.0, bounded validation, and validated export of one supported Figma selection; images/vectors/gradients/components remain. |
| 4 | Provider-neutral AI integration | 65% | IN PROGRESS | Default copy/paste handoff supports generation and selection edits without API keys; optional Ollama uses loopback. Direct desktop bridges are tracked in [issue #8](https://github.com/Vertex-Systems-Network/ai-designer-no-figma/issues/8); live Ollama remains unverified. |
| 5 | Selection-aware editing and rollback | 70% | IN PROGRESS | Geometry-aware selection summary, safe `set-bounds`/text/fill/name patches, preview, rollback snapshots, and up to 20 plugin-session undo checkpoints implemented; component replacement, Auto Layout operations, and live preservation test remain. |
| 6 | Design system engine | 30% | IN PROGRESS | Local color token CRUD/import/export/apply works; typography scales, spacing presets, components, native Variables and style reuse remain. |
| 7 | Complete premium UI | 75% | IN PROGRESS | Generate/Edit, external AI handoff, import/export, tokens, history, themes, settings, VSN startup loader, patch review/undo controls, and responsive controls exist; broader visual/accessibility QA remains. |
| 8 | Testing and hardening | 70% | IN PROGRESS | 16 unit tests, 8 optional-runtime integration tests, typecheck/lint/build/package and local privacy audit pass. User confirmed the loader/UI work in Figma; full renderer/edit preservation and live local-model checks remain. |
| 9 | Build and release packaging | 100% | PASS | Plugin/runtime bundles, source ZIP, SHA-256 manifest, ZIP integrity, and reproducible archive hash verified. |
| 10 | Final audit and evidence report | 40% | IN PROGRESS | Traceability is recorded and the startup UI is user-confirmed live. Close remaining feature gates and report renderer/edit preservation, local-model, screenshot, and registration evidence. A separate Figma Web cloud session failed GPU initialization; no offline edits were synced. |

## Acceptance rule

Progress percentages are estimates of acceptance scope completed, not schedule estimates. Do not mark a gate PASS based on intent or a code stub. Each row must link to working code and a recorded command result. Figma editor validation, direct desktop-app integrations, local Ollama, and environment-dependent checks get explicit `BLOCKED` or `NOT TESTED` states when unavailable. The current agent executor has no attached native apps (`cua.getState()` reports `apps: []`), no graphical display session, and no Figma executable on its PATH, so the user's installed desktop Figma cannot currently be driven from this session. The shared Figma Web session is separate; it authenticated on 2026-11-08, but its cloud renderer failed GPU initialization and retained unsynced offline changes.
