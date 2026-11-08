# Data flow

## Current design import

User prompt or imported JSON → optional user-operated AI app → bounded JSON parser → JSON Schema and semantic ID validation → typed UI/host message → Figma renderer → native nodes.

## Current local model path

Plugin UI → loopback runtime with local request marker and size cap → loopback Ollama endpoint → JSON response → shared validation → user review → plugin renderer.

## Planned MCP path

MCP stdio tool call → validated tool args and operation ID → authenticated bridge queue → paired plugin poll → selected Figma operation → correlated result/event → structured MCP response. This path must not be considered active before bridge and plugin transport tests pass.
