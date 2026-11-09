# Module dependencies

```text
React UI ──> shared protocol / prompts / patch validation / design-spec validator
Figma host ──> shared protocol / design-spec validator ──> official Figma Plugin API
Optional UI inference ──HTTP loopback──> runtime ──HTTP loopback──> Ollama
```

The MCP process and bridge are intentionally separate:

```text
MCP stdio adapter ──> bridge client ──HTTP loopback──> local bridge queue
Figma plugin ──HTTP loopback poll/result──> local bridge queue
```

The MCP server and authenticated loopback bridge are implemented. The Figma plugin polls the local queue and executes validated document operations; the MCP process never calls Figma internal APIs directly. See [`SYSTEM-ARCHITECTURE.md`](../SYSTEM-ARCHITECTURE.md).
