# Generic AI client workflow

The universal workflow is user-controlled copy/paste: choose **Prepare prompt for AI app**, use an AI client you already have, then paste its JSON into Import and validate it. The plugin does not scrape or transmit prompts to external AI services.

A separate custom MCP stdio server and authenticated loopback bridge are available for MCP clients that can launch a local Node process and invoke its tools. The Claude Desktop `.mcpb` installer is packaged from this repository. Client availability, setup UX, generated-file access, and live Figma operations must be tested per client/version; no automatic asset access is inferred from an app name.


This project provides its own validated MCP tools and local bridge; it does not invoke Figma AI or Figma MCP. A client must support launching a local MCP process for the connected workflow, otherwise use the manual handoff.
