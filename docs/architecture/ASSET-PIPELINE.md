# Asset pipeline

## Trust boundary

Design prompts and AI responses are data. The plugin never evaluates model output as code. Asset insertion accepts only sanitized SVG geometry or verified PNG/JPEG/GIF byte streams. No remote URL fetching or arbitrary filesystem path is performed.

## Flows

- Manual UI: user pastes SVG markup or selects a local image file. The UI caps raster files at 5 MiB, passes bytes over the plugin UI/host message, and the host validates again before Figma node creation.
- MCP bridge: a paired MCP client supplies SVG text or base64 image bytes. The server caps decoded content at 192 KiB, validates before queueing, then the plugin host validates again before insertion.
- Results include the inserted node ID, media type, dimensions, and vector element count where applicable. The UI keeps recent metadata in browser storage, not asset bytes.

The supported import actions are standalone. They are not design JSON schema nodes and do not implement replacement, crop, vector editing, chunking, or a reusable local binary library.

## SVG

`sanitizeSvg` applies a 512 KiB UTF-8 cap, 5,000-element cap, 4096-pixel geometry limit, element/attribute allowlists, root sizing checks and conservative attribute validation. It rejects scripts, foreign elements, event handlers, declarations, comments, CSS, external/data references and text nodes. The host uses Figma's `createNodeFromSvg` API.

## Raster

`validateRasterAsset` recognizes actual PNG/JPEG/GIF bytes, checks that the supplied MIME matches, bounds the file to 5 MiB and each dimension to 4096. PNG chunks and CRCs are checked; JPEG frame dimensions and end marker are parsed; GIF dimensions and trailer are checked. The host creates a Figma image hash and a rectangle with a native image fill.

## Evidence boundary

Sanitizer, byte validation, MCP tool discovery and UI/host wiring are covered by automated tests and build checks. Native node appearance/editability has NOT been verified in a live Figma editor in this release. See [asset pipeline tests](../testing/ASSET-PIPELINE-TESTS.md) and [known issues](../KNOWN-ISSUES.md).
