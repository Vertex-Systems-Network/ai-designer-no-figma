# Claude Code instructions

Read [`AGENTS.md`](AGENTS.md) first; it is the canonical rule set. Then read [`docs/AI-HANDOFF.md`](docs/AI-HANDOFF.md), [`docs/PROJECT-STATUS.md`](docs/PROJECT-STATUS.md), and the relevant module docs.

Preserve the existing React/TypeScript Figma plugin, JSON Schema, local Ollama companion and manual AI-app handoff. Do not rebuild from scratch. Figma API calls belong only in `src/plugin/`; MCP contracts must remain provider-neutral and separate from the Figma adapter.

Never use Git CLI/GitHub CLI, official Figma MCP, paid inference APIs, prompt-derived shell execution, or public network binds. Do not state live Figma/Ollama success based on tests or code inspection. Use `npm run verify` for release-bound changes and update the feature registry, README progress table and session handoff with source-backed evidence.
