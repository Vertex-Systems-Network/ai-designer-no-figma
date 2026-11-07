# AI work tracker

This file is the durable checkpoint for an AI coding agent resuming work without relying on chat history.

## Resume protocol

1. Read this tracker, `docs/BACKLOG.md`, and `docs/ARCHITECTURE.md`.
2. Inspect the current files and recent repository state through the GitHub connector or filesystem. Never use Git CLI.
3. Pick the earliest incomplete acceptance gate, inspect existing implementation and tests, then implement the smallest complete vertical slice.
4. Run the relevant checks. Repair real failures; do not replace implementations with mocks just to pass.
5. Update this tracker with exact file paths, commands, results, and the next unblocked task.
6. Continue while tools and execution time permit. If blocked, record the precise external dependency and a reproducible next action.

## Current checkpoint

- **Repository:** `Vertex-Systems-Network/ai-designer-no-figma` (public, default branch `main`).
- **Starting point:** Empty repository created for this project; no source files were present in the provided workspace.
- **Related source reviewed:** `Vertex-Systems-Network/open-designer` is a large standalone design editor with AI tooling and a different product/privacy architecture. It was not copied because it is not the requested Figma plugin + local-only runtime.
- **Current work:** Establishing typed spec, plugin renderer, UI, local runtime, and automated validation foundations.
- **Most recent checks:** `npm run typecheck`, `npm run lint`, `npm test`, and `npm run test:integration` pass (after the latest UI/renderer changes they must be rerun before release).
- **Next task:** Run the full verification pipeline, inspect the bundled manifest and ZIP, publish all source files, then create GitHub issues for remaining phase gates.

## Evidence log

| Date (UTC) | Work | Evidence |
|---|---|---|
| 2026-11-07 | Created target public repository and verified public visibility/default branch | GitHub UI and GitHub repository metadata |
| 2026-11-07 | Implemented initial TypeScript plugin/runtime/UI foundation | Source files, strict TypeScript check, ESLint, seven unit tests, six local HTTP integration tests with a test Ollama server |
