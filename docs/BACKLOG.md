# Engineering backlog

Status means evidence in this repository, not an estimate.

| Phase | Scope | Progress | Status | Evidence / next gate |
| Design quality | Quality-oriented prompt and spec audit | 70% | AUTOMATED VERIFIED · VISUAL QA OPEN | Deterministic advisory checks and prompt requirements are implemented; rendered screenshots, responsive behavior, and Figma Agent comparison are not verified. |
|---|---|---:|---|---|
| 0 | Environment and existing-work audit | 100% | PASS | Node/npm available; blank target workspace; organization `open-designer` inspected as a separate desktop/web editor, not a drop-in plugin. |
| 1 | TypeScript foundation, schema, tooling, docs | 100% | PASS | Dependency install, strict typecheck, lint, unit tests, runtime integration tests, and build completed. |
| 2 | Plugin lifecycle and native renderer | 76% | IN PROGRESS | Browser networking moved from the Figma JSVM host to the UI iframe; renderer commands still run through the Figma host. User confirmed the base UI; live background operation and asset render remain. |
| 3 | Versioned specification and validation | 40% | IN PROGRESS | JSON Schema 1.0, bounded validation, and validated export of one supported Figma selection; images/vectors/gradients/components remain. |
| 4 | Provider-neutral AI integration and custom MCP | 74% | IN PROGRESS | Provider-neutral handoff, optional Ollama and custom MCP are implemented; bridge polling now continues in the hidden UI iframe. Client-specific setup and live Figma actions remain unverified. |
| 5 | Selection-aware editing and rollback | 80% | IN PROGRESS | Geometry-aware selection summary, safe bounds/text/fill/name/Auto Layout patches, preview, rollback snapshots, and up to 20 plugin-session undo checkpoints implemented; component replacement and live preservation test remain. |
| 6 | Design system engine | 65% | IN PROGRESS | Color token CRUD/import/export/apply, prompt-linked typography/spacing scales and up to 20 local save/load/duplicate/delete presets work; reusable components, native Variables/styles and direct text-style application remain. |
| 7 | Complete premium UI | 90% | IN PROGRESS | Generate/Edit, external AI handoff, import/export, tokens, history, themes, settings, VSN loader, patch review/undo, MCP pairing/activity, signed-in Figma operator display and hide-after-connect exist; broader visual/accessibility QA remains. |
| 8 | Testing and hardening | 88% | IN PROGRESS | 40 unit and 15 integration tests passed after adding the design-quality audit; typecheck/lint/build/package and local privacy audit pass. Full renderer/edit preservation, live hidden bridge pairing and local-model checks remain. |
| 9 | Build and release packaging | 100% | PASS | Plugin/runtime bundles, source ZIP, SHA-256 manifest, ZIP integrity, and reproducible archive hash verified. |
| 10 | Final audit and evidence report | 60% | IN PROGRESS | Traceability and asset release verification pass; startup UI is user-confirmed live. Close remaining feature gates and report renderer/edit preservation, local-model, screenshot, client pairing and registration evidence. A separate Figma Web cloud session failed GPU initialization; no offline edits were synced. |

## Custom MCP workstream

| Work item | Progress | Status / evidence |
|---|---:|---|
| MCP stdio server and actual tool catalog | 100% | Protocol integration test covers initialization, discovery, validation errors and capabilities. |
| Token-authenticated loopback bridge | 100% | Broker and HTTP integration tests cover token/origin rejection, session isolation, correlated delivery and result return. |
| Pairing, hidden background jobs and Figma operator status | 95% | UI iframe performs authenticated loopback polling, host handles document operations, Figma current-user identity is displayed, and Connect hides the panel; live desktop confirmation remains. Closing Figma or its document ends the session. |
| Cross-client installation and Figma live actions | 0% | Not tested in this environment; use installation guide and confirm on desktop. |

## Master Prompt 04 · AI assets

| Phase | Progress | Status / evidence |
|---|---:|---|
| 1 · Repository audit | `██████████` 100% | Existing MCP, bridge, renderer, UI, registry, and tests inspected. |
| 2 · Client capability discovery | `████░░░░░░` 40% | Capability endpoint reports unverified client generation/file access; per-client probes/matrix remain. |
| 3 · Asset transport | `████████░░` 80% | MCP accepts raster files up to 5 MiB, sends files above the 192 KiB direct threshold in 64 KiB chunks, reserves queued jobs atomically, and verifies SHA-256 before native insert. Paired live transfer remains. |
| 4 · SVG vector pipeline | `██████░░░░` 60% | Allowlisted sanitizer and native `createNodeFromSvg` handler; tests pass, live editability untested. |
| 5 · Raster image pipeline | `██████░░░░` 60% | PNG/JPEG/GIF validation plus native image-fill handler; tests pass, live rendering untested. |
| 6 · AI capability routing | `██░░░░░░░░` 20% | Manual handoff is explicit; no generic AI-client asset router is verified. |
| 7 · Agent activity integration | `███░░░░░░░` 30% | Import completion result is surfaced; full transfer/verify lifecycle absent. |
| 8 · Asset intelligence | `█████████░` 90% | SHA-256 keyed local bridge library stores sanitized source bytes in a private companion-service file, deduplicates imports, enforces 50-item/2-MiB source limits, and supports preview/reuse/delete. Figma and browser storage are not used; latest build needs live save/reuse confirmation. |
| 9 · AI Assets UI | `███████░░░` 75% | Import, capability disclosure, local preview/reuse/select/remove and clear-all controls are connected; live screenshot review remains. |
| 10 · Autonomous verification | `████░░░░░░` 40% | SVG/image insertions now query the Figma host for the created node and verify dimensions, vector children or image fill; helper has positive/negative unit cases. Live-editor verification remains. |
| 11 · Compatibility/security | `████░░░░░░` 40% | Bounds, allowlist, and no remote asset fetch; client checks/live security evidence remain. |
| 12 · Testing/release | `██████████` 100% | `npm run release:verify` passed: 37 unit tests, 15 integration tests, typecheck, lint, local audit, build/package, strict docs audit (0 findings), ZIP integrity and SHA-256. Live Figma remains a separate compatibility gate. |
| 13 · Repository intelligence | `██████████` 100% | README, backlog, roadmap, registry, status, known issues, changelog and handoff synchronized; strict documentation audit reported 0 findings. |

## Acceptance rule

Progress percentages are estimates of acceptance scope completed, not schedule estimates. Do not mark a gate PASS based on intent or a code stub. Each row must link to working code and a recorded command result. Figma editor validation, direct desktop-app integrations, local Ollama, and environment-dependent checks get explicit `BLOCKED` or `NOT TESTED` states when unavailable. The current agent executor has no attached native apps (`cua.getState()` reports `apps: []`), no graphical display session, and no Figma executable on its PATH, so the user's installed desktop Figma cannot currently be driven from this session. The shared Figma Web session is separate; it authenticated on 2026-11-08, but its cloud renderer failed GPU initialization and retained unsynced offline changes.
