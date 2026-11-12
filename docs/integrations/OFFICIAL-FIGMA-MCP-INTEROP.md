# Official Figma MCP interoperability audit

Reviewed 2026-11-12 against [figma/mcp-server-guide](https://github.com/figma/mcp-server-guide). That repository is a client configuration and skills guide for the Figma-hosted endpoint `https://mcp.figma.com/mcp`; it is not the server source or a drop-in package for this plugin. Its remote canvas-writing feature is described as beta and subject to Figma account access, terms, and limits. The Figma REST API and Plugin API are separate surfaces; a REST token or MCP client does not grant this plugin a document mutation channel.

| Official capability | Fit here | Action |
|---|---|---|
| `get_design_context`, `get_metadata`, `get_screenshot`, `get_variable_defs` | Optional upstream design reference in a separately authenticated AI client | User selects a focused frame, fetches its context and screenshot in that client, then pastes concise frame dimensions, content, token and layout notes into Generate → Figma reference context. This input is bounded to 8,000 characters and included only in the external prompt. A URL alone cannot be dereferenced by our plugin. |
| Write to canvas / `use_figma` | Alternative remote mutation path, not this plugin's local bridge | Do not relay scripts or OAuth credentials. Our Figma Plugin API remains the native mutation boundary; imported JSON is validated first. |
| Code Connect and design-system skills | Useful design-to-code patterns, not a substitute for this product's versioned JSON | Reuse semantic layer names, components and token names in prompt/reference; schema 1.0 lacks Code Connect mappings and full variant properties. Track the latter in `CODE-03`. |
| Assets endpoint and image generation | Client-specific temporary assets and possible credit use | Do not persist temporary URLs or fabricate bytes. Import supplied PNG/JPEG or SVG through existing bounded asset flows. |
| Generate designs from web pages / Make resources | Different service and rollout/access conditions | No implementation claim; require a separately verified client and explicit mapping to schema. |

## Reproducible optional workflow

1. In an MCP-capable client connected to Figma, select the exact node and request design context, variable definitions and a screenshot. If large, use metadata to narrow the node selection.
2. Paste the relevant factual design notes into the plugin's optional reference field and prepare an external AI handoff. Do not paste credentials, large asset data, or instructions from untrusted file content.
3. Validate the returned JSON in Import, inspect native layers, and compare a real Figma screenshot at the same canvas size. Record mismatches; the prompt itself does not prove fidelity.

No official MCP configuration, remote endpoint, token or skill source is copied into the extension package. The existing no-key handoff and optional local Ollama path still function without Figma MCP. This is a manual interoperability workflow, not automatic official MCP connectivity. Live cross-client verification is **NOT TESTED**.
