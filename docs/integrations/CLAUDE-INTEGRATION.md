# Claude integration

Claude Desktop can connect to the project's custom local MCP server. No Anthropic API key or paid API is used. Follow the Windows config and Figma pairing steps in [MCP architecture](MCP-ARCHITECTURE.md). Claude Code can use the same stdio server with its client-specific MCP configuration.

This is a local development integration. The MCP process must remain running, the Figma plugin must remain open and paired, and live tools should be confirmed from Claude's connector list. It does not automate Claude's desktop interface or expose Claude web sessions.
