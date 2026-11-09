# Claude Code instructions

Read [`AGENTS.md`](AGENTS.md), [`docs/MASTER-ENGINEERING-PROMPT.md`](docs/MASTER-ENGINEERING-PROMPT.md), [`docs/EXECUTION-PLAN.md`](docs/EXECUTION-PLAN.md), and [`docs/AI-HANDOFF.md`](docs/AI-HANDOFF.md). Resume the first unblocked task; do not repeat a broad audit or ask the user to restate authorization.

Preserve the existing React/TypeScript Figma plugin, JSON Schema, local Ollama companion and manual AI-app handoff. Do not rebuild from scratch. Figma API calls belong only in `src/plugin/`; MCP contracts must remain provider-neutral and separate from the Figma adapter.

Never use Git CLI/GitHub CLI, official Figma MCP, paid inference APIs, prompt-derived shell execution, or public network binds. Do not state live Figma/Ollama success based on tests or code inspection. Use `npm run release:verify` for release-bound changes and publish the exact verified artifact through the authorized GitHub connector. Progress indicators must count named acceptance items; do not publish a subjective aggregate percentage or claim work continues after a turn ends.
