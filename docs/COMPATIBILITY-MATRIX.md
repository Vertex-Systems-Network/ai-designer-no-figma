# Compatibility matrix

| Target | Implementation | Test status | Notes |
|---|---|---|---|
| Figma Plugin API | Manifest API `1.0.0`; schema Auto Layout mode and primary-axis alignment mappings isolated in `src/plugin/compatibility.ts` and checked against locked typings; typings pinned by lockfile | Build/typecheck against locked official typings; schema-to-Figma Auto Layout mappings have round-trip unit tests; prior user-confirmed loader/UI; layout mapping unit tests and current advanced rendering are not live-tested | New asset render, export/undo live checks not verified; see [asset tests](testing/ASSET-PIPELINE-TESTS.md) |
| Node.js | Package requires Node 20+; current development executor Node 24.22.1 | Runtime integration tests pass on executor | Test Node 20 in release CI before claiming it |
| Claude Desktop | User-operated prompt/JSON copy/paste; custom MCP availability is client/version dependent | Prompt builder tests; local asset flow is manual only | Native image generation/file access/automatic asset transfer NOT VERIFIED; see [asset capability matrix](integrations/ASSET-CAPABILITY-MATRIX.md) |
| Claude Code | User-operated prompt/JSON handoff; MCP may be configured locally by the user | No app-specific asset transfer test | Native generation/file access/transfer NOT VERIFIED |
| OpenAI Codex/ChatGPT connector | User-operated prompt/JSON handoff | No app-specific asset transfer test | Workspace connectors and local stdio MCP availability vary by host; generated-file access NOT VERIFIED |
| Cursor | User-operated prompt/JSON handoff | No app-specific asset transfer test | `.cursor/rules` documents repository policy; generated-file access NOT VERIFIED |
| Gemini/Antigravity | User-operated prompt/JSON handoff | No app-specific asset transfer test | No client-specific integration claimed; generated-file access NOT VERIFIED |
| Ollama | Optional loopback HTTP adapter | Fake-service integration only | Real installed runtime/model NOT TESTED |

Compatibility updates must cite installed official typings or actual tests. Do not claim every client supports local MCP.
