# AI Designer No Figma — agent rules

Read this file before modifying the repository. Use [`docs/MASTER-ENGINEERING-PROMPT.md`](docs/MASTER-ENGINEERING-PROMPT.md) for the project contract and [`docs/EXECUTION-PLAN.md`](docs/EXECUTION-PLAN.md) for the ordered, actionable worklist. [`docs/FEATURE-REGISTRY.json`](docs/FEATURE-REGISTRY.json) is the capability status source; [`docs/AI-HANDOFF.md`](docs/AI-HANDOFF.md) is the latest exact checkpoint.

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

1. Read `docs/EXECUTION-PLAN.md` and the current handoff. Read only the source/docs needed for the chosen task; do not restart a broad repository audit each turn.
2. Pick the highest-priority unblocked task. If a live environment is unavailable, record the exact blocker and continue with the next local task.
3. Inspect source/tests and implement one reviewable vertical slice. Add deterministic behavior tests; source-string checks alone are insufficient for stateful host operations.
4. Run focused checks first. For release-bound work run `npm run release:verify`. Never call a mock a live integration test.
5. Update the registry and only the docs affected by the change. Keep README task/progress counts and handoff aligned with evidence; don't publish subjective overall percentages.
6. Publish tested source and matching artifacts through the authorized GitHub connector, then verify remote files/hashes. Never use Git CLI/GitHub CLI.
7. Record commands, outcomes, blockers and one exact next task in the handoff/session log. Do not stop at a plan or progress narration when implementation remains unblocked. No work continues after the active execution turn unless a supported automation is explicitly running.

## Compatibility and safety

Keep MCP tool contracts, universal design schema and Figma adapter separately versioned. Only advertise operations implemented end-to-end. Bound recursion, output sizes, request time, queues and retry counts. Commands from external agents must be validated, correlated, idempotent where possible, and visible to the user before destructive changes.

## Minimal next-session reading order

1. `AGENTS.md`
2. `docs/MASTER-ENGINEERING-PROMPT.md`
3. `docs/EXECUTION-PLAN.md`
4. `docs/AI-HANDOFF.md`
5. `docs/FEATURE-REGISTRY.json` entries and code/tests relevant to the chosen task

## Commands

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:integration`
- `npm run build`, `npm run package`, `npm run audit:local`, `npm run verify`
- Repository documentation commands are defined in `package.json`; their audit must fail on broken internal links, missing registry source/test files, or invalid feature statuses.
