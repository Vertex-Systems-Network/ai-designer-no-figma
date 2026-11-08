# MCP tool registry

No MCP tools are registered in the current code. This document is the proposed capability inventory, not a claim that these endpoints work.

| Capability family | Proposed tools | Status |
|---|---|---|
| Connection | `figma_get_connection_status`, `figma_get_capabilities`, `figma_get_active_document` | PLANNED — bridge required |
| Inspection | `figma_get_pages`, `figma_get_selection`, `figma_get_nodes`, `figma_get_styles`, `figma_get_variables` | PLANNED — plugin inspection protocol required |
| Creation | `figma_import_design_schema`, `figma_create_nodes`, `figma_apply_auto_layout` | PLANNED — schema subset and explicit plugin result required |
| Editing | `figma_apply_patch`, `figma_update_text`, `figma_update_fills`, `figma_update_layout` | PLANNED — selected ID validation and preview/undo required |
| Verification | `figma_validate_document`, `figma_detect_overflow`, `figma_get_validation_report` | PLANNED — deterministic checks before optional vision |
| Jobs | `figma_create_job`, `figma_get_job_status`, `figma_cancel_job`, `figma_create_checkpoint` | PLANNED — actual queue/event/checkpoint storage required |

Tool names and schemas are not advertised until implementation and tests exist. Destructive delete/replace tools require a user confirmation path.
