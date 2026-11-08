# Ollama integration

**Status: PARTIAL.** The optional runtime discovers local tags and posts bounded JSON generation requests to a configured loopback Ollama endpoint. Tests use an in-process fake HTTP service. The application still works through manual structured import without Ollama.

Configuration: `HOST=127.0.0.1`, `PORT=8787`, `OLLAMA_URL=http://127.0.0.1:11434`, `MAX_BODY_BYTES=262144`. Non-loopback hosts are rejected. No model name is assumed installed.

Streaming, capability diagnostics, CPU/GPU visibility, cancellation propagation and retry of invalid outputs are not implemented. A fake service test is not real Ollama verification.
