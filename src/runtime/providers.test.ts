import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listModels, loadProviders, publicProvider, streamText, validateBaseUrl, type ProviderConfig } from './providers';

const sse = (events: unknown[]) => new Response(new ReadableStream({ start(c) { for (const e of events) c.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(e)}\n\n`)); c.enqueue(new TextEncoder().encode('data: [DONE]\n\n')); c.close(); } }), { status: 200 });
const collect = async (it: AsyncGenerator<string>) => { let out = ''; for await (const t of it) out += t; return out; };
const signal = new AbortController().signal;

afterEach(() => vi.unstubAllGlobals());

describe('provider registry', () => {
  it('ships presets and merges a custom OpenAI-compatible endpoint without leaking keys', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'adnf-'));
    const file = join(dir, 'providers.json');
    await writeFile(file, JSON.stringify({ providers: [{ id: 'my-gateway', label: 'My gateway', baseUrl: 'https://llm.example.com/v1', apiKeyEnv: 'MY_KEY', models: ['house-model'] }] }));
    const providers = await loadProviders({ MY_KEY: 'secret' }, file);
    expect(providers.map((p) => p.id)).toEqual(expect.arrayContaining(['ollama', 'openai', 'anthropic', 'gemini', 'lmstudio', 'openrouter', 'my-gateway']));
    const custom = providers.find((p) => p.id === 'my-gateway')!;
    const view = publicProvider(custom, { MY_KEY: 'secret' });
    expect(view).toMatchObject({ ready: true, kind: 'openai-compatible' });
    expect(JSON.stringify(view)).not.toContain('secret');
    expect(publicProvider(providers.find((p) => p.id === 'openai')!, {}).ready).toBe(false);
    expect(await listModels(custom)).toEqual([{ name: 'house-model' }]);
  });
  it('refuses plain http to remote hosts and credentials inside URLs', () => {
    expect(() => validateBaseUrl('http://api.example.com/v1')).toThrow(/https/);
    expect(() => validateBaseUrl('https://user:pw@api.example.com')).toThrow(/credentials/);
    expect(validateBaseUrl('http://localhost:1234/v1').port).toBe('1234');
  });
});

describe('provider streaming', () => {
  it('streams OpenAI-compatible chat completions with a bearer key', async () => {
    const fetchMock = vi.fn(async () => sse([{ choices: [{ delta: { content: '{"a"' } }] }, { choices: [{ delta: { content: ':1}' } }] }]));
    vi.stubGlobal('fetch', fetchMock);
    const p: ProviderConfig = { id: 'x', label: 'X', kind: 'openai-compatible', baseUrl: 'https://api.example.com/v1', apiKeyEnv: 'K' };
    expect(await collect(streamText(p, { model: 'm', prompt: 'hi', system: 'sys', json: true, signal }, { K: 'abc' }))).toBe('{"a":1}');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.example.com/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer abc');
    expect(JSON.parse(String(init.body)).messages[0]).toEqual({ role: 'system', content: 'sys' });
  });
  it('streams Anthropic text deltas', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => sse([{ type: 'message_start' }, { type: 'content_block_delta', delta: { type: 'text_delta', text: 'hel' } }, { type: 'content_block_delta', delta: { type: 'text_delta', text: 'lo' } }])));
    const p: ProviderConfig = { id: 'anthropic', label: 'A', kind: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', apiKeyEnv: 'K' };
    expect(await collect(streamText(p, { model: 'claude', prompt: 'hi', json: true, signal }, { K: 'k' }))).toBe('hello');
  });
  it('streams Gemini parts and skips thought parts', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => sse([{ candidates: [{ content: { parts: [{ text: 'plan', thought: true }, { text: '{}' }] } }] }])));
    const p: ProviderConfig = { id: 'gemini', label: 'G', kind: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', apiKeyEnv: 'K' };
    expect(await collect(streamText(p, { model: 'gemini-x', prompt: 'hi', json: true, signal }, { K: 'k' }))).toBe('{}');
  });
  it('surfaces provider HTTP errors with a short detail', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('bad key', { status: 401 })));
    const p: ProviderConfig = { id: 'x', label: 'X', kind: 'openai-compatible', baseUrl: 'https://api.example.com/v1' };
    await expect(collect(streamText(p, { model: 'm', prompt: 'hi', json: true, signal }, {}))).rejects.toThrow(/401: bad key/);
  });
});
