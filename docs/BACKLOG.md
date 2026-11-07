# Engineering backlog

Status means evidence in this repository, not an estimate.

| Phase | Scope | Status | Evidence / next gate |
|---|---|---|---|
| 0 | Environment and existing-work audit | PASS | Node/npm available; blank target workspace; organization `open-designer` inspected as a separate desktop/web editor, not a drop-in plugin. |
| 1 | TypeScript foundation, schema, tooling, docs | PASS | Dependency install, strict typecheck, lint, unit tests, runtime integration tests, and build completed. |
| 2 | Plugin lifecycle and native renderer | IN PROGRESS | Host/UI message bridge and native editable renderer implemented; live Figma editor and renderer API test remain. |
| 3 | Versioned specification and validation | IN PROGRESS | JSON Schema 1.0, custom resource/ID/depth validation, and positive/negative tests; broader images/vectors/gradients/components are pending. |
| 4 | Provider-neutral AI integration | IN PROGRESS | Default copy/paste handoff supports generation and selection edits with any AI app and no API key; JSON/patch prompts and validators have automated tests. Optional Ollama uses the bounded loopback runtime. Direct desktop bridges are tracked in [issue #8](https://github.com/Vertex-Systems-Network/ai-designer-no-figma/issues/8); live Ollama remains unverified. |
| 5 | Selection-aware editing and rollback | IN PROGRESS | Bounded selection summary, preview, stable target IDs, explicit patch ops, and rollback on mutation error; visual preview and live preservation test remain. |
| 6 | Design system engine | IN PROGRESS | Local color token CRUD/import/export/apply works; typography scales, spacing presets, components, native Variables, and style reuse remain. |
| 7 | Complete premium UI | IN PROGRESS | Generate and Edit offer external AI handoff by default and optional Ollama; import validates fenced JSON; tokens, history, themes, settings, and responsive controls exist; visual QA and remaining settings/actions need work. |
| 8 | Testing and hardening | IN PROGRESS | 12 unit tests, 8 optional-runtime integration tests, strict typecheck/lint, zero-vulnerability npm audit, and local privacy audit pass; live Figma and UI visual checks remain. |
| 9 | Build and release packaging | PASS | Plugin/runtime bundles, source ZIP, SHA-256 manifest, ZIP integrity, and reproducible archive hash verified. |
| 10 | Final audit and evidence report | IN PROGRESS | Feature-to-evidence traceability and this backlog record verified gates; live Figma, live Ollama, UI screenshot review, and remaining feature gaps are listed explicitly. |

## Acceptance rule

Do not mark a gate PASS based on intent or a code stub. Each row must link to working code and a recorded command result. Figma editor validation, direct desktop-app integrations, local Ollama, and environment-dependent checks get explicit `BLOCKED` or `NOT TESTED` states when unavailable. The current agent executor has no attached native apps (`cua.getState()` reports `apps: []`) and no Figma executable on its PATH, so the user's installed desktop Figma cannot currently be driven from this session.
