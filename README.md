# AI Designer No Figma

Generate and edit native, editable Figma layers with the AI app you already use. The default workflow needs no provider API, key, Ollama install, Figma AI credits, or Figma MCP: prepare a structured prompt, send it yourself to Claude Desktop or another assistant, then paste its JSON answer back for validation and insertion. Optional local Ollama inference is also available.

## Current release

- Public repository: [Vertex-Systems-Network/ai-designer-no-figma](https://github.com/Vertex-Systems-Network/ai-designer-no-figma)
- GitHub package snapshot: [AI Designer No Figma 0.1.0 ZIP](artifacts/ai-designer-no-figma-0.1.0.zip) (source changes may be newer; use `npm run package` to rebuild.)
- Open work: [GitHub Issues](https://github.com/Vertex-Systems-Network/ai-designer-no-figma/issues) and [engineering backlog](docs/BACKLOG.md)

## Project progress

**Overall completion: 78%** — rounded mean of the 11 phase estimates below. Asset reuse, reviewed Auto Layout edits, and prompt-linked typography/spacing scales with local presets are implemented; live editor/client and remaining product gates remain. It is not a release-readiness claim.

| Phase | Progress | Status | Remaining gate |
|---|---:|---|---|
| 0 · Environment audit | `████████████████████` 100% | PASS | — |
| 1 · Engineering foundation | `████████████████████` 100% | PASS | — |
| 2 · Figma plugin and renderer | `███████████████░░░░░` 75% | IN PROGRESS | Broader native node support and live asset-render verification |
| 3 · Specification and validation | `████████░░░░░░░░░░░░` 40% | IN PROGRESS | Images, vectors, gradients, components, styles, variables |
| 4 · AI integration | `██████████████░░░░░░` 70% | IN PROGRESS | Additional client interoperability and live local-model checks |
| 5 · Selection editing | `████████████████░░░░` 80% | IN PROGRESS | Component replacement and live preservation test |
| 6 · Design system | `█████████████░░░░░░░` 65% | IN PROGRESS | Native reusable components, variables/styles, and applying typography tokens directly to Figma |
| 7 · Application UI | `██████████████████░░` 88% | IN PROGRESS | Pairing/activity/asset UI needs Figma live confirmation and accessibility review |
| 8 · Testing and hardening | `█████████████████░░░` 85% | IN PROGRESS | Broader renderer preservation and real local-model checks remain environment-dependent |
| 9 · Build and packaging | `████████████████████` 100% | PASS | — |
| 10 · Final audit | `████████████░░░░░░░░` 60% | IN PROGRESS | Complete live Figma and client interoperability evidence |

Progress percentages estimate completed acceptance scope for each phase; they are not schedule estimates. A phase reaches 100% only when its acceptance gate is verified. See [the backlog](docs/BACKLOG.md) for evidence and [open issues](https://github.com/Vertex-Systems-Network/ai-designer-no-figma/issues) for tracked work.

## Current task tracker

| Task | Progress | Status | Evidence / next step |
|---|---:|---|---|
| Manual SVG and raster asset import | `██████░░░░` 60% | IMPLEMENTED · AUTOMATED VERIFIED | Strict SVG sanitization and PNG/JPEG/GIF validation feed native Figma nodes; re-import and inspect in live Figma. |
| MCP asset validation and transfer | `█████░░░░░` 50% | IMPLEMENTED · AUTOMATED VERIFIED | Vector/image validation and bounded insertion tools exist; live paired transfer and larger-file chunking remain. |
| Asset registry and client capability discovery | `█████████░` 90% | FIXED · VERIFICATION PENDING | Replaced IndexedDB and TextEncoder in the Figma UI save path with bounded localStorage and a runtime-safe UTF-8 helper; adds 50-item / 2 MiB library cap, checksum validation, preview, reuse and deletion. Re-import current build and confirm save/reuse in Figma. |
| VSN-branded startup loader | `██████████` 100% | PASS · LIVE VERIFIED | User confirmed the re-imported plugin works in Figma. |
| Workspace reveal and interface transitions | `██████████` 100% | PASS · LIVE VERIFIED | User confirmed the plugin works after the loader; reduced-motion preferences are respected. |
| Selection patches, Auto Layout, and session undo | `████████░░` 80% | IMPLEMENTED · AUTOMATED VERIFIED | Safe frame-only Auto Layout mode/gap/padding/alignment edits are previewed before apply and included in rollback snapshots; targeted preservation and undo need a fresh live Figma check. |
| Design-system typography, spacing and presets | `████████░░` 80% | IMPLEMENTED · AUTOMATED VERIFIED | Local scales and up to 20 named presets save/load/duplicate/delete; scales validate, import/export and enter AI prompts. Native Figma text styles remain open. |
| Selected Figma design export | `████████░░` 80% | IMPLEMENTED · BUILD VERIFIED | Exports one selection to validated schema; unsupported layers fail explicitly. Live export/import round-trip remains untested. |
| Custom MCP stdio server | `██████████` 100% | IMPLEMENTED · AUTOMATED VERIFIED | MCP SDK tool discovery, input rejection, session status and capabilities pass protocol integration tests. Client-specific install/live invocation is pending. |
| Local Figma bridge | `██████████` 100% | IMPLEMENTED · AUTOMATED VERIFIED | Loopback HTTP, 256-bit pairing token, origin allowlist, payload limits, per-session correlation, and results pass integration tests. |
| Agent pairing and activity | `████████░░` 80% | IMPLEMENTED · BUILD VERIFIED | Pairing form/activity timeline are connected to real bridge events; live re-import and pairing test remains. |
| Automated verification | `██████████` 100% | PASS | 33 unit tests, 15 integration tests, typecheck, lint, local audit, production build, strict docs audit (0 findings), ZIP integrity and SHA-256 passed. |

This tracker records implementation evidence separately from live Figma verification. Update it alongside each task change; do not mark a live check complete from a local build alone.

## Master Prompt 04 · AI assets progress

| Phase | Progress | Status | Evidence / next gate |
|---|---:|---|---|
| 1 · Repository audit | `██████████` 100% | PASS | Existing MCP, bridge, renderer, UI, registry, and tests inspected. |
| 2 · Client capability discovery | `████░░░░░░` 40% | PARTIAL | Server explicitly reports native generation and automatic file access as NOT VERIFIED; per-client probes/matrix remain. |
| 3 · Asset transport | `████░░░░░░` 40% | PARTIAL | Paired MCP payloads are bounded to 192 KiB; plugin local file import is bounded to 5 MiB. Chunked transport remains. |
| 4 · Safe SVG import | `██████░░░░` 60% | IMPLEMENTED · AUTOMATED VERIFIED | Conservative sanitizer, geometry allowlist, size/dimension bounds, and native SVG-node insertion; live Figma editability untested. |
| 5 · Raster image import | `██████░░░░` 60% | IMPLEMENTED · AUTOMATED VERIFIED | PNG/JPEG/GIF signatures/dimensions/checksums and native image fills are validated; live rendering untested. |
| 6 · Capability routing | `██░░░░░░░░` 20% | PARTIAL | Honest manual/local options and unsupported client claims are reported; no generic AI client router is verified. |
| 7 · Agent activity | `███░░░░░░░` 30% | PARTIAL | Actual import completion result appears in plugin UI; intermediate lifecycle events are not implemented. |
| 8 · Local asset library | `████████░░` 80% | IMPLEMENTED · AUTOMATED VERIFIED | SHA-256 dedupe, bounded persistent bytes, preview, reuse and explicit delete/clear controls are implemented. |
| 9 · AI Assets UI | `███████░░░` 75% | IMPLEMENTED · AUTOMATED VERIFIED | Manual vector/raster import and local library actions are wired; UI screenshot/layout review in live Figma is pending. |
| 10 · Structural verification | `███░░░░░░░` 30% | PARTIAL | Import handlers validate bytes and return dimensions/node IDs; post-insert readback and bounded repair remain. |
| 11 · Compatibility/security | `████░░░░░░` 40% | PARTIAL | SVG allowlist, input bounds, image signatures and no remote fetch; client matrix/live security checks remain. |
| 12 · Tests and release | `██████████` 100% | PASS · AUTOMATED | `npm run release:verify`: 33 unit and 15 integration tests, typecheck, lint, local audit, build, package, strict docs audit (0 findings), ZIP integrity and SHA-256 passed. Live Figma belongs to the compatibility gate. |
| 13 · Repository documentation | `██████████` 100% | PASS · AUDITED | README, backlog, roadmap, feature registry, status, known issues, changelog and handoff reflect the current build; strict audit reported 0 findings. |

## Requirements

- Node.js 20+ and npm to build/package the plugin.
- Figma Desktop or web editor to run the development plugin.
- Any AI assistant is optional and user-operated. No provider credentials are required by this project.
- Ollama and the companion service are optional alternatives, not required for generation, editing, import, or rendering.

## Build and install

```sh
npm install
npm run verify
```

In Figma, open **Plugins → Development → Import plugin from manifest…** and select `dist/manifest.json`. The development manifest intentionally has no invented plugin ID; Figma supplies the ID when the plugin is registered for distribution.

The manifest allowlists `http://localhost:8787` for optional Ollama and `http://localhost:8788` for the custom token-protected MCP bridge. Both services bind only to `127.0.0.1`.

## Use any AI app without an API

1. Keep **AI workflow → Use any AI app · no API key** selected.
2. Enter the design brief and choose the design settings, then select **Prepare prompt for AI app**.
3. Copy the prompt to Claude Desktop or another AI app you already use. Ask it to return the requested JSON.
4. Paste the answer into **Import**, select **Validate specification**, review the result, then insert it into Figma.

The Edit tab follows the same handoff for selection-aware patch JSON. The plugin sends nothing to an AI app; copying and pasting are user-controlled. It accepts a JSON code fence but validates every layer and edit operation before Figma mutation.

## Optional local Ollama

Choose **Optional local Ollama model** in Generate/Edit, start the companion with `npm run runtime`, and use an installed model. The service binds to loopback and only contacts local Ollama. Manual import and external handoff continue working if the service or model is unavailable.

## Privacy and verification limits

There is no telemetry or required paid API. Any external AI app is operated separately by the user under that app's own account and data policies. Prompt history and tokens are stored in the plugin's local browser storage. The plugin host alone creates Figma document nodes.

Typecheck, lint, unit/integration tests, dependency audit, local security checks, build, and ZIP packaging are automated. Real Figma editor rendering and UI screenshot review must be recorded separately; automated tests are not evidence of a live Figma session. See [`docs/BACKLOG.md`](docs/BACKLOG.md) for current gates.

Live browser check (2026-11-08): Figma Web sign-in succeeded and a blank `Untitled` test file was created under Drafts. The cloud editor did not open: Figma showed unsynced offline changes and the cloud Chromium renderer reported `gpuSystem->init failed`. No existing file was synced or modified, and plugin UI rendering remains **NOT TESTED** in Figma.

Follow-up local Figma console evidence identified the blank panel cause: the build inlined Vite's entry script in `<head>` but stripped `type="module"`, so it ran before `#root` existed. The build now preserves module/deferred execution and checks for that attribute. The VSN startup loader and workspace options were re-imported and confirmed working by the user. Targeted bounds patches and plugin-session undo are automated-check verified; live edit preservation and undo still need a Figma check.
