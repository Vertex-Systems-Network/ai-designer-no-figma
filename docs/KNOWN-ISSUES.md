# Known issues and blockers

| ID | Status | Issue | Impact / next action |
|---|---|---|---|
| KI-001 | OPEN | Design schema/renderer omit images, SVG paths, gradients, effects, components, Variables and several layout modes. | Expand schema and adapter with bounded validation and deterministic tests. |
| KI-002 | OPEN | Selected export rejects unsupported nodes/paints and only exports one selected tree. | Add supported asset encoding and multi-page export; test round trips. |
| KI-003 | NOT TESTED | New bounds patch and Undo behavior have not been re-imported into live Figma. | Reimport current package, verify modified and preserved layer IDs. |
| KI-004 | NOT TESTED | Ollama tests use a local fake HTTP service; no installed model has been exercised. | Test only when Ollama/model hardware is available and record exact model. |
| KI-005 | PLANNED | Custom MCP server and plugin bridge are not implemented end-to-end. | Implement secure stdio/bridge vertical slice; do not advertise mutation tools early. |
| KI-006 | ENVIRONMENT BLOCKED | Current executor has no attached native Figma app or GUI session. | User Figma checks are possible by package reimport; no automated live screenshot claim. |
| KI-007 | OPEN | Design system engine is color-token focused; no native Variable collection or typography/spacing library. | Add semantic tokens and Figma-native capability checks. |
| KI-008 | OPEN | No actual visual diff/overflow screenshot analysis or full keyboard/contrast review. | Add deterministic layout checks and optional real vision path. |

The previous blank panel was fixed by deferring the inline module until `#root` exists; the user confirmed the VSN loader and main panel work. This historical issue is closed; new export/undo workflows remain unverified live.
