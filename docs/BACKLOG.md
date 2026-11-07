# Engineering backlog

Status means evidence in this repository, not an estimate.

| Phase | Scope | Status | Evidence / next gate |
|---|---|---|---|
| 0 | Environment and existing-work audit | PASS | Node/npm available; blank target workspace; organization `open-designer` inspected as a separate desktop/web editor, not a drop-in plugin. |
| 1 | TypeScript foundation, schema, tooling, docs | PASS | Dependency install, strict typecheck, lint, unit tests, runtime integration tests, and build completed. |
| 2 | Plugin lifecycle and native renderer | IN PROGRESS | Host/UI message bridge and native editable renderer implemented; live Figma editor and renderer API test remain. |
| 3 | Versioned specification and validation | IN PROGRESS | JSON Schema 1.0, custom resource/ID/depth validation, and positive/negative tests; broader images/vectors/gradients/components are pending. |
| 4 | Local model integration | IN PROGRESS | Loopback Ollama discovery and structured generation implemented; HTTP integration tested against a local test double; real installed model and streaming remain unverified. |
| 5 | Selection-aware editing and rollback | IN PROGRESS | Bounded selection summary, preview, stable target IDs, explicit patch ops, and rollback on mutation error; visual preview and live preservation test remain. |
| 6 | Design system engine | IN PROGRESS | Local color token CRUD/import/export/apply works; typography scales, spacing presets, components, native Variables, and style reuse remain. |
| 7 | Complete premium UI | IN PROGRESS | Generate, edit, tokens, import/export, history, model status, settings, themes, cancellation, and responsive controls exist; visual QA and remaining settings/actions need work. |
| 8 | Testing and hardening | IN PROGRESS | 7 unit tests, 8 local-runtime integration tests, strict typecheck/lint, zero-vulnerability npm audit, and local privacy audit pass; live Figma/Ollama/UI visual checks remain. |
| 9 | Build and release packaging | PASS | Plugin/runtime bundles, source ZIP, SHA-256 manifest, ZIP integrity, and reproducible archive hash verified. |
| 10 | Final audit and evidence report | IN PROGRESS | Feature-to-evidence traceability and this backlog record verified gates; live Figma, live Ollama, UI screenshot review, and remaining feature gaps are listed explicitly. |

## Acceptance rule

Do not mark a gate PASS based on intent or a code stub. Each row must link to working code and a recorded command result. Live Figma, local Ollama, and environment-dependent checks get explicit `BLOCKED` or `NOT TESTED` states when unavailable.
