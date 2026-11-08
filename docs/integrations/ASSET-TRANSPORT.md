# Asset transport

The manual plugin UI accepts raster files up to 5 MiB and sends their bytes to the plugin host with a structured-clone message. The host independently validates the byte signature, MIME type, file structure, and dimensions before creating a Figma image.

The custom MCP path is protected by the existing loopback pairing and token. Its encoded request body is bounded by the bridge, while decoded asset bytes are capped at 192 KiB to leave room for JSON/base64 encoding under the bridge request limit. SVG input has a 512 KiB shared sanitizer limit; MCP SVG requests also remain subject to the transport envelope limits.

There is currently no chunked transfer, resumable upload, arbitrary path read, remote URL download, or binary cache. Oversized assets should be imported through the plugin's local file chooser. Recent items store metadata only.

Loopback services bind to `127.0.0.1`; the plugin manifest declares only required localhost endpoints. The bridge token authenticates local pairing, not AI authorship or the identity of a client label.
