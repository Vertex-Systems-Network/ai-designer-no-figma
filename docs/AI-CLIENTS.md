# Connecting AI apps and models

AI Designer works with any AI tool in one of four ways. None of them need a Figma API token or Figma's hosted MCP server.

| Way | Use it for | Start |
|---|---|---|
| **MCP (stdio)** | One AI app drives Figma directly (plans, builds, takes screenshots, fixes) | `npm run build`, then `npm run setup:clients -- --client <app> --write` |
| **MCP hub (HTTP)** | Several AI apps at once, or any client that supports Streamable HTTP | `npm run mcp:hub`, then `npm run setup:clients -- --client <app> --mode http --write` |
| **Model provider** | The plugin calls a model itself (local or cloud API) | `npm run runtime`, pick a provider in the plugin |
| **Copy prompt** | Any chat AI with no setup | Choose "Any AI app (copy prompt)" in the plugin |

## Supported AI apps (`--client`)

`claude-desktop`, `claude-code`, `cursor`, `vscode` (GitHub Copilot agent mode), `windsurf`, `cline`, `gemini-cli`, `codex`, `lm-studio`, `zed`, and `custom`.

`custom` prints the generic settings: the stdio command and args, or the hub URL and bearer header. Use these for Kiro, Roo Code, Continue, Goose, Jan, Msty, or your own agent.

Running without `--write` only prints the settings. With `--write`, the script merges the settings into the app's config and keeps a `.bak-ai-designer` backup. If a file has comments, the script writes nothing and prints the block to paste by hand.

## Pairing the Figma plugin (security)

1. Open the plugin in Figma, then go to **Settings → AI agent connection**.
2. Ask your AI app: *"Give me the AI Designer pairing code."* The app calls the `figma_get_pairing_code` tool. You can also read `~/.ai-designer-no-figma/pairing-code`.
3. Type the 6 digits, then press **Connect**.

The code exists because any web page can send `Origin: null`, the same origin the Figma plugin uses. Without the code, a web page could take the bridge token. After 5 wrong codes, pairing locks for one minute and the code changes. After pairing, the plugin reuses its token and needs no code until you disconnect.

## Model providers (`npm run runtime`)

Built-in presets:

| Provider | Key (environment variable) |
|---|---|
| Ollama, LM Studio | No key needed (local) |
| OpenAI | `OPENAI_API_KEY` |
| Anthropic | `ANTHROPIC_API_KEY` |
| Gemini | `GEMINI_API_KEY` |
| OpenRouter | `OPENROUTER_API_KEY` |
| Groq | `GROQ_API_KEY` |
| DeepSeek | `DEEPSEEK_API_KEY` |
| Mistral | `MISTRAL_API_KEY` |
| xAI | `XAI_API_KEY` |

To add any other endpoint (vLLM, LocalAI, llama.cpp server, Azure/OpenAI gateways, a company proxy), create `~/.ai-designer-no-figma/providers.json`:

```json
{ "providers": [
  { "id": "my-gateway", "label": "My gateway", "kind": "openai-compatible",
    "baseUrl": "https://llm.example.com/v1", "apiKeyEnv": "MY_GATEWAY_KEY",
    "models": ["my-model"] }
] }
```

- `kind` is one of `openai-compatible`, `anthropic`, `gemini` or `ollama`.
- Remote URLs must use https.
- Keys are read only by the local runtime. They are never sent to the plugin, logs or Figma.
