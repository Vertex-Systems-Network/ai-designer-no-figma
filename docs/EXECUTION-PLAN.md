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
| CODE-01 | P1 | Replace source-string-only host assertions for edit/render rollback with behavioral Figma API mock tests | Code | AUTOMATED VERIFIED | Imported the real plugin host against a Figma API mock. Tests apply/undo rename+rotation, preserve an unaffected sibling, roll back text changes after a setter mutates then throws, and remove partially created pages after a later render page fails; focused tests and release verification pass. |
| CODE-02 | P1 | Audit selected-tree export/render fidelity against every supported schema field and fail explicitly on losses | Code | AUTOMATED VERIFIED | [`EXPORT-FIDELITY-MATRIX.md`](EXPORT-FIDELITY-MATRIX.md) maps every shared field group and node type to import/export behavior and explicit rejection boundaries. Regression fixtures cover export tokens/styles, text/layout/grids, vector, image crop/tile, components/instances, gradients/effects and rejection paths. Text export no longer duplicates fill/color; unsupported text/line radius is rejected by schema and runtime validation. Full release verification must pass for this source snapshot. |
| AGENT-01 | P1 | Local agent schema quality preflight based on Figma design/recovery patterns | Code + docs | AUTOMATED VERIFIED | `figma_audit_design_schema` runs without Figma session, returns schema errors and bounded advisory findings; overflow/collision fixtures and MCP integration pass. Live screenshot loop remains `LIVE-01/02`. |
| INTEROP-01 | P2 | Optional official Figma MCP reference handoff without a remote dependency | Code + docs | AUTOMATED VERIFIED | Bounded, user-supplied reference input is included only in the external prompt; URL-only and untrusted-data warnings, tests and interoperability mapping are documented. Live cross-client fidelity remains NOT TESTED. |
| AGENT-02 | P1 | Discover reusable components, variables and styles in the open Figma file | Code | AUTOMATED VERIFIED | Bounded read-only Plugin API inventory returns exact current-page component IDs/names/types/sizes and local variable/style identities, mode IDs, counts and truncation; selection-preservation host and MCP tests pass. Live editor observation is Phase 6. |
| AGENT-03 | P1 | Plan sections, components, tokens and assets before native construction | Code | AUTOMATED VERIFIED | Plan 1.0 maps every top-level frame to a section, checks actual token usage and asset scope, validates component candidates against supplied inventory identities, and returns the embedded validated schema 1.0 design; unit/MCP protocol tests pass. Supplied inventory is not an authenticated live snapshot; native reuse is CODE-03. |
| AGENT-04 | P1 | Visual critique and selected-ID repair loop | Agent + live | PARTIAL | Capture, one measured patch and recapture evidence contract are automated tested. A real vision-capable client/model must inspect a real Figma capture, repair one measured defect through supported operations, recapture and record before/after evidence. |
| AGENT-05 | P2 | Responsive layout and typography fidelity | Code + live | PARTIAL | Two-width bounded absolute composition is automated verified; define remaining sizing/wrapping rules and host tests; verify the same design at two widths with no unintended clipping/overlap in live Figma. |
| AGENT-06 | P2 | Reuse actual local SVG/raster assets in generated designs | Code + live | PARTIAL | Bounded import/library and two-width supplied asset payload composition exist; verify actual save/reload/reuse and placement in a composed native design. No fabricated asset bytes. |
| EVAL-01 | P1 | Compare same briefs with Figma Agent | Evaluation | OPEN | Controlled briefs, canvas sizes, editability/token reuse rubric, screenshots and recorded reviewer observations; publish gaps and repairs without subjective equivalence claims. |
| CODE-03 | P1 | Native bounded component-family variant/property import, readback, export and rollback | Code | AUTOMATED VERIFIED | Separate familyVersion 1.0 contract creates 2–8 Style variants with Label TEXT property, native review instances, readback and portable selected-set export; rejects unsupported properties and removes new page on failure. Existing library reuse and schema 1.0 instance linkage are outside this subset; live editor check is Phase 6. |
| LIVE-01 | P1 | Verify latest build in Figma: generated native layers, import/export, selected edit, undo, and preserved siblings | Live Figma | PARTIAL · LIVE OBSERVED | 2026-11-12, Figma Desktop 126.11.8 on Windows, build from `main` after PR #23. The Design System tab's **Build component kit** rendered native components (buttons, input, card, top bar, table row) and a usage frame of real instances; the board fill was bound to the `Color/Canvas` variable. No layout defect was confirmed. An early note claimed the input field rendered narrower than 320 px, but that came from misreading a screenshot of the board at about 50% zoom, and the renderer already defaults Auto Layout to FIXED sizing. The kit now declares FIXED sizing and fixed-width text explicitly, with a test, so its intent no longer depends on that default. Still to observe: import/export round trip, selected edit, undo and sibling preservation. |
| LIVE-02 | P1 | Verify Claude hidden-panel bridge job and Agent Activity | Live Claude + Figma | PARTIAL · LIVE OBSERVED | 2026-11-12: the plugin paired with the Claude Desktop extension bridge using the 6-digit code, and the panel hid while the plugin kept running. Live diagnosis found that an older plugin build auto-retried pairing without a code, which tripped the lockout and rotated the code; re-importing the current build fixed it. Still to observe: one read-only and one mutating MCP job run from the Claude Desktop chat. |
| LIVE-03 | P2 | Verify asset save/reload/reuse and one chunked image transfer | Live Claude + Figma | BLOCKED · USER DESKTOP | Save SVG and raster, restart/reopen as supported, reuse them, and transfer an image >192 KiB; confirm pixels/vector editability and hash result. |
| LIVE-04 | P2 | Verify optional Ollama against an installed model and screenshot/accessibility in actual panel sizes | Live local machine | BLOCKED · USER MACHINE | Record model/version and observed timings/errors; review light/dark and keyboard/focus at narrow and standard panel widths. |
| PUB-01 | P1 | Publish the exact verified ZIP and checksums beside the source update | GitHub | LIVE VERIFIED | Source/docs and ZIP were committed together on `main`; the uploaded Git blob SHA matches the local ZIP bytes, local SHA-256 matches `artifacts/SHA256SUMS.txt`, and required archive contents/integrity passed. |
| BLOCK-01 | — | Continue after Figma or its document closes; create/open a different Draft file automatically | Separate desktop runner | NOT IMPLEMENTED · OUT OF PLUGIN SCOPE | Requires a supported authenticated desktop automation runner. Do not claim the plugin itself can do this. |
| BLOCK-02 | — | Automatically consume generated files or verified user identity from arbitrary Claude/ChatGPT/other desktop apps | Client integration | NOT VERIFIED | Requires explicit, app-specific file/identity capabilities. Keep user-operated handoff and supplied agent labels honest until each client is tested. |

### Local release evidence at last recorded verification

Latest `npm run release:verify`: 120 unit tests, 21 integration tests, strict typecheck, lint, local privacy/security audit, build/package, docs audit (0 findings), ZIP integrity and SHA-256 passed. This closes the local packaging gate for this exact source snapshot only; it does not close `LIVE-*` or `BLOCK-*` tasks. Re-run after any subsequent change.

## Product boundary decisions

- **Default AI flow:** user selects the AI app, copies the generated prompt, and pastes its structured JSON response. No paid API, provider key, or mandatory local model.
- **Optional local inference:** Ollama remains optional; test doubles verify the protocol only. No local-model success claim without an installed model.
- **Figma ownership:** only the Figma Plugin API mutates the current document. A hidden panel can keep its iframe session alive only while the plugin, Figma app, and current document remain open.
- **Draft/new-file automation:** requires a separate local desktop agent with authenticated Figma control, explicit safety boundaries, and its own tests. It is not a plugin feature and must not be represented as shipped.
- **Quality comparison:** do not claim better than Figma Agent/Claude. A comparison needs same brief, same target, rendered screenshots, a defined rubric, and recorded reviewers/results.
- **Release status:** distinguish automated release verification, live compatibility verification, and publication/registration. No single combined percentage can replace these gates.

## Turn completion rule

For an authorized development request, finish one meaningful code or documentation slice before replying. A brief final summary is allowed after execution; repeated progress narration is not a substitute for changes. If unblocked tasks remain, leave their exact ordered IDs in the handoff so the next “continue” immediately resumes at the first one.
