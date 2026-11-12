#!/usr/bin/env node
// Connect AI Designer's own MCP server to popular AI apps — or to any custom MCP client.
// Usage:
//   npm run setup:clients                      list apps and show what would be written
//   npm run setup:clients -- --status          show which AI apps are installed/configured
//   npm run setup:clients -- --client cursor   show one app's config
//   npm run setup:clients -- --client cursor --write          merge into that app's config (backup kept)
//   npm run setup:clients -- --client custom --mode http      generic settings for any other client
// --mode stdio (default): the app starts the MCP server itself.
// --mode http: one shared hub (npm run mcp:remote) serves several apps at once.
import { existsSync, readdirSync } from 'node:fs';
import { chmod, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir, platform } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const home = homedir();
const os = platform();
const appData = process.env.APPDATA ?? join(home, 'AppData', 'Roaming');
const userConfig = os === 'darwin' ? join(home, 'Library', 'Application Support') : os === 'win32' ? appData : (process.env.XDG_CONFIG_HOME ?? join(home, '.config'));
const NAME = 'ai-designer';
// A plain substring test also matched unrelated text such as the ~/.ai-designer-no-figma folder path.
const hasEntry = (text, client) => { try { const data = JSON.parse(text); return Boolean(client.key && data?.[client.key]?.[NAME]); } catch { return new RegExp(`[\\["']?${NAME}[\\]"']?\\s*[=:{]|mcp_servers\\.${NAME}\\b`).test(text); } };
// Claude Desktop may be installed standalone (%APPDATA%\\Claude) and/or from the Microsoft Store (MSIX),
// whose AppData is virtualised under %LOCALAPPDATA%\\Packages\\<Claude package>\\LocalCache\\Roaming\\Claude.
// The package folder alone identifies a Store install (the app may not have created Roaming\\Claude yet),
// so return every install found; --write updates each and prints every path.
function claudeDesktopConfigs() {
  const standard = join(userConfig, 'Claude', 'claude_desktop_config.json');
  if (os !== 'win32') return [standard];
  const targets = [];
  if (existsSync(dirname(standard))) targets.push(standard);
  const packages = join(process.env.LOCALAPPDATA ?? join(home, 'AppData', 'Local'), 'Packages');
  try {
    for (const pkg of readdirSync(packages).filter((name) => /^(AnthropicPBC\.)?Claude_/i.test(name)).sort())
      targets.push(join(packages, pkg, 'LocalCache', 'Roaming', 'Claude', 'claude_desktop_config.json'));
  } catch { /* no Packages folder */ }
  return targets.length ? targets : [standard];
}

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] ? args[i + 1] : fallback; };
const mode = option('mode', 'stdio');
if (!['stdio', 'http'].includes(mode)) fail('--mode must be stdio or http');

const serverScript = join(repo, 'dist', 'mcp.mjs');
const stdio = { command: process.execPath, args: [serverScript] };
const state = join(home, '.ai-designer-no-figma');
// The hub publishes the port it actually bound (it falls back from 8790 when busy).
async function publishedHubUrl() { try { return JSON.parse(await readFile(join(state, 'hub.json'), 'utf8')).url; } catch { return undefined; } }
const hubUrl = option('url', (await publishedHubUrl()) ?? 'http://127.0.0.1:8790/mcp');
const PLACEHOLDER = '<start "npm run mcp:hub" first>';
async function hubToken({ required = false } = {}) {
  try { const value = (await readFile(join(state, 'remote-mcp-token'), 'utf8')).trim(); if (/^[a-f0-9]{64}$/i.test(value)) return value; } catch { /* missing */ }
  if (required) fail('The hub has not created its token yet. Run "npm run mcp:hub" once, then run this command again.');
  return PLACEHOLDER;
}

/** Each client: config file, JSON key, and how a stdio/http entry looks. Formats follow each app's MCP documentation. */
const clients = {
  // Claude Desktop only launches stdio servers, so HTTP (shared hub) mode goes through mcp-remote with the secret in the path.
  'claude-desktop': { label: 'Claude Desktop', files: claudeDesktopConfigs(), key: 'mcpServers', stdio: (s) => s, http: (u, t) => ({ command: 'npx', args: ['-y', 'mcp-remote', `${u.replace(/\/$/, '')}/${t}`] }), guardRunning: 'Claude', note: 'Use this entry OR the .mcpb extension (artifacts/ai-designer-no-figma-claude.mcpb), never both: two copies start two bridges and pairing codes stop matching. Fully quit Claude Desktop (tray → Quit) before writing, then reopen.' },
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

/** True when a desktop app with this process name is running (Windows tasklist, macOS/Linux pgrep). */
function appRunning(name) {
  try {
    if (platform() === 'win32') return execFileSync('tasklist', ['/FI', `IMAGENAME eq ${name}.exe`, '/NH'], { encoding: 'utf8' }).toLowerCase().includes(`${name.toLowerCase()}.exe`);
    execFileSync('pgrep', ['-x', name], { stdio: 'ignore' }); return true;
  } catch { return false; }
}

function fail(message) { console.error(`\n✖ ${message}`); process.exit(1); }

async function entryFor(client) {
  if (mode === 'http') {
    if (!client.http) fail(`${client.label} supports only --mode stdio here.`);
    return client.http(hubUrl, await hubToken({ required: flag('write') }));
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
    if (mode === 'http') fail('Codex is configured with --mode stdio only (Codex starts its own server). Re-run without --mode http.');
    return;
  }
  const entry = await entryFor(client);
  for (const file of targetsOf(client)) console.log(`  File: ${file}${existsSync(file) ? '' : '  (not found — --write will create it)'}`);
  console.log(`  Add under "${client.key}":\n${JSON.stringify({ [client.key]: { [NAME]: entry } }, null, 2).replace(/^/gm, '    ')}`);
  if (client.note) console.log(`  Note: ${client.note}`);
}

const targetsOf = (client) => client.files ?? (client.file ? [client.file] : []);

function codexBlock() {
  return `    [mcp_servers.${NAME}]\n    command = ${JSON.stringify(stdio.command)}\n    args = [${JSON.stringify(serverScript)}]\n`;
}

async function write(id) {
  const client = clients[id];
  if (client.custom || client.command || client.printOnly) { await show(id); console.log('\n  Nothing written: copy the settings above into the app.'); return; }
  if (client.toml) {
    if (mode === 'http') fail('Codex is configured with --mode stdio only. Re-run without --mode http.');
    const current = existsSync(client.toml) ? await readFile(client.toml, 'utf8') : '';
    if (current.includes(`[mcp_servers.${NAME}]`)) { console.log(`\n✔ ${client.label}: ${client.toml} already has [mcp_servers.${NAME}]; left unchanged.`); return; }
    await backupAndWrite(client.toml, `${current}${current && !current.endsWith('\n') ? '\n' : ''}\n${codexBlock().replace(/^ {4}/gm, '')}`);
    console.log(`\n✔ ${client.label}: added to ${client.toml}. Restart Codex.`);
    return;
  }
  if (client.guardRunning && !flag('force') && appRunning(client.guardRunning)) fail(`${client.label} is running. It rewrites its config while open and would drop this entry. Quit it fully (tray icon → Quit; check Task Manager), then run this again. Use --force to write anyway.`);
  const entry = await entryFor(client);
  for (const file of targetsOf(client)) {
    let data = {};
    if (existsSync(file)) {
      try { data = JSON.parse(await readFile(file, 'utf8')); }
      catch { console.error(`✖ ${file} is not plain JSON (it may contain comments); skipped. Add the block shown by "--client ${id}" by hand.`); continue; }
    }
    data[client.key] = { ...(data[client.key] ?? {}), [NAME]: entry };
    await backupAndWrite(file, `${JSON.stringify(data, null, 2)}\n`, mode === 'http');
    const check = JSON.parse(await readFile(file, 'utf8'));
    if (!check?.[client.key]?.[NAME]) fail(`${file} does not contain "${NAME}" after writing. Another program changed it; quit ${client.label} and retry.`);
    console.log(`✔ ${client.label}: wrote "${NAME}" into ${file} (verified)`);
  }
  console.log('\nRestart the app (fully quit it first).');
}

/** Files that carry the hub bearer token (and their backups) are written owner-only. */
async function backupAndWrite(file, content, secret = false) {
  await mkdir(dirname(file), { recursive: true });
  const backup = `${file}.bak-ai-designer`;
  if (existsSync(file)) { await copyFile(file, backup); if (secret || content.includes('Bearer ')) await chmod(backup, 0o600).catch(() => {}); }
  await writeFile(file, content, { encoding: 'utf8', ...(secret ? { mode: 0o600 } : {}) });
  if (secret) await chmod(file, 0o600).catch(() => {});
}

const id = option('client');
if (!existsSync(serverScript)) console.warn(`⚠ ${serverScript} does not exist yet. Run "npm run build" first.`);
if (id && !clients[id]) fail(`Unknown client "${id}". Choose one of: ${Object.keys(clients).join(', ')}`);
async function status() {
  console.log('\nAI app status (config files only; this does not inspect running apps):');
  for (const [key, client] of Object.entries(clients)) {
    const file = targetsOf(client)[0] ?? client.toml;
    if (targetsOf(client).length > 1) { for (const f of targetsOf(client)) { const t = existsSync(f) ? await readFile(f, 'utf8').catch(() => '') : ''; console.log(`  ${client.label.padEnd(40)} ${!existsSync(f) ? 'no config yet' : hasEntry(t, client) ? '✔ configured' : 'installed, not configured'}  (${f})`); } continue; }
    if (!file) { console.log(`  ${client.label.padEnd(40)} ${client.custom ? 'manual (custom client)' : 'use the command shown by --client ' + key}`); continue; }
    if (!existsSync(file)) { console.log(`  ${client.label.padEnd(40)} not found (${file})`); continue; }
    const text = await readFile(file, 'utf8').catch(() => '');
    console.log(`  ${client.label.padEnd(40)} ${hasEntry(text, client) ? '✔ configured' : 'installed, not configured'}  (${file})`);
  }
}
if (flag('status')) { await status(); process.exit(0); }
if (flag('write')) { if (!id) fail('--write needs --client <id>'); await write(id); }
else for (const key of id ? [id] : Object.keys(clients)) await show(key);
console.log('\nNext: open the AI Designer plugin in Figma → Settings, ask your AI app for "the AI Designer pairing code", type it and press Connect.');
