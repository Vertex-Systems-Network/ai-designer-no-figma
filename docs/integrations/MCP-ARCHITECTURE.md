# Custom MCP server: setup and supported surface

The repository includes a custom stdio MCP server and loopback HTTP bridge on `127.0.0.1:8788`. It uses Node.js 20+ and the official open-source MCP SDK. It is independent of Figma MCP and requires no model or paid API.

The server creates a 256-bit token at `~/.ai-designer-no-figma/bridge-token` unless `BRIDGE_TOKEN` is configured. In the plugin, open **Settings → Local MCP agent bridge**, use `http://localhost:8788`, paste the token, and choose **Pair local agent**. “Pairing details saved” means the settings were stored; verify the status changes to **connected**. Keep the plugin open while using MCP tools.

The bridge binds only to loopback, restricts browser origins, requires the token, bounds requests/results, and correlates operations to plugin sessions. Never publish the token or expose the port beyond the local machine.

Registered tools include connection/session status, capabilities, selection inspection, schema import, selection patch/export, job status/result/cancel, and bounded SVG/raster asset insertion. See [tool registry](MCP-TOOL-REGISTRY.md).

## Claude Desktop on Windows

Use the built server bundle directly to avoid shell quoting errors. In Claude Desktop, open **Settings → Developer → Edit Config** (or the Local MCP server configuration in Extensions settings on newer versions) and add this under `mcpServers`. Adjust the project path if it differs:

```json
{
  "mcpServers": {
    "ai-designer-no-figma": {
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": ["D:\\AI\\Figma Plugin\\dist\\mcp.mjs"]
    }
  }
}
```

If `node.exe` is installed elsewhere, use its actual path. Save the config and fully quit/restart Claude Desktop. Check **Settings → Developer** or chat **+ → Connectors** for the server and tools. The `dist/mcp.mjs` file must exist; rebuild the project if it does not. If logs report `EADDRINUSE` on port 8788, stop an older AI Designer MCP process that still owns the port before restarting Claude. The bridge now closes its HTTP keep-alive connections when the MCP process shuts down to reduce restart collisions.

The MCP server starts the local bridge itself. Once Claude has started the server, read the token in PowerShell with `Get-Content "$env:USERPROFILE\.ai-designer-no-figma\bridge-token"`, then pair it in the Figma plugin as described above. Do not start a second `npm run mcp` process on the same port.

The manifest deliberately has no invented plugin ID. Figma `clientStorage` cannot persist the asset library until the plugin is registered in Figma and its assigned ID is added to `manifest.json`; rebuild and re-import after adding it. Native SVG/image insertion can succeed while the optional local library save fails. The plugin now reports this cause directly.
