# Schema 1.0 import/export fidelity matrix

This matrix describes the actual plugin renderer (`src/plugin/code.ts`) and selected-tree exporter, not a promise that every Figma property is representable. Import is validated by `validateDesignSpec` before document mutation. Export either emits schema 1.0 data or returns an explicit error for a detected lossy case. Local host mocks verify representative native API behavior; live Figma round-trip remains a separate `LIVE-01` check.

## Document and shared fields

| Field group | Import/render | Selected-tree export | Boundary / evidence |
|---|---|---|---|
| Document `schemaVersion`, `name`, `pages[]`; page `id`, `name`, `children[]` | Creates named Figma pages and inserts validated children; page switch uses the async API for dynamic-page access | Exports selection as one page and selected root; logical IDs are retained when known, otherwise derived from Figma node IDs | Page creation is rollback protected. Empty/invalid IDs, duplicates, unsupported schema versions, excess sizes/depth/nodes are rejected. |
| Shared identity and geometry: `id`, `name`, `x`, `y`, `width`, `height`, `rotation`, `opacity` | Applied to created nodes; dimensions must be positive and bounded | Reads native geometry, opacity and rotation; names and dimensions are bounded/normalized for schema | Geometry/text/layout fixtures cover native values; unsupported native node kinds fail export. |
| `constraints` | Applied where the node supports constraints | Exported where exposed by the selected node | Unsupported node properties are rejected by schema/type validation. |
| Solid `fill`, `fillToken`, `gradient`, ordered `paints` | Builds native fills and binds color variables; paint stacks include solid, supported gradients and embedded images | Serializes solid/gradient/image paint stacks, paint opacity and bound color variable references | Mixed fills, unsupported paint/blend modes, missing image bytes, inaccessible token values, invalid token references and invalid gradient transforms/stops are rejected or explicitly omitted only when invisible. |
| `shadow`, `shadows`, ordered `effects` | Builds native shadow, inner-shadow, blur and progressive blur effects (maximum four) | Exports supported native effect kinds and parameters; progressive effects preserve endpoint data | Unsupported effect kinds, unsupported effect blend modes and >4 visible effects fail export. |
| Design system `colors[]`, `typography[]` | Creates/reuses local variables and text styles; nodes bind via `fillToken` / `textStyleToken` | Discovers and snapshots bound color variables and text styles after the complete asynchronous traversal | Multiple text color-variable bindings and mixed character styles fail explicitly. Fixture verifies token definitions and bindings. |

## Node-specific fields

| Node | Import/rendered fields | Exported fields | Explicitly rejected / not represented |
|---|---|---|---|
| `frame` | Children, fill/paint/effects, radius/per-corner radius/smoothing, clipping, Auto Layout (`mode`, gap, padding, alignment, sizing), layout grids, constraints | Same supported fields; all 3 grid patterns and frame layout settings are mapped | Asymmetric Auto Layout padding and unsupported layout/alignment values fail export. |
| `group` | Children and supported fills/effects/radius/layout/constraints; represented as an editable frame-like node | Children, geometry, supported paint/effects and constraints | Layout grids and clipping are invalid for groups; a native Figma group is exported as a semantic group. |
| `component` | Creates a native component with child nodes, layout, grids, clipping and styles | Component structure and fields; definitions are ordered before exported instances | Component properties/variants are not in schema 1.0 (`CODE-03`). |
| `instance` | Creates from an earlier component reference; applies geometry, opacity and constraints | Reference to an earlier/included component | Direct instance overrides, non-default scale-tool factors, missing component source, forward/unresolved references and instance-specific paints are rejected. |
| `text` | Text content, loaded font with fallback, size/weight, line height, letter/paragraph spacing, alignment, vertical alignment, auto-resize, decoration/case, paint/effects, style token, color token | Supported text content/style fields, style-token definition/reference, color token and supported paint/effects | Native text `PASS_THROUGH` node blend exports as the schema default on leaf text; other nonstandard blend modes, mixed font/line-height/character styling and multiple bound color variables fail export. `radius` is rejected (unsupported by this renderer); simultaneous legacy `fill` and `color` is rejected as ambiguous. |
| `rectangle` | Solid/gradient/paint stack, effects, radius/per-corner radius/smoothing, supported solid stroke and constraints | Same supported styling; image fills export as image nodes only when undecorated, otherwise remain image paints on a rectangle | Multiple/non-solid/blended strokes and unsupported stroke blends fail export. |
| `ellipse` | Solid/gradient/paint stack, effects, supported solid stroke and constraints | Same supported fields | Multiple/non-solid/blended strokes and unsupported stroke blends fail export. |
| `line` | Geometry, opacity, constraints and solid stroke (`fill` is accepted as the legacy stroke color) | Solid stroke color/opacity/width, geometry, opacity and constraints | `radius` is rejected (not renderable); `paints` and unsupported base paints/effects are rejected by schema/type validation; non-solid or blended strokes fail export. |
| `vector` | One bounded editable SVG path, fills/paint stack and supported effects | One editable vector path and supported paints/effects | Empty/invalid path and multiple native vector paths fail export. Schema 1.0 does not encode vector-network topology. |
| `image` | Bounded embedded PNG/JPEG, scale mode, crop transform or tile scaling factor; rendered as a native image-filled rectangle | Embedded PNG/JPEG bytes and scale settings from a native image fill | Invalid/mismatched/oversized assets, unsupported format, unsupported transforms, and lossy image effects/decorations not representable on standalone image nodes are rejected by validation/export. |

## Fidelity fixes made during this audit

- Text export now writes the solid text color only as `color`, avoiding duplicate `fill` + `color` fields; the validator rejects ambiguous hand-authored pairs.
- A referenced text style is applied before explicit layer typography, so explicitly provided text values remain overrides.
- `radius` is forbidden by both JSON Schema and runtime type validation on text and line nodes because the renderer cannot apply it there.
- Translated linear-gradient transforms, image rectangle decoration, all supported grid patterns, variable/style definitions, and font weight categories are covered by host fixtures.
- Export fails with actionable errors for lossy compound vectors, overridden/scaled instances, mixed text styles/tokens, unsupported strokes/effects, unavailable image bytes and unsupported nodes.

## Evidence boundaries

- Automated: `src/plugin/host-runtime.test.ts`, `src/shared/spec.test.ts`, `npm run release:verify`.
- Live Figma: **NOT TESTED in this execution environment**. Run `LIVE-01` from [`EXECUTION-PLAN.md`](EXECUTION-PLAN.md) using the exact release build.
- The matrix is field-group exhaustive for schema 1.0 node types. It does not claim perfect pixel-level round-trip for Figma features that schema 1.0 deliberately rejects.
