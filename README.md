# AI Designer No Figma

Local-first design generation for Figma. The product uses a Figma plugin for native editable document nodes and an optional loopback-only companion service for local Ollama inference. It does not call Figma AI, Figma MCP, or paid AI APIs.

## Current state

This repository is at the engineering foundation stage. Manual JSON import and editable Figma rendering are the first release path; local inference and selection-aware editing are being implemented in bounded phases. See [the backlog](docs/BACKLOG.md) and [the AI work tracker](docs/AI-WORKFLOW.md) for evidence-based status.

## Requirements

- Node.js 20 or newer and npm
- Figma desktop or web editor to load the development plugin
- Optional: Ollama running locally with a model installed

## Development

```sh
npm install
npm run typecheck
npm test
npm run build
npm run package
```

Load `dist/manifest.json` in Figma using **Plugins → Development → Import plugin from manifest…**. Start the local service separately with `npm run runtime`. Its default bind address is `127.0.0.1`; do not expose it to a LAN or public interface.

## Privacy and scope

Prompts and design JSON are processed in the plugin and the local runtime. Ollama is optional. The local service proxies model requests and only binds to loopback. No telemetry is included. A live Figma editor is required to verify actual native rendering; automated tests cannot substitute for that verification.

## Release evidence

No phase is marked complete without a build/test record. See `docs/` for the architecture, phase checklist, and validation report.
