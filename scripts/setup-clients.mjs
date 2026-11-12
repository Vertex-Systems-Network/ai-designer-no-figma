#!/usr/bin/env node
// Connect AI Designer's own MCP server to popular AI apps — or to any custom MCP client.
// Usage:
//   npm run setup:clients                      list apps and show what would be written
//   npm run setup:clients -- --client cursor   show one app's config
//   npm run setup:clients -- --client cursor --write          merge into that app's config (backup kept)
//   npm run setup:clients -- --client custom --mode http      generic settings for any other client
// --mode stdio (default): the app starts the MCP server itself.
// --mode http: one shared hub (npm run mcp:remote) serves several apps at once.
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir, platform } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const home = homedir();
const os = platform();
const appData = process.env.APPDATA ?? join(home, 'AppData', 'Roaming');
const userConfig = os === 'darwin' ? join(home, 'Library', 'Application Support') : os === 'win32' ? appData : (process.env.XDG_CONFIG_HOME ?? join(home, '.config'));
const NAME = 'ai-designer';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] ? args[i + 1] : fallback; };
const mode = option('mode', 'stdio');
if (!['stdio', 'http'].includes(mode)) fail('--mode must be stdio or http');

const serverScript = join(repo, 'dist', 'mcp.mjs');
const stdio = { command: process.execPath, args: [serverScript] };
const hubUrl = option('url', 'http://127.0.0.1:8790/mcp');
async function hubToken() {
  const file = join(home, '.ai-designer-no-figma', 'remote-mcp-token');
  try { return (await readFile(file, 'utf8')).trim(); } catch { return '<run "npm run mcp:remote" once, then re-run this command>'; }
}

/** Each client: config file, JSON key, and how a stdio/http entry looks. Formats follow each app's MCP documentation. */
const clients = {
  'claude-desktop': { label: 'Claude Desktop', file: join(userConfig, 'Claude', 'claude_desktop_config.json'), key: 'mcpServers', stdio: (s) => s, http: null, note: 'Or install artifacts/ai-designer-no-figma-claude.mcpb by double-clicking it. Restart Claude Desktop after changes.' },
  'claude-code': { label: 'Claude Code (CLI)', command: (m, t) => m === 'http' ? `claude mcp add --scope user --transport http ${NAME} ${hubUrl} --header "Authorization: Bearer ${t}"` : `claude mcp add --scope user ${NAME} -- "${stdio.command}" "${serverScript}"` },
  cursor: { label: 'Cursor', file: join(home, '.cursor', 'mcp.json'), key: 'mcpServers', stdio: (s) => s, http: (u, t) => ({ url: u, headers: { Authorization: `Bearer ${t}` } }) },
  vscode: { label: 'VS Code (GitHub Copilot agent mode)', file: join(userConfig, 'Code', 'User', 'mcp.json'), key: 'servers', stdio: (s) => ({ type: 'stdio', ...s }), http: (u, t) => ({ type: 'http', url: u, headers: { Authorization: `Bearer ${t}` } }) },
  windsurf: { label: 'Windsurf', file: join(home, '.codeium', 'windsurf', 'mcp_config.json'), key: 'mcpServers', stdio: (s) => s, http: (u, t) => ({ serverUrl: u, headers: { Authorization: `Bearer ${t}` } }) },
  cline: { label: 'Cline (VS Code extension)', file: join(userConfig, 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'), key: 'mcpServers', stdio: (s) => s, http: (u, t) => ({ type: 'streamableHttp', url: u, headers: { Authorization: `Bearer ${t}` } }) },
  'gemini-cli': { label: 'Gemini CLI', file: join(home, '.gemini', 'settings.json'), key: 'mcpServers', stdio: (s) => s, http: (u, t) => ({ httpUrl: u, headers: { Authorization: `Bearer ${t}` } }) },
  codex: { label: 'OpenAI Codex CLI / IDE', toml: join(home, '.codex', 'config.toml') },
  'lm-studio': { label: 'LM Studio', file: join(home, '.lmstudio', 'mcp.json'), key: 'mcpServers', stdio: (s) => s, http: (u, t) => ({ url: u, headers: { Authorization: `Bearer ${t}` } }) },
  zed: { label: 'Zed', printOnly: true, file: join(userConfig, 'zed', 'settings.json'), key: 'context_servers', stdio: (s) => ({ command: s.command, args: s.args }), http: null, note: 'Zed settings allow comments, so add this block by hand under "context_servers".' },
  custom: { label: 'Any other MCP client (custom)', custom: true },
};

function fail(message) { console.error(`\n✖ ${message}`); process.exit(1); }

async function entryFor(client) {
  if (mode === 'http') {
    if (!client.http) fail(`${client.label} supports only --mode stdio here.`);
    return client.http(hubUrl, await hubToken());
  }
  return client.stdio(stdio);
}

async function show(id) {
  const client = clients[id];
  console.log(`\n■ ${client.label}  (--client ${id})`);
  if (client.custom) {
    const token = await hubToken();
    console.log(`  Use this for any AI app that is not listed (Kiro, Roo Code, Continue, Goose, Jan, Msty, your own agent, …).
  Option A — stdio (the app launches the server):
    command: ${stdio.command}
    args:    ["${serverScript}"]
  Option B — HTTP hub (one server shared by many apps; start it with "npm run mcp:remote"):
    URL:     ${hubUrl}   (transport: Streamable HTTP)
    header:  Authorization: Bearer ${token}
  Option C — no MCP at all: in the Figma plugin choose "Any AI app (copy prompt)" and paste the JSON answer back.
  Option D — direct model API: add your endpoint to ~/.ai-designer-no-figma/providers.json (see docs/AI-CLIENTS.md).`);
    return;
  }
  if (client.command) { console.log(`  Run:\n    ${client.command(mode, await hubToken())}`); return; }
  if (client.toml) {
    console.log(`  Add to ${client.toml}:\n${codexBlock()}`);
    if (mode === 'http') console.log('  (Codex is configured with stdio here; it starts its own server.)');
    return;
  }
  const entry = await entryFor(client);
  console.log(`  File: ${client.file}${existsSync(client.file) ? '' : '  (not found — app may not be installed; --write will create it)'}`);
  console.log(`  Add under "${client.key}":\n${JSON.stringify({ [client.key]: { [NAME]: entry } }, null, 2).replace(/^/gm, '    ')}`);
  if (client.note) console.log(`  Note: ${client.note}`);
}

function codexBlock() {
  return `    [mcp_servers.${NAME}]\n    command = ${JSON.stringify(stdio.command)}\n    args = [${JSON.stringify(serverScript)}]\n`;
}

async function write(id) {
  const client = clients[id];
  if (client.custom || client.command || client.printOnly) { await show(id); console.log('\n  Nothing written: copy the settings above into the app.'); return; }
  if (client.toml) {
    const current = existsSync(client.toml) ? await readFile(client.toml, 'utf8') : '';
    if (current.includes(`[mcp_servers.${NAME}]`)) { console.log(`\n✔ ${client.label}: ${client.toml} already has [mcp_servers.${NAME}]; left unchanged.`); return; }
    await backupAndWrite(client.toml, `${current}${current && !current.endsWith('\n') ? '\n' : ''}\n${codexBlock().replace(/^ {4}/gm, '')}`);
    console.log(`\n✔ ${client.label}: added to ${client.toml}. Restart Codex.`);
    return;
  }
  let data = {};
  if (existsSync(client.file)) {
    try { data = JSON.parse(await readFile(client.file, 'utf8')); }
    catch { fail(`${client.file} is not plain JSON (it may contain comments). Add the block shown by "--client ${id}" by hand.`); }
  }
  data[client.key] = { ...(data[client.key] ?? {}), [NAME]: await entryFor(client) };
  await backupAndWrite(client.file, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`\n✔ ${client.label}: wrote "${NAME}" into ${client.file}. Restart the app.`);
}

async function backupAndWrite(file, content) {
  await mkdir(dirname(file), { recursive: true });
  if (existsSync(file)) await copyFile(file, `${file}.bak-ai-designer`);
  await writeFile(file, content, 'utf8');
}

const id = option('client');
if (!existsSync(serverScript)) console.warn(`⚠ ${serverScript} does not exist yet. Run "npm run build" first.`);
if (id && !clients[id]) fail(`Unknown client "${id}". Choose one of: ${Object.keys(clients).join(', ')}`);
if (flag('write')) { if (!id) fail('--write needs --client <id>'); await write(id); }
else for (const key of id ? [id] : Object.keys(clients)) await show(key);
console.log('\nNext: open the AI Designer plugin in Figma → Settings, ask your AI app for "the AI Designer pairing code", type it and press Connect.');
