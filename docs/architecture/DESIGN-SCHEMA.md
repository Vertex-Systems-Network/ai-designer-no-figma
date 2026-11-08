# Design schema contract

Current design AST version is schema 1.0 at `schema/design-spec-1.0.schema.json`, typed in `src/shared/spec.ts`. Supported types: frame, group, text, rectangle, ellipse and line. Container children recurse with 16-depth and 2,000-node limits; full JSON is limited to 512 KB. IDs are unique across the document.

Current schema does not include images, SVG paths, gradients, effects, components, variables, sections, responsive constraints or independent edge padding. Export reports unsupported source node/paint types rather than silently dropping them. Any future incompatible change needs an explicit schema version and migration.
