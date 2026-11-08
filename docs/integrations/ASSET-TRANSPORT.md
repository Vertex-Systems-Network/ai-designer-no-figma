# Asset transport

The manual plugin UI accepts raster files up to 5 MiB and sends their bytes to the plugin host with a structured-clone message. The host independently validates the byte signature, MIME type, file structure, and dimensions before creating a Figma image.

The custom MCP path is protected by loopback pairing and a bearer token. PNG/JPEG/GIF files may be up to 5 MiB. Files at or below 192 KiB use one job; larger files are validated, split into 64 KiB binary chunks, queued as an atomic bridge batch, reassembled in plugin memory, SHA-256 checked, validated again, inserted, and read back from Figma. Each serialized chunk remains below the bridge request limit. SVG input has a 512 KiB shared sanitizer limit and travels as one bounded request.

Transfers are sequential and kept in memory until completion (or a two-minute timeout); resumable uploads and retries across plugin restarts are not supported. There is no arbitrary path read, remote URL download, or binary cache. Local UI imports are read from a user-selected file. The local asset library stores source bytes in Figma clientStorage.

Loopback services bind to `127.0.0.1`; the plugin manifest declares only required localhost endpoints. The bridge token authenticates local pairing, not AI authorship or the identity of a client label.
