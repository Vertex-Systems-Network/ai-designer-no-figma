# AI work tracker

This is the persistent resume point for an AI coding agent. It records verified implementation state, not a promise of completion.

## Resume protocol

1. Read this file, `docs/BACKLOG.md`, `docs/PRODUCT-SPEC.md`, and `docs/ARCHITECTURE.md`.
2. Inspect workspace files and public repo state through the GitHub connector or filesystem. Never execute Git CLI.
3. Take the earliest incomplete acceptance gate and implement a testable vertical slice.
4. Run relevant checks, fix genuine failures, and record evidence.
5. Update this tracker, backlog, product acceptance checklist, package, checksum, and public repository after meaningful changes.
6. Continue while the tools and execution environment permit. Mark unavailable live checks accurately.

## Current checkpoint

- **Repository:** `Vertex-Systems-Network/ai-designer-no-figma` (public, `main`).
- **Product workflow:** AI app selection is user-controlled. Default generation/editing prepares structured prompts for Claude Desktop or any other AI the user can access. The plugin calls no provider API and needs no API key. User pastes returned JSON into the plugin for validation and native rendering. Ollama is an optional local alternative.
- **Current implementation:** Typed design schema, editable Figma renderer, provider-neutral design/edit prompt builders, bounded pasted-patch validator, React plugin UI, optional loopback Ollama sidecar, tests, packaging, architecture docs, backlog, and GitHub issues.
- **Current unavailable validation:** CUA reports no attached native apps, and the executor has no Figma binary on its path. The user reports installing Figma on their own machine, but this executor cannot see or drive that separate desktop installation. No live Figma result is claimed.
- **Process note:** A read-only `git status --short` invocation was accidentally attempted during this continuation despite the project's Git CLI prohibition. No mutating Git command was run; repository writes and publication used the GitHub connector.
- **Next unblocked task:** Continue implementing the earliest open phase from `docs/BACKLOG.md`; expand schema and native rendering coverage, then run UI visual checks if an application surface becomes available.

## Evidence log

| Date (UTC) | Work | Evidence |
|---|---|---|
| 2026-11-07 | Created public repository, source distribution and GitHub tracking issues | Repository metadata and GitHub tree/issues verified; no Git CLI used. |
| 2026-11-07 | Built initial editable plugin, schema, import path, optional local runtime, UI, tests and source ZIP | `npm run verify`; `npm audit`; ZIP integrity and SHA-256 checks recorded in `artifacts/`. |
| 2026-11-07 | Changed AI workflow to provider-neutral external handoff by default | `src/shared/prompts.ts`, `src/shared/edit-patch.ts`, Generate/Edit UI paths, and unit tests; full verification still required after this change. |
| 2026-11-07 | Completed verification after the provider handoff change | `npm run verify`, `npm audit`, repeat package hash, and ZIP integrity pass: 12 unit tests, 8 optional-runtime integration tests, 0 dependency vulnerabilities. |
| 2026-11-07 | Fixed Figma UI bundle corruption reported in the imported plugin screenshot | `scripts/build.mjs` now uses callback replacements so `$'` in bundled JavaScript cannot inject HTML into the script tag; build checks reject external JS/CSS refs and require the React root/bundle. `npm run verify`, parsed-HTML check, npm audit, and ZIP integrity pass. The user's Figma instance still needs to reopen this updated package for live confirmation. |
