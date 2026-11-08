# Development roadmap

| Order | Workstream | Status | Dependency / exit evidence |
|---:|---|---|---|
| 1 | Repository baseline and AI-readable project memory | IMPLEMENTED | Registry/source/link audits pass; generated source inventory included in release verify. |
| 2 | Official MCP SDK stdio foundation and honest tool catalog | IMPLEMENTED · PARTIAL | Protocol initialization, tool listing, validation, status and capabilities are integration-tested; client setup is not. |
| 3 | Authenticated loopback plugin bridge and queue | IMPLEMENTED · PARTIAL | Pairing/session handshake, correlation, payload/origin checks, session isolation and completion pass; live pairing and running-job cancellation remain. |
| 4 | Universal design operations through plugin adapter | IMPLEMENTED · PARTIAL | MCP import/edit/inspect/export handlers are wired to plugin host and schemas; live Figma invocation remains untested. |
| 5 | Real agent job lifecycle and plugin activity panel | IMPLEMENTED · PARTIAL | UI displays actual connection and operation status/events; live UI event proof remains. |
| 6 | Design schema/render/export extensions | IN PROGRESS | Images/SVG/gradients, components/variables, complete export and tests |
| 7 | Compatibility matrix and regression adapter | PARTIAL | Typings/package metadata and evidence limits are recorded; live compatibility review is not done. |
| 8 | Client configuration guides | PARTIAL | Generic stdio example documented; client-specific configs await actual client version checks. |
| 9 | Repository docs automation | IMPLEMENTED | Registry/link/source/test audits and clean report command pass. |
| 10 | Live validation and release report | BLOCKED/PENDING | User Figma test for new edit/export; real Ollama/model and screenshot evidence |

Prioritize secure end-to-end vertical slices over registering a large number of nonfunctional tools. Preserve JSON import and existing optional Ollama workflows throughout.
