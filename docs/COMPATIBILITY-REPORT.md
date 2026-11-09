# Compatibility check — 2026-11-09

- Manifest Plugin API declaration: `1.0.0`.
- Locked `@figma/plugin-typings` version: `1.142.0`.
- Package Node engine requirement: `>=20`.
- Capability evidence: TypeScript compile against installed typings; schema Auto Layout mode/alignment mappings are isolated in src/plugin/compatibility.ts and tested in src/plugin/compatibility.test.ts.
- Adapter coverage: schema layout mode and primary-axis alignment round-trip only; other Figma API mappings remain in the renderer.
- Live Figma capability check: NOT performed by this script.
- Official changelog review: NOT performed by this script; no changelog finding is inferred.

This is a local metadata/typing comparison, not a live compatibility certification. Review official Figma Plugin API release notes before changing mappings.
