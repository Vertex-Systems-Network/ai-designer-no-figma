# ADR-0003: Versioned universal design specification

- **Status:** Accepted.
- **Context:** Provider responses and Figma API properties change independently.
- **Decision:** Keep a strict versioned JSON design AST between prompts, imports, MCP contracts and the Figma adapter.
- **Alternatives:** Directly apply arbitrary model JSON; encode designs as screenshots. Rejected because they are unsafe/non-editable.
- **Consequences:** Schema and resource limits are release contracts; unsupported features must error or have explicit fallbacks.
- **Related modules:** `schema/`, `src/shared/spec.ts`, `src/plugin/code.ts`.
