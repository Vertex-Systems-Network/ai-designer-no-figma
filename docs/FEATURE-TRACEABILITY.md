# Feature-to-evidence traceability

| Requirement group | Implementation entry point | Current evidence |
|---|---|---|
| Versioned editable design AST | `src/shared/spec.ts`, `schema/design-spec-1.0.schema.json` | Unit tests cover valid, malformed, unsupported, duplicate-ID, size, nesting, circular, and non-JSON cases. |
| Manual JSON validation/import | `src/ui/main.tsx` and `src/shared/spec.ts` | UI validates pasted/uploaded specs before enabling insert. |
| Native Figma rendering | `src/plugin/code.ts` | Implemented for text, frame/group wrappers, rectangles, ellipses, and lines; live editor test still needed. |
| Local model discovery/generation | `src/runtime/server.ts` | Ollama list and non-streaming structured generation endpoints; HTTP tests use a local deterministic Ollama test double. Real model output is not verified. |
| Selection editing | `src/plugin/code.ts` | Selection summary and stable plugin IDs; set text/fill/name patch operations. Preview is in UI. |
| Local color tokens | `src/ui/main.tsx` | Save, import, export, remove, and apply selected color fills. |
| Local persistence | `src/ui/main.tsx` | Browser profile localStorage for history, tokens, theme, endpoint, and fallback choice. |
| Export/package | `scripts/build.mjs`, `scripts/package.mjs` | Builds inline UI and host/runtime bundles, then creates a source ZIP with SHA-256 report. |
| Privacy/network controls | `src/runtime/server.ts`, `manifest.json` | Loopback bind validation, CORS origin allowlist, local endpoint validation, payload size cap. |
