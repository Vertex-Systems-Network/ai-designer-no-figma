# Asset pipeline test evidence

## Automated coverage

- `src/shared/assets.test.ts`: allowed SVG geometry and dimensions; rejects script/event/external/CSS content, malformed trees, missing dimensions and excess elements; verifies valid PNG bytes/dimensions/MIME and rejects malformed/oversized inputs.
- `src/mcp/server.integration.test.ts`: asset tool discovery, honest capability states, vector validation/rejection, and image validation.
- Plugin host TypeScript checking and production build cover the Figma API adapter and UI/host protocol types.

These are unit, MCP protocol, typecheck, and bundle checks. They do not prove a live Figma node was created or visually rendered.

## Live Figma checklist

Status: **NOT TESTED in this execution**.

1. Re-import the latest `dist/manifest.json`.
2. Paste a simple SVG with a rectangle and circle, import it, then inspect its generated vector layers and dimensions.
3. Import a small valid PNG and JPEG; inspect the image fill and check that the host rejects a renamed non-image file.
4. If using MCP, pair the local bridge and import a small explicit SVG/image payload; confirm a rejected oversized request returns a useful error.
5. Capture screenshots and report editor/app version. Do not infer visual success from passing automated tests.
