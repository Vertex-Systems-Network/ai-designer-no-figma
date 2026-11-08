# Product acceptance checklist

This is the persistent acceptance ledger for the engineering and appearance briefs. A checkbox is not a claim of completion until the linked implementation and evidence exist. `[x]` means implemented in this slice; `[ ]` remains open or only partly covered.

## Product and privacy

- [x] Figma plugin host owns all document mutations; companion inference service is optional.
- [x] Provider-neutral prompt handoff lets users generate/edit with any AI app they can access, without a provider API key or automated provider calls.
- [x] Local Ollama discovery/generation is an optional path, not a prerequisite.
- [x] Structured JSON import and validated patch paste remain available when all model runtimes are absent.
- [x] No telemetry or remote assets in the current implementation.
- [x] Runtime defaults to loopback and rejects non-loopback model/runtime hosts.
- [x] Model output is treated as data, validated, and never evaluated as code.
- [ ] Live privacy/network verification inside an installed Figma plugin.
- [ ] Dependency advisory/licensing review and published SBOM.

## Design specification and rendering

- [x] Versioned JSON Schema 1.0, unique logical IDs, size/depth/node limits, actionable issues.
- [x] Native editable text, frame/group-wrapper, rectangle, ellipse, line nodes; basic Auto Layout.
- [ ] Images, SVG/vector paths, gradients, effects, constraints, responsive rules, grid modes, sections.
- [ ] Native reusable components/instances, component properties, Figma styles, Variables/collections.
- [x] Export one selected supported Figma layer tree as a validated design specification; unsupported layers/paints fail explicitly.
- [ ] Export every page/document node and import/deduplicate local image assets.
- [ ] Renderer tests against official Figma API mocks and a separate live-editor smoke test.

## Generate and AI workflows

- [x] Prompt, category, platform/canvas dimensions, visual direction, brand color, density, typography and complexity inputs.
- [x] Self-contained design and selection-edit prompt builders for external AI apps.
- [x] Fenced JSON import and strict patch validation, including current-selection target checks.
- [x] Optional installed local model list, runtime connection state, model selection, bounded request and cancellation.
- [ ] Streaming responses, retry strategy, detailed capability/error diagnostics, GPU/CPU status.
- [ ] Validate multiple design categories with deterministic fixtures and an installed local model.

## Edit workflow

- [x] Bounded selected-layer summary and stable IDs; edit prompt; explicit patch preview; apply button.
- [x] Supported patch operations include text, fill, layer name, and bounded position/size changes; patch failures attempt rollback.
- [x] Keep up to 20 plugin-session patch checkpoints and expose undo for the latest edit; failed patch application attempts immediate rollback.
- [x] Apply bounded position/size changes to selected IDs through `set-bounds` patches.
- [x] Add safe frame-targeted Auto Layout direction/gap/padding/alignment patches with preview and rollback snapshots.
- [ ] Component replacement, broader frame-level target planning, and live preservation/revert verification.
- [ ] Verify no unrelated layers change in Figma and preview with modified/preserved layer summaries.

## Design system

- [x] Local color tokens can be added, removed, imported, exported, and applied to a selection.
- [x] User-managed typography and spacing scales persist locally, import/export, validate values, and are included in external/local AI design prompts.
- [x] Save, load, duplicate and delete up to 20 named local design-system presets.
- [ ] Radii/elevation/grid presets, reusable component library and variants.
- [ ] Create and reuse Figma Variables, local styles, component presets, and reusable templates.

## UI, accessibility, and history

- [x] Generate, Edit, Design System, Import, History, and Settings screens; shared dark/light semantic tokens.
- [x] Local prompt history and result reuse/export/delete; optional local endpoint/font settings; keyboard focus/reduced motion styles.
- [ ] Revision snapshots, restore, full settings/performance/privacy controls, and capability/error help.
- [ ] Browser/Figma screenshot review at narrow, standard, and tall plugin sizes; contrast and keyboard-only QA.
- [ ] Confirm each product control maps to real native functionality; remove any control that cannot be completed.

## Quality and release

- [x] Typecheck, lint, unit tests, optional sidecar HTTP integration tests, zero-vulnerability npm audit, local privacy audit, source ZIP, SHA-256 (previous release snapshot; current source needs final pass).
- [ ] Test actual Ollama runtime/model, real Figma rendering, patch preservation and release installation.
- [ ] Produce final requirement-by-requirement evidence report and disclose the official plugin ID registration step.

## Prohibited paths

- Never run Git CLI or invoke Git indirectly from scripts.
- Never add Figma AI, Figma MCP, a paid inference API, public-facing local runtime bind, telemetry, or executable model output.
- Never require Ollama or any one AI provider; provider-neutral copy/paste handoff remains available with no API key.
- Never label a mock-backed check as a live Figma or real Ollama verification.
