# AI Designer No Figma — engineering master prompt

## Mission

Develop the existing AI Designer No Figma repository into a reliable, local-first Figma plugin with a companion service and integrations that are optional. Deliver working, testable increments; do not replace implementation with plans, mock-only UI, or unverified success claims.

## Source of truth

Read, in this order: `AGENTS.md`, this prompt, `EXECUTION-PLAN.md`, and `AI-HANDOFF.md`. The feature registry defines implementation status; the execution plan defines priority and acceptance; the handoff defines the next action and recent evidence. If another document conflicts, correct the stale document and follow these sources. Do not maintain competing phase lists or duplicate status estimates.

## Product constraints

- Figma plugin owns all changes to the current Figma document through the official Plugin API.
- The no-key default is user-operated AI handoff: prepare a prompt, let the user choose/use their AI app, validate returned JSON/patches, then render/apply natively. No AI provider is assumed to be available to this process.
- Ollama is an optional local inference adapter. Do not make it a prerequisite or claim real model verification from a fake server.
- The custom MCP/loopback bridge is optional and app-specific. MCP presence proves a tool transport, not automatic access to another app's files, identity, or background execution.
- No required paid API, Figma AI, Figma MCP, telemetry, public listener, hidden remote execution, dynamic evaluation, or prompt-derived shell execution.
- Plugin jobs are bounded to the live Figma app/document/plugin session. Closing Figma or its document ends that session. New Draft-file creation and operation after closure require a separate supported, authenticated desktop runner; never claim plugin-only support.
- Preserve imported/user content. Target selected logical IDs only, validate input/size/depth, expose destructive changes, and support rollback where feasible.

## Execution loop

For each authorized development turn:

1. Resume the first `OPEN` unblocked task in `EXECUTION-PLAN.md`; do not ask for another “start/continue” when prior authorization covers it.
2. Inspect the relevant implementation and tests only. Use a small vertical slice with explicit acceptance evidence.
3. Implement the actual path and add deterministic behavioral tests. Prefer behavioral host/API mocks to source text assertions. Keep a live check separate from automated checks.
4. Run a focused check, then `npm run release:verify` for release-bound changes. Diagnose and repair failures before marking status.
5. Update the feature registry, README tracker, backlog/status/changelog/session log/handoff where relevant. Reconcile stale counts and links; package exactly the verified source.
6. Publish through the authorized GitHub connector and verify source plus binary artifacts remotely. Git CLI and GitHub CLI are prohibited.
7. Continue to another unblocked task while the active turn permits. Before yielding, save one concise, exact checkpoint. Do not claim work continues after the turn ends.

If a dependency is unavailable (live Figma, client login, local model, screenshot renderer), record the exact missing observation, its impact, and the smallest reproducible unblock step. Then continue with independent local work. Do not make the user repeat a test result or request approval for already-authorized reversible work.

## Evidence and status

Use only: `OPEN`, `IMPLEMENTED`, `AUTOMATED VERIFIED`, `LIVE VERIFIED`, `BLOCKED`, `NOT TESTED`, `WONT IMPLEMENT`. Record the exact command, test counts, build/archive hash, app/client, date, and observation as applicable. `IMPLEMENTED` is not verified. Mocks are not live tests. Never claim 100%, superiority, continued background operation, or a completed upload without evidence.

Do not publish an aggregate project-completion percentage. A progress bar is acceptable only when it counts named, checked acceptance criteria in the execution plan. Mark a task done only when all of its exit criteria pass.

## Architecture baseline

Maintain the TypeScript Figma plugin, React UI, versioned JSON Schema, native renderer/exporter, provider-neutral prompt/patch validators, optional loopback runtime, and custom MCP. Keep Figma-specific APIs in `src/plugin/`, shared contracts in `src/shared/`, provider transport in `src/mcp/` and bridge code, and optional model runtime in `src/runtime/`. Do not advertise capabilities without an end-to-end implementation and evidence.

## Appearance and generated-design quality

- The plugin should feel like a compact professional Figma tool: clear hierarchy, high information density, consistent 4px spacing, semantic tokens, restrained controls, working light/dark themes, and no placeholder/decorative actions.
- Keep the panel usable when resized. Prevent horizontal overflow and clipped primary actions. Provide keyboard navigation, visible focus, accessible labels/contrast, readable errors, and reduced-motion support.
- Every displayed control must have a working state and connect to a real operation. Validate both success and error/loading/empty states; visually inspect screenshots only when a real renderer is available.
- Generated design prompts should request coherent category-specific interfaces, semantic names, native editable hierarchy, Auto Layout where appropriate, readable typography and consistent spacing/tokens. The deterministic quality audit is advisory; rendered polish and comparison to Figma Agent require actual screenshots and a documented rubric.

## Definition of done

A repository task is done when implementation, negative/positive tests, typecheck/lint, docs/registry references, and applicable package verification all pass. A live acceptance task is done only after the real client/editor observation is recorded. Release publication is done only when published source and packaged artifact correspond to the same verified source hash. Anything else stays `OPEN`, `BLOCKED`, or `NOT TESTED`.
