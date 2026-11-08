# Known issues and blockers

| ID | Status | Issue | Impact / next action |
|---|---|---|---|
| KI-001 | PARTIAL | Design schema still omits assets, gradients, effects, components, Variables and several layout modes. Standalone SVG/image imports are separate from design JSON. | Add schema-backed support with migration, validation, renderer tests and round-trip checks. |
| KI-002 | OPEN | Selected export rejects unsupported nodes/paints and only exports one selected tree. | Add supported asset encoding and multi-page export; test round trips. |
| KI-003 | NOT TESTED | New bounds patch and Undo behavior have not been re-imported into live Figma. | Reimport current package, verify modified and preserved layer IDs. |
| KI-004 | NOT TESTED | Ollama tests use a local fake HTTP service; no installed model has been exercised. | Test only when Ollama/model hardware is available and record exact model. |
| KI-005 | PARTIAL · NOT TESTED LIVE | Custom MCP and plugin bridge are implemented and automated-tested, but not paired to live Figma in this execution environment. | Re-import `dist/manifest.json`, pair the local bridge in Settings, then verify one inspect, import, patch and export operation. |
| KI-006 | ENVIRONMENT BLOCKED | Current executor has no attached native Figma app or GUI session. | User Figma checks are possible by package reimport; no automated live screenshot claim. |
| KI-007 | PARTIAL | Local color tokens, prompt-linked typography/spacing scales, and named local presets exist; there is no native Variable collection, Figma text-style creation, or reusable component library. | Add native styles/Variables and verify them in Figma. |
| KI-008 | OPEN | No actual visual diff/overflow screenshot analysis or full keyboard/contrast review. | Add deterministic layout checks and optional real vision path. |
| KI-009 | NOT TESTED LIVE | New SVG and PNG/JPEG/GIF import handlers have automated validation coverage but have not been exercised in Figma. | Reimport latest package; insert a vector and small image, inspect editable layers, dimensions and image fills. |
| KI-010 | PARTIAL | MCP image/vector transfer is unchunked and capped at 192 KiB; UI local-file import allows 5 MiB. The previous UI build failed to save library entries because IndexedDB access is denied in this Figma context. Source now uses bounded localStorage with SHA-256 deduplication, preview, reuse and deletion; latest package and live save/reuse check are pending. | Add chunked authenticated MCP transfer; live-test insertion and local reuse in Figma. |
| KI-011 | NOT VERIFIED | AI client native image-generation and generated-file access vary by app and are not detected by this plugin. | Keep the capability matrix explicit; manually save/paste client output until a client adapter is exercised. |

The previous blank panel was fixed by deferring the inline module until `#root` exists; the user confirmed the VSN loader and main panel work. This historical issue is closed; new export/undo workflows remain unverified live.
