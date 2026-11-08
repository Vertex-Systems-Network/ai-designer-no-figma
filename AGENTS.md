# AI Designer No Figma — agent rules

Read this file before modifying the repository. The current evidence-based status is in [`docs/PROJECT-STATUS.md`](docs/PROJECT-STATUS.md); the next tasks and blockers are in [`docs/AI-HANDOFF.md`](docs/AI-HANDOFF.md).

## Purpose and architecture

This TypeScript project creates editable native Figma layers from validated JSON specifications. Its default AI workflow is a user-operated copy/paste handoff to any AI app. Optional Ollama inference runs locally. The Figma Plugin API is the only document mutation boundary. See [system architecture](docs/SYSTEM-ARCHITECTURE.md) and [feature registry](docs/FEATURE-REGISTRY.json).

## Non-negotiable rules

- Never execute Git CLI or GitHub CLI commands, directly or indirectly. Never invoke scripts that shell out to Git. Keep dependencies registry-based; no Git URL dependency, hooks, or submodules.
- Never require a paid inference API, Figma AI, Figma MCP, cloud inference subscription, or hosted database. The official open-source MCP SDK is allowed; our server must be independent of Figma's official MCP.
- Keep services bound to loopback by default. Validate origins, payloads, IDs, schemas, timeouts, and operation scope. Never evaluate model output or run prompt-derived commands.
- Preserve manual JSON import when every model/runtime is unavailable. Do not claim a capability merely because a type, UI control, or mock exists.
- Keep stdout protocol-clean for stdio MCP. Send diagnostics to stderr.
- Do not claim live Figma, real Ollama, screenshot, or visual verification unless that environment was used. Label unit/mocked checks separately.
- Do not overwrite user data or existing documents. Patch selected IDs only and preserve unaffected content.

## Source map

- `src/plugin/`: Figma Plugin API lifecycle, inspection, rendering, export and patch operations.
- `src/ui/`: React plugin panel, local persistence and user-operated AI handoff.
- `src/shared/`: versioned design types, schema validation, messages, prompts and patch validation.
- `src/runtime/`: optional loopback Ollama service.
- `schema/`: JSON Schema contracts.
- `scripts/`: build, package and local security audit.
- `docs/`: status, architecture, requirements and handoff; update the relevant records with every change.

## Workflow and definition of done

1. Read status, handoff, registry and the relevant module docs before editing.
2. Inspect source and tests; use the smallest safe, typed implementation.
3. Add or update deterministic tests for changed behavior. Run `npm run verify` for release-bound work; at minimum run the directly relevant check and report exact results.
4. Update `docs/FEATURE-REGISTRY.json`, project status, roadmap, known issues, changelog and handoff as applicable. Keep README phase bars and task table synchronized.
5. Run `npm run docs:validate` and build/package when available. Never call a mock a live integration test.
6. Record changed files, commands, results, unresolved gates and exact next steps in `docs/AI-HANDOFF.md` and `docs/AI-SESSION-LOG.md`.

## Compatibility and safety

Keep MCP tool contracts, universal design schema and Figma adapter separately versioned. Only advertise operations implemented end-to-end. Bound recursion, output sizes, request time, queues and retry counts. Commands from external agents must be validated, correlated, idempotent where possible, and visible to the user before destructive changes.

## Required next-session reading order

1. `AGENTS.md`
2. `docs/PROJECT-OVERVIEW.md`
3. `docs/SYSTEM-ARCHITECTURE.md`
4. `docs/PROJECT-STATUS.md`
5. `docs/FEATURE-REGISTRY.json`
6. `docs/DEVELOPMENT-ROADMAP.md`
7. `docs/KNOWN-ISSUES.md`
8. `docs/AI-HANDOFF.md`
9. Relevant integration/module documents and source/tests

## Commands

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:integration`
- `npm run build`, `npm run package`, `npm run audit:local`, `npm run verify`
- Repository documentation commands are defined in `package.json`; their audit must fail on broken internal links, missing registry source/test files, or invalid feature statuses.
