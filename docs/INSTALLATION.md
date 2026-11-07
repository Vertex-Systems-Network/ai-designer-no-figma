# Installation and operation

## Development plugin

1. Install Node.js 20+ and run `npm install` in the project directory.
2. Run `npm run build`.
3. In Figma Desktop, open **Plugins → Development → Import plugin from manifest…** and choose `dist/manifest.json`.
4. Run the imported plugin from the Development menu.

The manifest intentionally omits a plugin ID because Figma assigns it during registration. Register the plugin in the owner's Figma account and add the official ID before publishing updates.

## Local inference

1. Install and run Ollama from its official distribution.
2. Pull a suitable open-weight model using Ollama's own documented command, then verify it appears in `ollama list`.
3. Start this project's service with `npm run runtime`.
4. Keep the default service bind at `127.0.0.1:8787`; the service rejects public/LAN binds and non-loopback Ollama endpoints.
5. In the plugin, test the local connection and select one of the installed models.

The project does not download or install models automatically and does not require a paid inference service. Manual JSON import works without Ollama.

## Development verification

Run `npm run verify` for type checking, lint, tests, build, and ZIP packaging. Live rendering requires a real Figma editor and must be recorded separately from automated tests.
