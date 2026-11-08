# Compatibility matrix

| Target | Implementation | Test status | Notes |
|---|---|---|---|
| Figma Plugin API | Manifest API `1.0.0`; typings pinned by lockfile | Build/typecheck; selected runtime checks user-confirmed for earlier build | New export/undo work not live verified; broader features unsupported |
| Node.js | Package requires Node 20+; current development executor Node 24.22.1 | Runtime integration tests pass on executor | Test Node 20 in release CI before claiming it |
| Claude Desktop | User-operated prompt/JSON copy/paste | Prompt builder unit tests | MCP client configuration is not yet delivered or verified |
| Claude Code | User-operated prompt/JSON handoff | Not tested as MCP host | Client/version-specific MCP setup pending |
| OpenAI Codex/ChatGPT connector | User-operated prompt/JSON handoff | Not tested as MCP host | Workspace connectors and local stdio MCP availability vary by host |
| Cursor | User-operated prompt/JSON handoff | Not tested as MCP host | `.cursor/rules` documents repository policy; MCP host config pending |
| Gemini/Antigravity | User-operated prompt/JSON handoff | Not tested as MCP host | No client-specific integration claimed |
| Ollama | Optional loopback HTTP adapter | Fake-service integration only | Real installed runtime/model NOT TESTED |

Compatibility updates must cite installed official typings or actual tests. Do not claim every client supports local MCP.
