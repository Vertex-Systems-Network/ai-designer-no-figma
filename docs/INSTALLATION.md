# Installation and operation

## Development plugin

1. Install Node.js 20+ and run `npm install` in the project directory.
2. Run `npm run build`.
3. In Figma Desktop, open **Plugins → Development → Import plugin from manifest…** and choose `dist/manifest.json`.
4. Run the imported plugin from the Development menu.

The manifest intentionally omits a plugin ID because Figma assigns it during registration. Register the plugin in the owner's Figma account and add the official ID before publishing updates.

## Use an AI app without an API

1. Leave **AI workflow → Use any AI app · no API key** selected.
2. Enter a design brief and choose the screen preferences.
3. Click **Prepare prompt for AI app**, then copy the prompt into Claude Desktop or any AI assistant available to you.
4. Ask the AI to return exactly the requested JSON object. Copy the result back into the plugin's **Import** tab.
5. Validate, inspect the findings, then insert the editable layers into Figma.

For edits, select a frame and use **Prepare edit prompt**. Copy the generated patch request to your AI app, then paste and validate the JSON patch in the Edit tab before applying it. Targets must exist in the current selection.

No AI app is launched or called by the plugin. This works with AI applications that do not expose an API because the user carries the prompt and response between the apps. The provider's own subscription and privacy terms still apply to its use.

## Optional local Ollama

1. Install and run Ollama separately, then ensure an open-weight model is installed.
2. Start this project's service with `npm run runtime`.
3. Keep its bind at `127.0.0.1:8787`; the service rejects public/LAN binds and non-loopback Ollama endpoints.
4. Select **Optional local Ollama model** in the Generate tab, then choose a detected model.

This path is optional. External AI handoff, JSON import, design validation, and Figma rendering do not require Ollama or this service.

## Development verification

Run `npm run verify` for type checking, lint, unit/integration tests, build, local privacy checks, and ZIP packaging. Live rendering requires a Figma editor session and must be recorded separately from automated tests.
