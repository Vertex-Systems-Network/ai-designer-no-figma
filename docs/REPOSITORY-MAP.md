# Repository map

| Area | Files | Responsibility |
|---|---|---|
| Figma host | `src/plugin/code.ts` | Native node creation, selection inspection, patch apply/undo, selected spec export |
| UI | `src/ui/main.tsx`, `src/ui/styles.css`, `src/ui/index.html`, `src/ui/assets/` | React plugin panel, themes, startup loader, workflows and local state |
| Shared contracts | `src/shared/protocol.ts`, `spec.ts`, `edit-patch.ts`, `prompts.ts`, `utf8.ts` | Message, schema, patch, prompt, byte-count contracts |
| Schema | `schema/design-spec-1.0.schema.json` | Strict version-1.0 document contract |
| Optional local runtime | `src/runtime/server.ts` | Loopback HTTP model discovery and Ollama generation |
| Tests | `src/shared/*.test.ts`, `src/runtime/*.integration.test.ts` | Deterministic schema/prompt/patch and sidecar integration coverage |
| Build/release | `scripts/build.mjs`, `scripts/package.mjs`, `scripts/audit-local.mjs` | Inline plugin build, source archive, local security assertions |
| Documentation | `docs/` | Product, architecture, status, tests, releases, integration and handoff records |
| Repository audit | `tools/repository-audit/` | Source-aware docs/registry validation and inventory generation |

MCP and local bridge source directories are planned; the SDK dependency alone is not a working integration.
