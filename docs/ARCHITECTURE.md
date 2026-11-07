# Architecture

## Data flow

```text
Plugin UI ──validated JSON──▶ Figma plugin host ──▶ native Figma nodes
    │
    └──prompt──▶ loopback runtime ──local Ollama──▶ structured design JSON
```

The plugin host is the only layer that mutates the Figma document. The UI and runtime exchange data, never executable source. The runtime validates request sizes, uses a loopback bind address, and proxies only to a loopback Ollama endpoint. Manual specification import remains available when Ollama is absent.

## Boundaries

- `src/shared`: versioned design contract and safe validation.
- `src/plugin`: Figma lifecycle, message protocol, native renderer, edit operations.
- `src/ui`: React interface and local persistence.
- `src/runtime`: local model discovery and bounded generation API.
- `docs`: decisions, release gates, and human-readable work tracking.

## Safety invariants

1. Never evaluate model output or accept executable code from JSON.
2. Reject oversized specs, unsupported node kinds, duplicate IDs, malformed colors, and excess depth before mutation.
3. Render into a newly created page/frame and roll back the generated root if rendering throws.
4. Editing is patch-based and only targets explicit stable IDs; unsupported operations fail before applying any changes.
5. Local service binds to `127.0.0.1` by default and rejects non-loopback configured hosts.

## ADRs

- **ADR-001:** Use a plugin plus optional local sidecar. Manual JSON import is a first-class mode, not an error fallback.
- **ADR-002:** Use a versioned JSON AST. AI output is data; never executable code.
- **ADR-003:** Native Figma API operations remain in the plugin host because document mutation is editor-owned.
- **ADR-004:** Defer live Figma validation until an editor session is available; mocks cannot prove plugin lifecycle behavior.
