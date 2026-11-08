# Shared module

- **Purpose:** Versioned spec validation, edit patch validation, prompt building, Figma message contracts and UTF-8 byte limits.
- **Source:** `src/shared/spec.ts`, `edit-patch.ts`, `prompts.ts`, `protocol.ts`, `utf8.ts` and corresponding tests.
- **Dependencies:** AJV; design schema JSON.
- **Inputs/outputs:** unknown JSON to `ValidationResult`; fenced patch JSON to a selected-ID checked `EditPatch`; typed UI/host messages.
- **Security:** byte, node, depth, string, operation and bounds limits; rejects unknown patch keys.
- **Status:** core schema/patch path implemented; schema capabilities intentionally partial.
- **Tests:** `src/shared/spec.test.ts`, `prompts.test.ts`, `edit-patch.test.ts`.
- **Next:** schema migrations and tests for added node/paint capabilities.
