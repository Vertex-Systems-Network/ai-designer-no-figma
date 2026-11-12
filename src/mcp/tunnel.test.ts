import { describe, it, expect } from 'vitest';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadTunnelConfig, providerOrder, providerOverride, findTunnelUrl, superviseTunnel, backoffMs, type OpenTunnel, type Openers } from './tunnel';

const secret = 'c'.repeat(64);
function fakeTunnel(url: string) {
  let drop!: (reason: string) => void;
  const tunnel: OpenTunnel = { url, closed: new Promise<string>((done) => { drop = done; }), close: () => drop('closed') };
  return { tunnel, drop: (reason = 'network') => drop(reason) };
}
const flush = () => new Promise((done) => setTimeout(done, 0));

describe('browser-mode tunnel', () => {
  it('creates a permanent subdomain once and keeps it', async () => {
    const path = join(await mkdtemp(join(tmpdir(), 'adnf-tunnel-')), 'browser-mode.json');
    const first = await loadTunnelConfig(path); const second = await loadTunnelConfig(path);
    expect(first.provider).toBe('auto'); expect(first.subdomain).toMatch(/^adnf-[a-f0-9]{10}$/);
    expect(second.subdomain).toBe(first.subdomain);
    expect(JSON.parse(await readFile(path, 'utf8')).subdomain).toBe(first.subdomain);
  });
  it('orders providers: ngrok domain first, then localtunnel, then Cloudflare; explicit provider only', () => {
    expect(providerOrder({ provider: 'auto', subdomain: 'adnf-x1' })).toEqual(['localtunnel', 'cloudflare']);
    expect(providerOrder({ provider: 'auto', subdomain: 'adnf-x1', ngrokDomain: 'me.ngrok-free.app' })).toEqual(['ngrok', 'localtunnel', 'cloudflare']);
    expect(providerOrder({ provider: 'ngrok', subdomain: 'adnf-x1' })).toEqual(['ngrok']);
    expect(providerOverride(['--tunnel=localtunnel'])).toBe('localtunnel'); expect(providerOverride(['--tunnel'])).toBeUndefined();
  });
  it('finds real tunnel URLs and ignores the Cloudflare API host', () => {
    expect(findTunnelUrl('| https://quiet-river-12.trycloudflare.com |', 'cloudflare')).toBe('https://quiet-river-12.trycloudflare.com');
    expect(findTunnelUrl('Post "https://api.trycloudflare.com/tunnel"', 'cloudflare')).toBeUndefined();
    expect(findTunnelUrl('msg="started tunnel" url=https://abc.ngrok-free.app', 'ngrok')).toBe('https://abc.ngrok-free.app');
    expect(backoffMs(0)).toBe(2000); expect(backoffMs(10)).toBe(30000);
  });
  it('reconnects after a drop and reports when the address changed', async () => {
    const a = fakeTunnel('https://one.loca.lt'); const b = fakeTunnel('https://two.loca.lt');
    const queue = [a.tunnel, b.tunnel]; const ready: Array<[string, boolean]> = [];
    const openers: Openers = { localtunnel: async () => queue.shift()!, cloudflare: async () => { throw new Error('unused'); }, ngrok: async () => { throw new Error('unused'); } };
    const supervisor = superviseTunnel({ config: { provider: 'localtunnel', subdomain: 'adnf-x1' }, secret, openers, log: () => {}, onReady: (url, changed) => ready.push([url, changed]), wait: async () => {} });
    await flush(); a.drop(); await flush(); await flush();
    expect(ready).toEqual([[`https://one.loca.lt/mcp/${secret}`, false], [`https://two.loca.lt/mcp/${secret}`, true]]);
    supervisor.stop(); await supervisor.done;
  });
  it('falls back to the next provider in auto mode after repeated failures', async () => {
    const c = fakeTunnel('https://x.trycloudflare.com'); const ready: string[] = []; const logs: string[] = [];
    const openers: Openers = { localtunnel: async () => { throw new Error('server unavailable'); }, cloudflare: async () => c.tunnel, ngrok: async () => { throw new Error('unused'); } };
    const supervisor = superviseTunnel({ config: { provider: 'auto', subdomain: 'adnf-x1' }, secret, openers, log: (line) => logs.push(line), onReady: (url) => ready.push(url), wait: async () => {} });
    for (let i = 0; i < 6; i++) await flush();
    expect(ready).toEqual([`https://x.trycloudflare.com/mcp/${secret}`]);
    expect(logs.some((line) => line.includes('Trying cloudflare'))).toBe(true);
    supervisor.stop(); await supervisor.done;
  });
});
