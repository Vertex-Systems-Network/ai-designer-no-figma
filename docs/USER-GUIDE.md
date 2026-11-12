# AI Designer No Figma: User Guide

This guide covers everything from installation to daily use, in order. If you are new, read sections 1–4 once. Use section 8 when something goes wrong.

- [1. What it is](#1-what-it-is)
- [2. Install (once)](#2-install-once)
- [3. Pick a mode](#3-pick-a-mode)
- [4. Local mode: desktop AI apps](#4-local-mode-desktop-ai-apps)
- [5. Browser mode: ChatGPT and Claude.ai on the web](#5-browser-mode-chatgpt-and-claudeai-on-the-web)
- [6. Local and browser mode together](#6-local-and-browser-mode-together)
- [7. Working with the plugin](#7-working-with-the-plugin)
- [8. Troubleshooting](#8-troubleshooting)
- [9. Security model](#9-security-model)
- [10. Reference](#10-reference)

---

## 1. What it is

AI Designer No Figma is a Figma plugin plus a small local server. Any AI agent that speaks MCP (Model Context Protocol) can use it to create and edit **real, editable Figma layers** in the file you have open. It needs no Figma API token, no official Figma MCP and no paid Figma AI.

```
AI app ──MCP──▶ local server (bridge) ◀──polls── Figma plugin ──▶ your Figma file
```

The plugin only talks to `localhost`. The AI app sends a job (for example "import this design"), the plugin picks it up, draws it in Figma, and reports the result back.

## 2. Install (once)

You need **Node.js 20+**, **Git** and **Figma Desktop**. The browser version of Figma cannot reach `localhost`.

```bash
git clone https://github.com/Vertex-Systems-Network/ai-designer-no-figma.git
cd ai-designer-no-figma
npm install
npm run build
```

Import the plugin into Figma:

1. Open any design file in Figma Desktop.
2. Go to **Plugins → Development → Import plugin from manifest…**
3. Choose `dist/manifest.json` from the repo folder.

To update later, run `git pull` and `npm run build`. Re-run the plugin to pick up the new build. Re-import the manifest only when `manifest.json` itself changed; the changelog says so when it does.

## 3. Pick a mode

| Mode | For | Needs | Command |
|---|---|---|---|
| **Local** | Claude Desktop, Claude Code, Cursor, VS Code, Windsurf, Cline, Gemini CLI, Codex, LM Studio, Zed | nothing extra | `npm run setup:clients` |
| **Browser** | ChatGPT (web), Claude.ai (web), other web AIs that accept a remote MCP URL | `cloudflared`, and a plan that allows custom MCP connectors | `npm run mcp:browser` |
| **Both** | desktop and web AIs on the same Figma file | both of the above | section 6 |
| **No MCP** | any chatbot | nothing | plugin → *Any AI app (copy prompt)* |

**Gemini on the web** cannot add custom MCP servers. Use **Gemini CLI** in local mode instead.

## 4. Local mode: desktop AI apps

### 4.1 Register the server with your AI app

See which apps are installed and configured:

```bash
npm run setup:clients -- --status
```

Then write the config for your app. For example:

```bash
npm run setup:clients -- --client claude-desktop --write
npm run setup:clients -- --client cursor --write
npm run setup:clients -- --client vscode --write
npm run setup:clients -- --client gemini-cli --write
npm run setup:clients -- --client codex --write
```

Without `--write`, the command only prints the block to paste by hand. Run `--client custom` to get settings for any app that is not listed.

> **Claude Desktop:** quit it completely first (tray icon → **Quit**, then check Task Manager). A running Claude Desktop rewrites its config and drops new entries. The script refuses to write while Claude Desktop runs and checks the file afterwards.
> Use **either** this entry **or** the `.mcpb` extension, never both. Two copies start two bridges, and pairing codes then stop matching.

Restart the AI app. In Claude Desktop, **Settings → Developer** should list `ai-designer` as running.

### 4.2 Pair Figma with the AI app (once per bridge)

1. In Figma, run **Plugins → Development → AI Designer No Figma**.
2. In your AI app, ask: **"AI Designer pairing code"**. It replies with 6 digits.
3. In the plugin, open **⚙ Settings → AI agent connection**, type the code and press **Connect & hide panel**.

The panel hides and the status shows **Connected**. Pairing is remembered, so restarting the plugin reconnects without a code. A new code is only needed when the AI app's server restarts.

### 4.3 Ask for designs

Keep Figma open on the file and talk to the AI app normally, for example:

> Use AI Designer to make a login screen in Figma with email and password fields and a Sign in button.

While the agent works, Figma shows a toast **🤖 Claude is working in this file: …** until the job is done. Figma's avatar row at the top right only lists real Figma accounts, and plugins cannot add to it. The toast and the plugin's **Agent Activity** list are where the agent shows up.

## 5. Browser mode: ChatGPT and Claude.ai on the web

Web chats run on the provider's servers. They cannot reach your `localhost`, so browser mode publishes **only the MCP port** through an HTTPS tunnel with a long secret in the URL. The Figma pairing bridge is never exposed.

### 5.1 One-time setup

Install Cloudflare's tunnel tool:

- Windows: `winget install Cloudflare.cloudflared`
- macOS: `brew install cloudflared`
- Linux: see Cloudflare's downloads page

### 5.2 Start browser mode

```bash
npm run mcp:browser
```

The terminal prints three things:

- the **Figma pairing code**;
- the local MCP address;
- a line starting with `BROWSER MODE READY` that contains a URL like `https://<random>.trycloudflare.com/mcp/<64-character secret>`.

**Treat that URL like a password.** Anyone who has it can drive your paired Figma file while the terminal runs.

### 5.3 Add the connector

**ChatGPT (web):**

1. Open **Settings → Apps & Connectors → Advanced** and turn on **Developer mode**. OpenAI moves this toggle between releases; it may sit under **Security**.
2. Choose **Create** or **Add custom connector**, paste the URL, set authentication to **None** (the secret is in the URL) and confirm.
3. In a chat, enable the connector from the tools menu.

Custom connectors need a paid ChatGPT plan with Developer mode. On some plans they are read-only, which blocks drawing in Figma. Check OpenAI's current plan table.

**Claude.ai (web):**

1. Open **Settings → Connectors → Add custom connector**.
2. Paste the URL and save, then enable it in a chat.

### 5.4 Pair and use

1. In the Figma plugin, type the pairing code from the `npm run mcp:browser` terminal and press **Connect & hide panel**.
2. Ask the web chat for a design, as in local mode.

Stop browser mode with **Ctrl+C**. Quick-tunnel URLs change every start, so update the connector URL each time. The secret part stays the same, because it lives in `~/.ai-designer-no-figma/remote-mcp-token`.

## 6. Local and browser mode together

The plugin pairs with **one** bridge at a time. To let desktop and web AIs work on the same file, run a single hub and point the desktop apps at it:

1. Start the hub with the tunnel: `npm run mcp:browser`. Leave it running.
2. Point each desktop app at the hub instead of its own server:

   ```bash
   npm run setup:clients -- --client claude-desktop --mode http --write
   npm run setup:clients -- --client cursor --mode http --write
   ```

   (Claude Desktop reaches the hub through `mcp-remote`, which `npx` downloads on first use.)
3. Restart the desktop apps, then pair the plugin once with the code from the hub terminal.

All AIs now share one job queue. Each job shows its agent's name in the Figma toast and in Agent Activity.

If you only want local mode with several desktop apps, the same steps work with `npm run mcp:hub` (no tunnel) instead of `npm run mcp:browser`.

## 7. Working with the plugin

| Tab | What it does |
|---|---|
| **Generate** | Brief → prompt for any AI app, or a model you configured. *Import JSON instead* pastes an AI's answer. |
| **Edit** | Small, previewed edits to the selection (rename, text, fills, bounds) with undo. |
| **Design System** | Lists local styles and variables; builds the component kit. |
| **Import** | Pastes a schema 1.0 JSON design. |
| **AI Assets** | Imports SVG or raster images as editable layers; keeps a local asset library (save, reuse, delete). |
| **History** | Past runs and their results. |
| **⚙ Settings** | AI agent connection (pairing), optional local model runtime, font fallback. |

The agent tools available over MCP include:

- `figma_import_design_schema`, `figma_apply_patch`, `figma_get_selection`, `figma_capture_selection` (screenshot for visual review);
- `figma_build_component_kit`, `figma_create_component_family`, `figma_insert_generated_vector` and `figma_insert_generated_image`;
- `figma_get_job_result` and `figma_get_connection_status`.

Each tool returns the real plugin result or an explicit failure; nothing is faked.

## 8. Troubleshooting

| Message or symptom | Cause | Fix |
|---|---|---|
| *"The AI Designer bridge is running, but the pairing code is wrong or expired"* | The code came from a different bridge, or several bridges are running and wrong tries rotated their codes (KI-015). | Run **one** bridge only: quit extra `mcp:hub` terminals, and do not mix the `.mcpb` extension with the config entry. Ask the AI app for a **new** code and type it **once**. |
| *"Pairing is temporarily locked"* | 5 wrong codes in a row. | Ask the AI app for the code again. That unlocks pairing and issues a new code. |
| *"No AI Designer bridge found"* | No server is running. | Start the AI app (with the entry from 4.1) or `npm run mcp:hub`. |
| The AI app says it has no AI Designer tool, or talks about a different product | The config entry is missing; Claude Desktop may have dropped it. | Quit the app fully, run `setup:clients --write` again, then check `--status` and **Settings → Developer**. |
| *"An error occurred while loading the plugin environment"* | Stale or broken build. | `git pull`, `npm run build`, run the plugin again; if it persists, open **Plugins → Development → Show/Hide console** and report the first red line. |
| The plugin asks for a code after every restart | Old build without a plugin `id`. | Update, then re-import `dist/manifest.json` once. |
| `mcp:browser` prints *"cloudflared is not installed"* | Tunnel tool missing. | Install it (5.1). Local mode keeps working meanwhile. |
| A web chat cannot call write tools | Your plan only allows read-only connectors. | Use a plan with full Developer mode, or use local mode. |

Files that help with diagnosis live in `~/.ai-designer-no-figma/`:

- `pairing-code-<port>`: the current code of each running bridge;
- `hub.json`: the hub's address;
- `remote-mcp-token`: the browser and hub secret. Never share it.

## 9. Security model

- The bridge and MCP servers bind to **127.0.0.1 only**.
- A Figma plugin pairs only after you type a 6-digit code. Five wrong codes lock pairing for a minute and rotate the code.
- Each paired plugin gets its own 256-bit token. Reconnecting without a code only works with the same bridge instance.
- Browser mode exposes **only** the MCP port. Requests need the 64-hex secret, either in the URL path or as a Bearer header. Browser requests with an `Origin` header are rejected.
- The plugin's network allowlist is limited to `localhost` ports in `manifest.json`.
- The plugin `id` in `manifest.json` is a development id. Before publishing to the Figma Community, replace it with the id Figma assigns. Users re-pair once after that.

## 10. Reference

| Command | Purpose |
|---|---|
| `npm run build` | Build plugin, MCP server, hub and runtime into `dist/`. |
| `npm run setup:clients -- --status` | Show which AI apps have the server configured. |
| `npm run setup:clients -- --client <id> [--mode http] --write` | Write the config for one app; ids: `claude-desktop`, `claude-code`, `cursor`, `vscode`, `windsurf`, `cline`, `gemini-cli`, `codex`, `lm-studio`, `zed`, `custom`. |
| `npm run mcp:hub` | One shared local HTTP MCP server and bridge (local multi-app mode). |
| `npm run mcp:browser` | Same as `mcp:hub` plus a Cloudflare quick tunnel for web AIs. |
| `npm run runtime` | Optional local model runtime (Ollama, LM Studio, OpenAI-compatible, …). |
| `npm run verify` | Typecheck, lint, tests, build, audit, package. |

Further reading:

- `docs/AI-CLIENTS.md`: per-app details;
- `docs/KNOWN-ISSUES.md`: open issues;
- `docs/EXECUTION-PLAN.md`: live verification status;
- `docs/ARCHITECTURE.md`: internals.
