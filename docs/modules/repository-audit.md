# Repository audit module

- **Purpose:** Validate that source-aware repository instructions, registry entries, links and test references remain consistent.
- **Source:** `tools/repository-audit/` (script implementation in progress).
- **Status:** documentation foundation exists; scripts/npm command wiring not complete until `docs:validate` executes successfully.
- **Security:** local filesystem read/write only; no Git CLI, network calls or arbitrary command execution.
- **Acceptance:** generated inventory identifies real source paths; validator rejects invalid statuses, missing source/test references and broken local Markdown links.
