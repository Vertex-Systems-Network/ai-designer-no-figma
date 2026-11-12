# Component family 1.0

Phase 3 delivers a separate, bounded native Figma component-family path without changing portable design-spec 1.0. `figma_create_component_family` validates a JSON family, creates a **new page** with a native component set, 2–8 `Style` variants, an editable `Label` TEXT property bound to one text layer per variant, and a review frame containing an instance of each variant. It reads back the native names, text property, fills and instance IDs before reporting success. A failure removes the newly created page. `figma_export_component_family` exports exactly one selected component set when it fits the same portable subset.

```json
{
  "familyVersion": "1.0",
  "name": "Button",
  "width": 120,
  "height": 40,
  "variants": [
    { "name": "Primary", "label": "Continue", "fill": "#006039", "textColor": "#FFFFFF" },
    { "name": "Secondary", "label": "Cancel", "fill": "#FFFFFF", "textColor": "#101010" }
  ]
}
```

Limits: 16 KB JSON, 2–8 unique case-insensitive variant names, dimensions 40–800 × 24–400 px, hex colors, one TEXT property and one solid-fill text label. Existing page content is not changed. The export rejects other component properties, extra layers, gradients, mismatched sizes or missing label binding. The separate family contract does not promise that schema 1.0 instances can reference these components, and it does not import components from an external Figma library. It creates and re-exports native variants in the open file. Live Figma behavior, especially property-key reconciliation after combining variants, still requires Phase 6 acceptance.
