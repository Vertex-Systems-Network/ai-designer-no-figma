# Figma Plugin API adapter

**Status: PARTIAL.** `src/plugin/code.ts` currently owns native mutation, selected-node inspection, schema rendering, selected export, bounded patch operations and in-memory session undo. It does not expose an MCP bridge.

The adapter supports basic editable text, frames/groups, rectangles, ellipses, lines and limited Auto Layout. JSON schema is validated before create. Selection patch IDs are checked against the current selection subtree. Render failure removes newly created pages; patch failure attempts to restore captured fields.

Not implemented: components/instances, variables/styles, image/SVG import, gradients/effects, full page/document export, structural/overflow validation and screenshot capture. Use the official typings as compile evidence only; live claims require a Figma editor run.
