# MCP tool registry

This list mirrors `createMcpServer` in [`src/mcp/server.ts`](../../src/mcp/server.ts). Tool discovery and basic validation behavior are covered by the MCP SDK stdio integration test. Live Figma execution has not been verified in the current session.

| Tool | Behavior | Guard / known limit |
|---|---|---|
| `figma_get_connection_status` | Return bridge-connected plugin sessions. | Requires bridge token for plugin; no connection is reported as disconnected. |
| `figma_get_agent_sessions` | List active sessions. | Specify a session ID for mutations when multiple sessions are connected. |
| `figma_get_capabilities` | Report schema, node and patch capabilities. | Unsupported nodes and features are explicitly listed. |
| `figma_validate_design_plan` | Validate a versioned section-to-spec plan and return its native schema 1.0 design. | Candidate component IDs are checked against a caller-supplied inventory, not live rechecked or instantiated. |
| `figma_audit_design_schema` | Validate and audit a design JSON locally before import. | No Figma session required; findings are advisory, not visual proof. |
| `figma_get_local_design_system` | Queue a bounded read-only inventory of current-page components and local document variable/style identities. | Requires an open paired plugin; caps 500 scanned nodes, 80 components, 80 variables and 80 styles; reports truncation. |
| `figma_get_selection` | Queue inspection of current selection. | Poll job status/result for actual plugin response. |
| `figma_import_design_schema` | Validate schema 1.0 and queue an editable design insertion. | JSON size limit 512 KB; imported nodes land on a new page. |
| `figma_apply_patch` | Validate and queue text/fill/name/bounds operations. | Plugin validates every target against its current selection. |
| `figma_export_selection` | Export one selected supported layer tree. | Unsupported layers or paints fail instead of being silently dropped. |
| `figma_get_job_status` | Report queued/running/completed/failed/cancelled. | Results expire after the bridge retention period. |
| `figma_get_job_result` | Return the real operation result or current state. | Does not invent success while still running. |
| `figma_cancel_job` | Cancel a queued job. | Running Figma API operations are not interruptible yet. |

No node delete tool is exposed. Agent labels are caller-provided and are not verified identities. The custom server does not depend on official Figma MCP, paid provider APIs, or model inference.
