/**
 * Browser-mode tunnel supervisor.
 *
 * `npm run mcp:browser` exposes ONLY the remote MCP port to the internet so web AIs (ChatGPT, Claude.ai) can reach it.
 * The supervisor keeps one tunnel alive for as long as the hub runs:
 *  - a fixed address: a localtunnel subdomain chosen once and saved, or an ngrok static domain;
 *  - automatic reconnects with backoff when the tunnel drops;
 *  - in `auto` mode, falling back to the next provider when one cannot start on this network.
 * Settings live in ~/.ai-designer-no-figma/browser-mode.json, created on first run.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { mkdir, readFile, writeFile, chmod } from 'node:fs/promises';

export type TunnelProvider = 'auto' | 'ngrok' | 'localtunnel' | 'cloudflare';
export type TunnelConfig = { provider: TunnelProvider; subdomain: string; ngrokDomain?: string };
export type OpenTunnel = { url: string; closed: Promise<string>; close: () => void };

export const configPath = () => join(homedir(), '.ai-designer-no-figma', 'browser-mode.json');
const PROVIDERS: TunnelProvider[] = ['auto', 'ngrok', 'localtunnel', 'cloudflare'];

/** Load settings, creating them with a random but permanent localtunnel subdomain on first use. */
export async function loadTunnelConfig(path = configPath()): Promise<TunnelConfig> {
  let stored: Partial<TunnelConfig> = {};
  try { stored = JSON.parse(await readFile(path, 'utf8')) as Partial<TunnelConfig>; } catch { /* first run */ }
  const config: TunnelConfig = {
    provider: PROVIDERS.includes(stored.provider as TunnelProvider) ? stored.provider as TunnelProvider : 'auto',
    subdomain: typeof stored.subdomain === 'string' && /^[a-z0-9-]{4,63}$/.test(stored.subdomain) ? stored.subdomain : `adnf-${randomBytes(5).toString('hex')}`,
    ...(typeof stored.ngrokDomain === 'string' && /^[a-z0-9.-]+$/i.test(stored.ngrokDomain) ? { ngrokDomain: stored.ngrokDomain } : {}),
  };
  if (JSON.stringify(stored) !== JSON.stringify(config)) {
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 }); await chmod(path, 0o600).catch(() => {});
  }
  return config;
}

/** `--tunnel=ngrok` style overrides from the command line. */
export function providerOverride(argv: string[]): TunnelProvider | undefined {
  const value = argv.find((arg) => arg.startsWith('--tunnel='))?.slice(9);
  return PROVIDERS.includes(value as TunnelProvider) ? value as TunnelProvider : undefined;
}

/** Order in which `auto` tries providers: a configured ngrok domain first (most stable), then localtunnel (no install, fixed name), then Cloudflare. */
export function providerOrder(config: TunnelConfig): Exclude<TunnelProvider, 'auto'>[] {
  if (config.provider !== 'auto') return [config.provider];
  return [...(config.ngrokDomain ? ['ngrok' as const] : []), 'localtunnel', 'cloudflare'];
}

export const backoffMs = (attempt: number) => Math.min(30_000, 2_000 * 2 ** Math.max(0, attempt));

/** Find a public tunnel URL in a provider's log output. Cloudflare's API host is ignored so an error never looks like success. */
export function findTunnelUrl(output: string, provider: 'ngrok' | 'cloudflare'): string | undefined {
  const pattern = provider === 'cloudflare'
    ? /https:\/\/(?!api\.)[a-z0-9-]+\.trycloudflare\.com(?![a-z0-9.-])/i
    : /https:\/\/[a-z0-9.-]+\.ngrok(?:-free)?\.(?:app|dev|io)(?![a-z0-9.-])/i;
  return pattern.exec(output)?.[0];
}

/** Run a CLI tunnel (ngrok / cloudflared) and resolve once its public URL appears in the output. */
function cliTunnel(command: string, args: string[], provider: 'ngrok' | 'cloudflare', spawnFn: typeof spawn): Promise<OpenTunnel> {
  return new Promise((resolve, reject) => {
    let child: ChildProcess;
    try { child = spawnFn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] }); } catch (error) { reject(error); return; }
    let tail = ''; let settled = false;
    const closed = new Promise<string>((done) => { child.on('exit', (code) => done(`${command} exited (${code ?? 'signal'})${tail ? `: ${tail.trim().split('\n').pop()?.slice(0, 200)}` : ''}`)); });
    const timer = setTimeout(() => { if (!settled) { settled = true; child.kill(); reject(new Error(`${command} gave no public URL within 30 s${tail ? `: ${tail.trim().split('\n').pop()?.slice(0, 200)}` : ''}`)); } }, 30_000);
    const watch = (chunk: Buffer) => {
      tail = (tail + chunk.toString()).slice(-4096);
      const url = findTunnelUrl(tail, provider);
      if (url && !settled) { settled = true; clearTimeout(timer); resolve({ url, closed, close: () => child.kill() }); }
    };
    child.stdout?.on('data', watch); child.stderr?.on('data', watch);
    child.on('error', (error) => { if (!settled) { settled = true; clearTimeout(timer); reject((error as NodeJS.ErrnoException).code === 'ENOENT' ? new Error(`${command} is not installed`) : error); } });
    void closed.then((reason) => { if (!settled) { settled = true; clearTimeout(timer); reject(new Error(reason)); } });
  });
}

async function localTunnel(port: number, subdomain: string): Promise<OpenTunnel> {
  const { default: localtunnel } = await import('localtunnel');
  const tunnel = await localtunnel({ port, subdomain, local_host: '127.0.0.1' });
  const closed = new Promise<string>((done) => { tunnel.on('close', () => done('localtunnel closed')); tunnel.on('error', (error: Error) => done(`localtunnel error: ${error.message}`)); });
  return { url: tunnel.url, closed, close: () => tunnel.close() };
}

export type Openers = { [K in Exclude<TunnelProvider, 'auto'>]: () => Promise<OpenTunnel> };
export function defaultOpeners(port: number, config: TunnelConfig, spawnFn: typeof spawn = spawn): Openers {
  return {
    ngrok: () => config.ngrokDomain
      ? cliTunnel('ngrok', ['http', '--log=stdout', `--url=${config.ngrokDomain}`, String(port)], 'ngrok', spawnFn)
      : cliTunnel('ngrok', ['http', '--log=stdout', String(port)], 'ngrok', spawnFn),
    localtunnel: () => localTunnel(port, config.subdomain),
    cloudflare: () => cliTunnel('cloudflared', ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${port}`], 'cloudflare', spawnFn),
  };
}

/**
 * Keep a tunnel up until stop() is called. Reports every (re)connect through onReady with the connector URL,
 * and flags when the public address changed so the user knows to update the connector.
 */
export function superviseTunnel(options: { config: TunnelConfig; secret: string; openers: Openers; log: (line: string) => void; onReady: (connectorUrl: string, changed: boolean) => void; wait?: (ms: number) => Promise<void> }) {
  const wait = options.wait ?? ((ms) => new Promise<void>((done) => setTimeout(done, ms)));
  const order = providerOrder(options.config);
  let stopped = false; let current: OpenTunnel | undefined; let lastUrl: string | undefined;
  const run = async () => {
    let index = 0; let failures = 0;
    while (!stopped) {
      const provider = order[index % order.length]!;
      try {
        current = await options.openers[provider]();
        if (stopped) { current.close(); break; }
        failures = 0;
        const connector = `${current.url.replace(/\/$/, '')}/mcp/${options.secret}`;
        options.onReady(connector, lastUrl !== undefined && lastUrl !== current.url);
        lastUrl = current.url;
        const reason = await current.closed;
        if (stopped) break;
        options.log(`Tunnel dropped (${reason}). Reconnecting…`);
      } catch (error) {
        failures++;
        options.log(`${provider} could not start: ${error instanceof Error ? error.message : String(error)}`);
        // In auto mode move on to the next provider after two failures in a row; a single provider just keeps retrying.
        if (order.length > 1 && failures >= 2) { index++; failures = 0; options.log(`Trying ${order[index % order.length]} instead.`); continue; }
      }
      if (!stopped) await wait(backoffMs(failures));
    }
  };
  const done = run();
  return { stop: () => { stopped = true; current?.close(); }, done };
}
