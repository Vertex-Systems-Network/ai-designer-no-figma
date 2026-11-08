# Module dependencies

```text
React UI ──> shared protocol / prompts / patch validation / design-spec validator
Figma host ──> shared protocol / design-spec validator ──> official Figma Plugin API
Optional UI inference ──HTTP loopback──> runtime ──HTTP loopback──> Ollama
```

The future MCP process and bridge are intentionally separate:

```text
MCP stdio adapter ──> bridge client ──HTTP loopback──> local bridge queue
Figma plugin ──HTTP loopback poll/result──> local bridge queue
```

The latter flow is architecture target only, not implemented. Never couple the MCP package to Figma internal APIs. See [`SYSTEM-ARCHITECTURE.md`](../SYSTEM-ARCHITECTURE.md).
