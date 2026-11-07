# Engineering backlog

Status means evidence in this repository, not an estimate.

| Phase | Scope | Progress | Status | Evidence / next gate |
|---|---|---:|---|---|
| 0 | Environment and existing-work audit | 100% | PASS | Node/npm available; blank target workspace; organization `open-designer` inspected as a separate desktop/web editor, not a drop-in plugin. |
| 1 | TypeScript foundation, schema, tooling, docs | 100% | PASS | Dependency install, strict typecheck, lint, unit tests, runtime integration tests, and build completed. |
| 2 | Plugin lifecycle and native renderer | 55% | IN PROGRESS | Host/UI message bridge and native editable renderer implemented; live Figma editor and broader renderer API tests remain. |
| 3 | Versioned specification and validation | 35% | IN PROGRESS | JSON Schema 1.0 and bounded validation; images/vectors/gradients/components remain. |
| 4 | Provider-neutral AI integration | 65% | IN PROGRESS | Default copy/paste handoff supports generation and selection edits without API keys; optional Ollama uses loopback. Direct desktop bridges are tracked in [issue #8](https://github.com/Vertex-Systems-Network/ai-designer-no-figma/issues/8); live Ollama remains unverified. |
| 5 | Selection-aware editing and rollback | 55% | IN PROGRESS | Bounded selection summary, preview, stable target IDs and patch ops implemented; layout edits, revision checkpoints, and live preservation test remain. |
| 6 | Design system engine | 30% | IN PROGRESS | Local color token CRUD/import/export/apply works; typography scales, spacing presets, components, native Variables and style reuse remain. |
| 7 | Complete premium UI | 60% | IN PROGRESS | Generate/Edit, external AI handoff, import, tokens, history, themes, settings and responsive controls exist; remaining actions and visual/accessibility QA remain. |
| 8 | Testing and hardening | 65% | IN PROGRESS | 12 unit tests, 8 optional-runtime integration tests, typecheck/lint, npm audit and local privacy audit pass; live Figma and UI visual checks remain. |
| 9 | Build and release packaging | 100% | PASS | Plugin/runtime bundles, source ZIP, SHA-256 manifest, ZIP integrity, and reproducible archive hash verified. |
| 10 | Final audit and evidence report | 35% | IN PROGRESS | Traceability is recorded; close remaining feature gates and report live Figma, Ollama and UI screenshot evidence. |

## Acceptance rule

Progress percentages are estimates of acceptance scope completed, not schedule estimates. Do not mark a gate PASS based on intent or a code stub. Each row must link to working code and a recorded command result. Figma editor validation, direct desktop-app integrations, local Ollama, and environment-dependent checks get explicit `BLOCKED` or `NOT TESTED` states when unavailable. The current agent executor has no attached native apps (`cua.getState()` reports `apps: []`) and no Figma executable on its PATH, so the user's installed desktop Figma cannot currently be driven from this session.
