# Execution plan and work contract

This is the single actionable plan for AI coding sessions. It replaces duplicated phase estimates with ordered tasks, evidence, and explicit environment boundaries. Product capabilities and implementation status live in [`FEATURE-REGISTRY.json`](FEATURE-REGISTRY.json); build/test evidence lives in [`PROJECT-STATUS.md`](PROJECT-STATUS.md) and [`AI-HANDOFF.md`](AI-HANDOFF.md).

## Why the old plan stalled

- It combined an entire product, design-quality competition, integrations, and release into broad phases without a bounded exit test for each task.
- Several roadmaps tracked overlapping work with incompatible phase numbers and stale test counts.
- Estimated percentages implied precise progress without counting accepted work; live Figma and desktop-app gates then kept phases permanently open.
- “Work continuously/autonomously” implied work could continue after an execution turn. This environment runs only while a turn is active; no background work is implied.
- Plugin-only requirements included continuing after Figma/document closure and opening a new Draft file. Figma ends a plugin session with its host document, so that behavior needs a separate desktop runner and cannot be delivered by plugin code alone.
- AI clients differ in access to local files and agent identity. A connected MCP tool does not prove that a client can retrieve generated files or run while Figma is closed.

## Delivery model

Work in one vertical slice at a time:

1. Pick the highest-priority unblocked task below. Do not wait for a repeated “continue/start” message when the user has already authorized project development.
2. Inspect only the relevant code, tests, docs, and feature-registry entries. Do not redo completed tasks.
3. Implement real behavior; add deterministic tests for the changed path. Prefer behavior tests over source-string assertions for stateful Figma operations.
4. Run the narrow test first. For release-bound work run `npm run release:verify`; fix regressions before recording completion.
5. Update the registry, README task table/progress, backlog, session log, status, changelog, and handoff as applicable. Keep one exact next action.
6. Publish verified repository changes and the matching artifact through the authorized GitHub connector. Never use Git CLI/GitHub CLI.
7. Continue to another unblocked task while the active execution budget permits. Before yielding, save an accurate checkpoint. Do not imply that work continues in the background after the turn ends.

If a task is blocked by Figma, Claude, Ollama, a local desktop, login, or an unavailable client, record the exact missing observation and why it matters, then move to the next unblocked code task. Do not ask the user to repeat authorization or a test they have already reported. Request a specific action only when a real observation is necessary, and give concise, copyable steps.

## Status vocabulary

| Status | Meaning |
|---|---|
| `IMPLEMENTED` | End-to-end code path exists; not a claim that it passed verification. |
| `AUTOMATED VERIFIED` | Exact local command and relevant test suite pass. Name the test type; mocks are not live integration. |
| `LIVE VERIFIED` | A real named app/client and action were observed; record date and outcome. |
| `BLOCKED` | An identified external prerequisite prevents the next observation or action. Include its owner and the precise unblock step. |
| `OPEN` | Work remains feasible in this repository/environment. |
| `NOT TESTED` | No evidence has been collected. This is not equivalent to pass or blocked. |
| `WONT IMPLEMENT` | Deliberately excluded with rationale and an approved alternative. |

Never convert `IMPLEMENTED` to `LIVE VERIFIED` based on unit tests, a successful build, source inspection, or a user report about a different build.

## Ordered task board

Progress bars, if shown, must count checked criteria listed in the corresponding task; they are never subjective percentages. A task is complete only when every criterion in its exit evidence is satisfied.

| ID | Priority | Task | Class | Status | Exit evidence / next action |
|---|---:|---|---|---|---|
| PLAN-01 | P0 | Reconcile duplicated/stale roadmap, product acceptance checklist, feature registry and prompts | Repository | AUTOMATED VERIFIED | Canonical master prompt and task board added; old estimated phase list removed; stale product checklist and test counts corrected; agent rules/handoff aligned; `npm run docs:validate` passed with 0 findings. |
| CODE-01 | P1 | Replace source-string-only host assertions for edit/render rollback with behavioral Figma API mock tests | Code | OPEN | Mock applies a real patch sequence, proves untouched sibling state, and proves rollback after a mid-operation failure; run focused tests and release verification. |
| CODE-02 | P1 | Audit selected-tree export/render fidelity against every supported schema field and fail explicitly on losses | Code | OPEN | A field-by-field matrix has a positive round-trip fixture or a specific rejection test; update feature registry and compatibility docs. |
| CODE-03 | P2 | Implement component properties/variants only where the official Plugin API supports deterministic import, instance binding, export, and rollback | Code | OPEN | Schema/API mapping, positive/negative tests, round-trip or explicit unsupported error; do not advertise partial controls. |
| LIVE-01 | P1 | Verify latest build in Figma: generated native layers, import/export, selected edit, undo, and preserved siblings | Live Figma | BLOCKED · USER DESKTOP | User must re-import the latest `dist/manifest.json` build and run the listed smoke sequence; record the exact build hash and observed outcomes. |
| LIVE-02 | P1 | Verify Claude hidden-panel bridge job and Agent Activity | Live Claude + Figma | BLOCKED · USER DESKTOP | Pair once, hide the panel, call one read-only status/selection tool and one safe mutation, then reopen and confirm result. A closed Figma/document is outside this plugin session. |
| LIVE-03 | P2 | Verify asset save/reload/reuse and one chunked image transfer | Live Claude + Figma | BLOCKED · USER DESKTOP | Save SVG and raster, restart/reopen as supported, reuse them, and transfer an image >192 KiB; confirm pixels/vector editability and hash result. |
| LIVE-04 | P2 | Verify optional Ollama against an installed model and screenshot/accessibility in actual panel sizes | Live local machine | BLOCKED · USER MACHINE | Record model/version and observed timings/errors; review light/dark and keyboard/focus at narrow and standard panel widths. |
| PUB-01 | P1 | Publish the exact verified ZIP and checksums beside the source update | GitHub | LIVE VERIFIED | Source/docs and ZIP were committed together on `main`; the uploaded Git blob SHA matches the local ZIP bytes, local SHA-256 matches `artifacts/SHA256SUMS.txt`, and required archive contents/integrity passed. |
| BLOCK-01 | — | Continue after Figma or its document closes; create/open a different Draft file automatically | Separate desktop runner | NOT IMPLEMENTED · OUT OF PLUGIN SCOPE | Requires a supported authenticated desktop automation runner. Do not claim the plugin itself can do this. |
| BLOCK-02 | — | Automatically consume generated files or verified user identity from arbitrary Claude/ChatGPT/other desktop apps | Client integration | NOT VERIFIED | Requires explicit, app-specific file/identity capabilities. Keep user-operated handoff and supplied agent labels honest until each client is tested. |

### Local release evidence at last recorded verification

`npm run release:verify`: 101 unit tests, 17 integration tests, strict typecheck, lint, local privacy/security audit, build/package, docs audit (0 findings), ZIP integrity and SHA-256 passed. This closes the local packaging gate for that exact source snapshot only; it does not close `LIVE-*` or `BLOCK-*` tasks. Re-run after any subsequent change.

## Product boundary decisions

- **Default AI flow:** user selects the AI app, copies the generated prompt, and pastes its structured JSON response. No paid API, provider key, or mandatory local model.
- **Optional local inference:** Ollama remains optional; test doubles verify the protocol only. No local-model success claim without an installed model.
- **Figma ownership:** only the Figma Plugin API mutates the current document. A hidden panel can keep its iframe session alive only while the plugin, Figma app, and current document remain open.
- **Draft/new-file automation:** requires a separate local desktop agent with authenticated Figma control, explicit safety boundaries, and its own tests. It is not a plugin feature and must not be represented as shipped.
- **Quality comparison:** do not claim better than Figma Agent/Claude. A comparison needs same brief, same target, rendered screenshots, a defined rubric, and recorded reviewers/results.
- **Release status:** distinguish automated release verification, live compatibility verification, and publication/registration. No single combined percentage can replace these gates.

## Turn completion rule

For an authorized development request, finish one meaningful code or documentation slice before replying. A brief final summary is allowed after execution; repeated progress narration is not a substitute for changes. If unblocked tasks remain, leave their exact ordered IDs in the handoff so the next “continue” immediately resumes at the first one.
