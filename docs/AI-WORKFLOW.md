# AI work tracker

This is the persistent resume point for an AI coding agent. It records verified implementation state, not a promise of completion.

## Resume protocol

1. Read root `AGENTS.md`, `docs/MASTER-ENGINEERING-PROMPT.md`, `docs/EXECUTION-PLAN.md`, then this checkpoint.
2. Select the first `OPEN` unblocked task. Inspect only the relevant implementation/tests/docs. Do not restart broad repository discovery or repeat work already evidenced.
3. Implement a vertical slice, add behavior tests, run focused checks, and run `npm run release:verify` for release-bound changes.
4. Fix failures, record exact evidence, update the feature registry and affected progress/status documents, then publish source and matching archive through the authorized GitHub connector. Never invoke Git CLI/GitHub CLI.
5. If blocked on an external app, record the smallest required observation and continue with the next unblocked task. Do not ask for repeated authorization or claim background work after the current turn ends.

## Current checkpoint

- **Repository:** `Vertex-Systems-Network/ai-designer-no-figma` (public, `main`).
- **Product workflow:** user-operated provider-neutral prompt/JSON handoff; Ollama is optional.
- **Current evidence:** see `docs/PROJECT-STATUS.md` and `docs/FEATURE-REGISTRY.json`; automated and live evidence remain separate.
- **Execution order:** `PLAN-01` docs audit/reconciliation, `CODE-01` host behavior tests, and `CODE-02` schema 1.0 export fidelity are automated verified. Next is `CODE-03` component property/variant support assessment and implementation. Run `LIVE-*` only against the user's desktop and exact build; finish `PUB-01` only when remote ZIP hash matches the tested local artifact.
- **Environment boundary:** this executor cannot control the user's installed Figma app. No latest live Figma result is claimed.

## Evidence log

| Date (UTC) | Work | Evidence |
|---|---|---|
| 2026-11-07 | Created public repository, source distribution and GitHub tracking issues | Repository metadata and GitHub tree/issues verified; no Git CLI used. |
| 2026-11-07 | Built initial editable plugin, schema, import path, optional local runtime, UI, tests and source ZIP | `npm run verify`; `npm audit`; ZIP integrity and SHA-256 checks recorded in `artifacts/`. |
| 2026-11-07 | Changed AI workflow to provider-neutral external handoff by default | `src/shared/prompts.ts`, `src/shared/edit-patch.ts`, Generate/Edit UI paths, and unit tests; full verification still required after this change. |
| 2026-11-07 | Completed verification after the provider handoff change | `npm run verify`, `npm audit`, repeat package hash, and ZIP integrity pass: 12 unit tests, 8 optional-runtime integration tests, 0 dependency vulnerabilities. |
| 2026-11-07 | Fixed Figma UI bundle corruption reported in the imported plugin screenshot | `scripts/build.mjs` now uses callback replacements so `$'` in bundled JavaScript cannot inject HTML into the script tag; build checks reject external JS/CSS refs and require the React root/bundle. `npm run verify`, parsed-HTML check, npm audit, and ZIP integrity pass. The user's Figma instance still needs to reopen this updated package for live confirmation. |
