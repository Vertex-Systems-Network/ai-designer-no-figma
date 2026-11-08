# AI client asset capability matrix

This matrix describes evidence in this repository. It does not generalize one client's capabilities to another. No native file handoff has yet been tested for any named app.

| Client | Can produce AI text/specs | Native image creation verified here | Generated file access verified here | Direct transfer to plugin verified here | Supported fallback |
|---|---|---|---|---|---|
| Claude Desktop | NOT TESTED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | Save/export a supported file locally, then import it. |
| ChatGPT / Codex | NOT TESTED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | Save/export a supported file locally, then import it. |
| Cursor | NOT TESTED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | Save/export a supported file locally, then import it. |
| Gemini | NOT TESTED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | Save/export a supported file locally, then import it. |
| Other MCP-capable client | Client-dependent | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | Pass explicit SVG/base64 only if the client provides it; otherwise use local file import. |

The plugin capability tool separately reports supported manual import formats and limits. A client must be tested with a named version and concrete file-transfer path before any cell can be upgraded.
