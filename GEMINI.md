# Gemini development instructions

Read [`AGENTS.md`](AGENTS.md) before any repository change. Use [`docs/PROJECT-OVERVIEW.md`](docs/PROJECT-OVERVIEW.md), [`docs/SYSTEM-ARCHITECTURE.md`](docs/SYSTEM-ARCHITECTURE.md), [`docs/PROJECT-STATUS.md`](docs/PROJECT-STATUS.md), and [`docs/AI-HANDOFF.md`](docs/AI-HANDOFF.md) for project continuity.

Keep the Figma plugin as the sole document mutation adapter. The default AI path is user-controlled prompt/JSON handoff; Ollama is optional. Never require paid APIs or official Figma MCP. Never run Git CLI/GitHub CLI or code emitted by an AI model. Validate input sizes, schema, selected IDs and loopback access.

Before reporting completion, run relevant checks, distinguish automated and live verification, update only affected docs, and record blockers accurately. Do not publish subjective aggregate percentages or imply work continues after the active turn.
