# Codex and ChatGPT integration

**Current status:** provider-neutral copy/paste works through the plugin. No paid OpenAI API is required or called. The project also builds a custom MCP stdio server with Figma tools behind an authenticated loopback bridge; this repository does not certify that every ChatGPT or Codex host can launch that local MCP server.

Codex agents should read root `AGENTS.md` and `docs/AI-HANDOFF.md`. Ordinary ChatGPT web chat does not automatically read a local checkout; provide the repository files or use an explicitly connected repository environment. Generated-file access and live Figma mutations must be verified in the specific host.
