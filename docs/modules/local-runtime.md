# Local runtime module

- **Purpose:** Optional loopback HTTP adapter for Ollama discovery and JSON generation.
- **Source:** `src/runtime/server.ts` and `src/runtime/server.integration.test.ts`.
- **Dependencies:** Node HTTP/fetch; local Ollama-compatible service only.
- **Configuration:** `HOST`, `PORT`, `OLLAMA_URL`, `MAX_BODY_BYTES`.
- **Security:** rejects non-loopback bind and upstream hosts, CORS allowlist, local request marker, body/model/prompt limits, generation timeout.
- **Status:** runtime implemented; real Ollama runtime/model NOT TESTED.
- **Tests:** integration suite with fake local server.
- **Limitations:** no streaming, structured-output repair retry, GPU/CPU diagnostics or MCP bridge.
