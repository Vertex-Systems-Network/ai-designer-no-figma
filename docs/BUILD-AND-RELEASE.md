# Build and release

## Commands

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run test:integration`
- `npm run build`
- `npm run audit:local`
- `npm run package`
- `npm run verify`
- `npm run docs:validate` (repository audit command is being implemented)

## Artifacts

`npm run build` produces `dist/manifest.json`, inline `dist/ui.html`, `dist/plugin.js`, and optional `dist/runtime.mjs`. `npm run package` creates `artifacts/ai-designer-no-figma-<version>.zip` with SHA-256 metadata. The development manifest intentionally omits a Figma plugin ID; do not invent one.

## Installation

Extract the archive and in Figma choose **Plugins → Development → Import plugin from manifest…** and select `dist/manifest.json`. Live editor checks are separate from build checks. Do not mark a release fully verified until installation and core flows are tested in Figma.

## MCP packaging target

The MCP process will be distributed as a separate local Node command with stdio transport; it must not be bundled into the Figma UI. Client configs should use a local executable command and should be tested per client/version before claiming compatibility.
