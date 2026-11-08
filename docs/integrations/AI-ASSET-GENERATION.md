# AI asset generation and handoff

The plugin does not require an image-generation API and does not assume that Claude Desktop, ChatGPT, Codex, Cursor, Gemini, or another client can expose generated files to a plugin or MCP server. Text-generation support and file-generation/transfer access are separate capabilities.

Use any client that can create the asset, then use its own supported save/export action to produce a local SVG, PNG, JPEG, or GIF. Import the SVG markup or choose a local raster file in the plugin's **AI Assets** screen. The custom MCP tools can validate/import explicitly supplied data when the client can actually pass that data to the MCP tool.

Capability reporting returns `NOT_VERIFIED` for native client generation, client-generated file access, and automatic transfer. These values must stay that way until a specific client/version workflow has been exercised end to end. MCP connection alone does not prove that a client can create, read, or send image files.

There is no official Figma MCP, Figma AI, paid inference service, remote asset fetch, or hidden upload in this workflow. See [asset pipeline](../architecture/ASSET-PIPELINE.md) for limits and validation.
