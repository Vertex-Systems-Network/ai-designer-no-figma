# Development roadmap

| Order | Workstream | Status | Dependency / exit evidence |
|---:|---|---|---|
| 1 | Repository baseline and AI-readable project memory | IN PROGRESS | Registry and source-aware docs validated by `npm run docs:validate` |
| 2 | Official MCP SDK stdio foundation and honest tool catalog | PLANNED | Protocol discovery/call tests; only implemented tool capabilities advertised |
| 3 | Authenticated loopback plugin bridge and queue | PLANNED | Pairing/session handshake, correlation, limits, disconnect/retry/cancel tests |
| 4 | Universal design operations through plugin adapter | PLANNED | MCP import/edit/inspect commands pass plugin integration tests |
| 5 | Real agent job lifecycle and plugin activity panel | PLANNED | Events reflect actual queued/running/completed/cancelled jobs |
| 6 | Design schema/render/export extensions | IN PROGRESS | Images/SVG/gradients, components/variables, complete export and tests |
| 7 | Compatibility matrix and regression adapter | PLANNED | API/typings evidence recorded; mocked and live tests distinct |
| 8 | Client configuration guides | PLANNED | Verified stdio configs for client versions actually tested |
| 9 | Repository docs automation | IN PROGRESS | Registry/link/source/test audits and clean report command |
| 10 | Live validation and release report | BLOCKED/PENDING | User Figma test for new edit/export; real Ollama/model and screenshot evidence |

Prioritize secure end-to-end vertical slices over registering a large number of nonfunctional tools. Preserve JSON import and existing optional Ollama workflows throughout.
