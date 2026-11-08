# Custom MCP architecture

**Status: PLANNED.** `@modelcontextprotocol/server` is installed as the official open-source SDK foundation. No MCP server is wired yet.

The target is a stdio MCP process, separate from Figma and the HTTP bridge. It validates versioned tool inputs, assigns operation IDs, calls the loopback bridge, enforces bounded timeouts, returns structured results, and writes logs to stderr only. It must never use Figma's official MCP or expose Figma-specific paint objects as its permanent contract.

Do not register tools that have no tested handler. The bridge pairing/session design is a prerequisite for document inspection and mutation tools. See [tool registry](MCP-TOOL-REGISTRY.md) and [security architecture](../SECURITY-ARCHITECTURE.md).
# Custom MCP server: implemented surface and setup

The repository includes a custom stdio MCP server (`npm run mcp`) and loopback HTTP bridge on `127.0.0.1:8788`. It uses the official MCP TypeScript SDK, requires Node.js 20+, and is not Figma MCP. No AI model or provider API is part of the MCP server.

The process generates a 256-bit token at `~/.ai-designer-no-figma/bridge-token` with owner-only permissions unless `BRIDGE_TOKEN` is configured. In Figma plugin **Settings → Local MCP agent bridge**, use `http://localhost:8788` and paste that token. The server only accepts loopback binding, restricts browser origins, requires the token, bounds request/result sizes, and correlates each operation to a plugin session. Do not publish this token or expose the port beyond the local machine.

Registered tools: `figma_get_connection_status`, `figma_get_agent_sessions`, `figma_get_capabilities`, `figma_get_selection`, `figma_import_design_schema`, `figma_apply_patch`, `figma_export_selection`, `figma_get_job_status`, `figma_get_job_result`, and `figma_cancel_job`. Cancel works only for jobs still queued. Agent labels are caller-provided display strings, not identity proofs.

Client config examples:

```json
{
  "mcpServers": {
    "ai-designer-no-figma": {
      "command": "node",
      "args": ["--import", "tsx", "/absolute/path/to/ai-designer-no-figma/src/mcp/server.ts"]
    }
  }
}
```

Use the equivalent MCP stdio server setting in Claude Desktop, Codex, Cursor or another MCP client. The exact config file and UI differ by client version. The integration has an automated MCP stdio protocol test; client-specific setup and live Figma actions remain unverified until exercised on the user's desktop.
