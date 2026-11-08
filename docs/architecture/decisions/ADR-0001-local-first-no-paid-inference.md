# ADR-0001: Local-first inference and manual AI handoff

- **Status:** Accepted.
- **Context:** Users may have an AI app subscription but no API access; a project may also run without any AI account.
- **Decision:** Make user-operated prompt/JSON handoff the default and keep Ollama optional on loopback. Never make a paid model API mandatory.
- **Alternatives:** Required hosted inference; provider-specific automation. Rejected due cost, privacy and access constraints.
- **Consequences:** Import validation is a core feature; chat UI automation is out of scope; real Ollama must be separately verified.
- **Related modules:** `src/ui`, `src/shared/prompts.ts`, `src/runtime/server.ts`.
