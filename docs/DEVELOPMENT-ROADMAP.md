# Development roadmap

Bars estimate verified acceptance scope, not schedule. See [BACKLOG.md](BACKLOG.md) for evidence and open gates.

| Order | Workstream | Progress | Status | Dependency / exit evidence |
|---:|---|---:|---|---|
| 0 | Design quality audit | `███████░░░` 70% | AUTOMATED · PARTIAL | Prompt guidance plus measurable contrast, naming, typography and Auto Layout findings are tested; screenshot QA and comparative evaluation remain. |
| 1 | Repository baseline and AI-readable project memory | `██████████` 100% | IMPLEMENTED | Registry/source/link audits pass; generated source inventory included in release verify. |
| 2 | Official MCP SDK stdio foundation and honest tool catalog | `████████░░` 80% | IMPLEMENTED · PARTIAL | Protocol initialization, discovery, validation, capabilities and asset tools are integration-tested; client setup is not. |
| 3 | Authenticated loopback plugin bridge and queue | `█████████░` 90% | IMPLEMENTED · PARTIAL | UI iframe owns authenticated polling; host-only Figma mutations return correlated results. Live hidden-session pairing and cancellation remain. |
| 4 | Universal design operations through plugin adapter | `████████░░` 84% | IMPLEMENTED · PARTIAL | Design and asset import/edit/inspect/export plus bounded frame preview are wired; live Figma invocation remains untested. |
| 5 | Real agent job lifecycle and plugin activity panel | `████████░░` 80% | IMPLEMENTED · PARTIAL | UI shows signed-in Figma operator and actual job outcomes; Connect hides the panel while iframe polling continues. Live UI event proof remains. |
| 6 | Design schema/render/export extensions | `█████████░` 90% | IN PROGRESS | Bounded PNG/JPEG nodes, native color Variables/Text Styles, constraints/grids, solid/linear-gradient paint stacks up to eight layers, advanced export and category recipes are implemented; live checks and unsupported paint/effect cases remain. |
| 7 | Compatibility matrix and regression adapter | `██████░░░░` 60% | PARTIAL · AUTOMATED MAPPING VERIFIED | Schema Auto Layout modes and primary-axis alignments map through official typings with round-trip tests; other APIs/client probes and live compatibility review remain. |
| 8 | Client configuration and asset capability guides | `████░░░░░░` 40% | IN PROGRESS | Existing client guides plus capability endpoint; asset transport and per-client evidence docs are being completed. |
| 9 | Repository docs automation | `██████████` 100% | PASS | Registry/link/source/test audits and strict release documentation audit pass with 0 findings. |
| 10 | Live validation and release report | `██████░░░░` 60% | PARTIAL | User-confirmed base UI; current asset build, live Figma render and client pairing need verification. |
| 11 | Master Prompt 04 · repository audit | `██████████` 100% | PASS | Existing sources and limitations inspected. |
| 12 | Master Prompt 04 · native SVG and raster asset paths | `███████░░░` 70% | IMPLEMENTED · AUTOMATED VERIFIED | Sanitization and image validation tests; visual/editable result in live Figma remains untested. |
| 13 | Master Prompt 04 · capability routing and activity | `███░░░░░░░` 30% | PARTIAL | Explicit NOT_VERIFIED signals; no universal client routing or full job lifecycle. |
| 14 | Master Prompt 04 · local asset intelligence and UI | `███████░░░` 75% | IMPLEMENTED · PARTIAL | Bounded content-addressed local asset library with preview/reuse/delete; screenshot review and actual AI-client file retrieval remain. |
| 15 | Master Prompt 04 · security, compatibility, tests and packaging | `███████░░░` 75% | AUTOMATED PASS · LIVE GATES OPEN | `npm run release:verify` passes with 60 unit and 17 integration tests, regenerated package, strict docs audit (0 findings), ZIP integrity and SHA-256; live client/Figma checks remain environment-dependent. |

Prioritize secure end-to-end vertical slices over registering a large number of nonfunctional tools. Preserve JSON import and the optional Ollama workflow. Do not claim automatic access to an AI desktop app's generated files unless that integration has been exercised and verified.
