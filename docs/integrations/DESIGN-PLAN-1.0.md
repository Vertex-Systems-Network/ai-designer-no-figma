# Design plan 1.0

Phase 2 contract for the local design agent. `figma_validate_design_plan` validates a bounded plan without a Figma session or hosted Figma token. It returns the exact validated `designSpec` to pass to the existing `figma_import_design_schema` tool. It neither generates a design nor mutates a document.

```json
{
  "planVersion": "1.0",
  "brief": "A studio website with an editorial introduction",
  "design": {
    "schemaVersion": "1.0",
    "name": "Studio website",
    "designSystem": { "colors": [{ "name": "Primary", "color": "#006039" }] },
    "pages": [{ "id": "home", "name": "Home", "children": [{
      "type": "frame", "id": "hero", "name": "Hero", "width": 1440, "height": 900,
      "fillToken": "Primary", "children": []
    }] }]
  },
  "sections": [{ "frameId": "hero", "purpose": "Introduce the studio", "tokenNames": ["Primary"] }]
}
```

Every top-level frame must have one section. A section may list `assetIds` for actual image/vector nodes within that frame and `componentCandidates` for exact IDs in a separately supplied inventory snapshot. Unknown/missing/duplicate frame IDs, undefined or unused tokens, nonexistent/out-of-section assets, unknown component candidates, unsupported fields and invalid native design specs fail. The brief is bounded to 4,000 characters; the JSON plan to 640 KB, sections to 40, and each reference list to 20.

The inventory argument is caller-supplied JSON, so matching a candidate ID against it does **not** prove that a component currently exists in Figma. The agent should fetch a current inventory via `figma_get_local_design_system` and present/recheck it at use time. Candidate IDs are planning metadata; the returned schema 1.0 design does not instantiate them. Native component reuse and variant binding are Phase 3. The current Phase 1 inventory provides mode IDs, not resolved token values. The native schema design must declare exact token values before import; do not infer them from inventory names.

Workflow: inspect inventory if an open paired file exists → compose plan and native design → validate plan → audit returned spec with `figma_audit_design_schema` → import the exact validated spec → capture and visually verify in a real editor. This validation only proves structural consistency, not visual quality or AI autonomy.
