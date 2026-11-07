# Architecture

## Data flow

```text
Any AI app (user-operated) ──structured prompt / JSON paste──▶ Plugin UI
Plugin UI ──validated JSON or bounded patch──▶ Figma plugin host ──▶ native Figma nodes
Optional local mode: Plugin UI ──loopback──▶ companion runtime ──▶ Ollama
```

The plugin host is the only layer that mutates the Figma document. The UI accepts validated structured output from any AI app through a user-controlled copy/paste handoff; it does not automate, scrape, or send requests to external providers. The companion runtime and Ollama are optional. When enabled, the runtime validates request sizes, uses a loopback bind address, and proxies only to a loopback Ollama endpoint. Generation, editing, and rendering remain usable through the external handoff/import workflow when the runtime or a model is absent.

## Boundaries

- `src/shared`: versioned design contract and safe validation.
- `src/plugin`: Figma lifecycle, message protocol, native renderer, edit operations.
- `src/ui`: React interface and local persistence.
- `src/runtime`: optional local Ollama discovery and bounded generation API.
- `src/shared/prompts.ts`: self-contained provider-neutral design and edit prompts.
- `src/shared/edit-patch.ts`: bounded, target-aware patch validation for local and pasted AI output.
- `docs`: decisions, release gates, and human-readable work tracking.

## Safety invariants

1. Never evaluate model output or accept executable code from JSON.
2. Reject oversized specs, unsupported node kinds, duplicate IDs, malformed colors, and excess depth before mutation.
3. Render into a newly created page/frame and roll back the generated root if rendering throws.
4. Editing is patch-based and only targets explicit stable IDs; unsupported operations fail before applying any changes.
5. Local service binds to `127.0.0.1` by default and rejects non-loopback configured hosts.

## ADRs

- **ADR-001:** Use a plugin with a provider-neutral external AI handoff as the default path; local inference is optional. Structured import is the interface between the user's chosen AI app and the plugin.
- **ADR-002:** Use a versioned JSON AST. AI output is data; never executable code.
- **ADR-003:** Native Figma API operations remain in the plugin host because document mutation is editor-owned.
- **ADR-004:** Defer live Figma validation until an editor session is available; mocks cannot prove plugin lifecycle behavior.
