# Product requirements and current acceptance

This document states intended user outcomes and boundaries. It does not duplicate implementation status. Current implementation and test evidence is in [`FEATURE-REGISTRY.json`](FEATURE-REGISTRY.json); open ordered work is in [`EXECUTION-PLAN.md`](EXECUTION-PLAN.md). Earlier checkbox lists were stale and conflicted with implemented schema/rendering work.

## User outcomes

1. Generate editable native Figma designs from a prompt using the AI app the user chooses. The plugin prepares the prompt; user-operated copy/paste is the provider-neutral default.
2. Import validated design JSON without any AI runtime and render editable Figma nodes.
3. Select existing content, request a targeted change, review a structured patch, apply it, and undo plugin-session changes when supported.
4. Manage local history, design tokens/presets, imports/exports, settings, and asset reuse.
5. Optionally connect a local model or custom MCP bridge without making either mandatory.

## Product behavior

- Generate flow includes prompt, category/platform/style preferences, optional model selection, validation feedback, insertion and cancellation where supported.
- Edit flow summarizes the selection, prepares a bounded patch prompt, validates every operation against selected logical IDs, previews, applies, and exposes plugin-session undo. Unsupported or destructive operations fail closed.
- Import/export flow validates versioned JSON, reports field paths, supports local files/paste and exports the selected supported tree. Data that cannot be represented losslessly must fail visibly rather than disappear.
- Design-system flow supports local color, typography/spacing presets and supported Figma-native Variables/Text Styles. UI controls must correspond to working operations.
- History and asset reuse use local persistence; behavior varies by host storage. The companion bridge provides bounded private file persistence where Figma/browser storage is denied.
- Local model and MCP connection indicators report observed states, not simulated success.

## Appearance and design-quality requirements

- The plugin UI is a compact professional Figma tool with clear hierarchy, dense but readable information, semantic colors, consistent spacing, restrained controls, and light/dark themes. It must remain usable at narrow and tall panel sizes without horizontal overflow or clipped primary actions.
- Keyboard navigation, visible focus, accessible labels/contrast, readable validation errors, and reduced-motion support are required. Every visible control must have a real operation and appropriate loading/empty/error/disabled behavior.
- Prompts request category-specific visual hierarchy, consistent typography/spacing/tokens, semantic layer names, editable native nodes, and Auto Layout where suitable. Automated quality checks are advisory; visual quality claims require real rendered screenshots and a defined comparison rubric.

## Architecture, privacy, and safety

- TypeScript/React Figma plugin is the only document mutation boundary. Schema, validation, prompt construction and patch contracts are shared pure modules. Companion runtime and MCP bridge are optional and loopback-bound.
- No paid API, API key, Figma AI/MCP dependency, telemetry, public listener, external asset request, arbitrary model code execution, or mandatory hosted database.
- Validate sizes, IDs, types, nesting, origins, timeouts and operations. Do not overwrite unrelated content. Preserve rollback data before mutation where the Plugin API supports it.
- Keep stdout clean for MCP stdio; send logs to stderr.

## Explicit limits

- A plugin can only mutate the current document while its Figma session is active. Closing Figma or the document ends the plugin session. Opening/creating another Draft file or continuing after closure requires a separate supported desktop runner.
- A local MCP server does not grant arbitrary access to Claude/ChatGPT desktop app files, verified agent identity, or background execution. Each client capability requires independent verification.
- Ollama protocol tests do not establish real model quality, model availability, or hardware use.
- Automated design-spec quality rules are advisory. Visual polish or superiority to Figma Agent requires rendered same-brief comparison and human review.

## Acceptance source

The feature registry status and execution plan exit criteria are authoritative. A feature is `AUTOMATED VERIFIED` only after the named local checks pass; it is `LIVE VERIFIED` only after the actual editor/client and action are recorded. Read [`TESTING-STRATEGY.md`](TESTING-STRATEGY.md) for test classes and [`KNOWN-ISSUES.md`](KNOWN-ISSUES.md) for current limitations.
