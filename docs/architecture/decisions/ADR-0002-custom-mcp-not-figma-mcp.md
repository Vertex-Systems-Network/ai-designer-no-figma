# ADR-0002: Custom MCP with Plugin API boundary

- **Status:** Accepted; server/bridge implementation pending.
- **Context:** Generic AI agents need a standard tool protocol, but document mutation must remain through supported Figma Plugin API operations.
- **Decision:** Use the official open-source MCP SDK for our own provider-neutral stdio server. Do not depend on Figma's official MCP service or undocumented Figma endpoints. Bridge commands to the plugin; the plugin alone mutates document nodes.
- **Alternatives:** Official Figma MCP, direct API scraping, proprietary AI tool protocol. Rejected for quotas, undocumented behavior, and interoperability.
- **Consequences:** MCP and bridge are separate modules; tools are not advertised until end-to-end handlers exist.
- **Related modules:** planned `src/mcp`, planned bridge, `src/plugin`.
