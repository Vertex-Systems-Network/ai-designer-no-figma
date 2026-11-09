# Ollama integration

**Status: PARTIAL.** The optional runtime discovers local tags and posts bounded JSON generation requests to a configured loopback Ollama endpoint. Tests use an in-process fake HTTP service. Design prompts use the same schema-versioned, category-specific instructions as external AI handoff, including images, tokens, responsive layout and the renderer supported node set. Patch prompts include the bounded Auto Layout operation. The application still works through manual structured import without Ollama.

Configuration: `HOST=127.0.0.1`, `PORT=8787`, `OLLAMA_URL=http://127.0.0.1:11434`, `MAX_BODY_BYTES=262144`; generation streams NDJSON with a 500 KB output cap. Non-loopback hosts are rejected. No model name is assumed installed.

The UI request can be cancelled, and the runtime aborts the local model request when its client disconnects or its bounded timeout expires. Token streaming, detailed hardware diagnostics, and bounded automatic repair retries are not implemented. A fake service test is not real Ollama verification.
