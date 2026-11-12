import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Provider registry for the local runtime. Secrets stay in this Node process:
 * they come from environment variables or ~/.ai-designer-no-figma/providers.json
 * and are never returned to the Figma plugin UI.
 */
export type ProviderKind = 'ollama' | 'openai-compatible' | 'anthropic' | 'gemini';
export type ProviderConfig = {
  id: string;
  label: string;
  kind: ProviderKind;
  baseUrl: string;
  apiKey?: string;
  /** Name of an environment variable holding the key (preferred over apiKey in the file). */
  apiKeyEnv?: string;
  /** Static model list for endpoints that cannot list models. */
  models?: string[];
  headers?: Record<string, string>;
};
export type PublicProvider = { id: string; label: string; kind: ProviderKind; baseUrl: string; ready: boolean; reason?: string };
export type StreamRequest = { model: string; system?: string; prompt: string; json: boolean; signal: AbortSignal };

const PRESETS: Array<ProviderConfig & { requiresKey: boolean }> = [
  { id: 'ollama', label: 'Ollama (local)', kind: 'ollama', baseUrl: 'http://127.0.0.1:11434', requiresKey: false },
  { id: 'lmstudio', label: 'LM Studio (local)', kind: 'openai-compatible', baseUrl: 'http://127.0.0.1:1234/v1', requiresKey: false },
  { id: 'openai', label: 'OpenAI', kind: 'openai-compatible', baseUrl: 'https://api.openai.com/v1', apiKeyEnv: 'OPENAI_API_KEY', requiresKey: true },
  { id: 'anthropic', label: 'Anthropic Claude', kind: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', apiKeyEnv: 'ANTHROPIC_API_KEY', requiresKey: true },
  { id: 'gemini', label: 'Google Gemini', kind: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', apiKeyEnv: 'GEMINI_API_KEY', requiresKey: true },
  { id: 'openrouter', label: 'OpenRouter (many models)', kind: 'openai-compatible', baseUrl: 'https://openrouter.ai/api/v1', apiKeyEnv: 'OPENROUTER_API_KEY', requiresKey: true },
  { id: 'groq', label: 'Groq', kind: 'openai-compatible', baseUrl: 'https://api.groq.com/openai/v1', apiKeyEnv: 'GROQ_API_KEY', requiresKey: true },
  { id: 'deepseek', label: 'DeepSeek', kind: 'openai-compatible', baseUrl: 'https://api.deepseek.com/v1', apiKeyEnv: 'DEEPSEEK_API_KEY', requiresKey: true },
  { id: 'mistral', label: 'Mistral', kind: 'openai-compatible', baseUrl: 'https://api.mistral.ai/v1', apiKeyEnv: 'MISTRAL_API_KEY', requiresKey: true },
  { id: 'xai', label: 'xAI Grok', kind: 'openai-compatible', baseUrl: 'https://api.x.ai/v1', apiKeyEnv: 'XAI_API_KEY', requiresKey: true },
];

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

export function validateBaseUrl(raw: string): URL {
  const url = new URL(raw);
  const loopback = LOOPBACK.has(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) throw new Error(`Provider URL ${raw} must use https (plain http is allowed only for loopback).`);
  if (url.username || url.password) throw new Error('Put credentials in apiKey/apiKeyEnv, not in the provider URL.');
  return url;
}

export async function loadProviders(env: NodeJS.ProcessEnv = process.env, file = env.AI_DESIGNER_PROVIDERS ?? join(homedir(), '.ai-designer-no-figma', 'providers.json')): Promise<ProviderConfig[]> {
  const byId = new Map<string, ProviderConfig & { requiresKey?: boolean }>();
  for (const preset of PRESETS) byId.set(preset.id, { ...preset });
  // Backwards compatible override used by the existing runtime and tests.
  if (env.OLLAMA_URL) byId.set('ollama', { ...byId.get('ollama')!, baseUrl: env.OLLAMA_URL });
  let custom: unknown;
  try { custom = JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error(`Could not read provider config ${file}: ${error instanceof Error ? error.message : 'invalid file'}`); }
  const list = Array.isArray(custom) ? custom : (custom && typeof custom === 'object' && Array.isArray((custom as { providers?: unknown }).providers)) ? (custom as { providers: unknown[] }).providers : [];
  for (const entry of list) {
    const item = entry as Partial<ProviderConfig>;
    if (typeof item.id !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,39}$/.test(item.id)) throw new Error('Each provider needs an id of lowercase letters, numbers, - or _.');
    const base = byId.get(item.id);
    const kind = item.kind ?? base?.kind ?? 'openai-compatible';
    if (!['ollama', 'openai-compatible', 'anthropic', 'gemini'].includes(kind)) throw new Error(`Provider ${item.id} has unsupported kind ${String(kind)}.`);
    const merged = { ...base, ...item, kind, label: item.label ?? base?.label ?? item.id, baseUrl: item.baseUrl ?? base?.baseUrl ?? '' } as ProviderConfig;
    if (!merged.baseUrl) throw new Error(`Provider ${item.id} needs a baseUrl.`);
    byId.set(item.id, merged);
  }
  const result: ProviderConfig[] = [];
  for (const provider of byId.values()) {
    validateBaseUrl(provider.baseUrl);
    result.push(provider);
  }
  return result;
}

export function resolveKey(provider: ProviderConfig, env: NodeJS.ProcessEnv = process.env): string | undefined {
  return (provider.apiKeyEnv ? env[provider.apiKeyEnv] : undefined) || provider.apiKey || undefined;
}

export function publicProvider(provider: ProviderConfig, env: NodeJS.ProcessEnv = process.env): PublicProvider {
  const remote = !LOOPBACK.has(new URL(provider.baseUrl).hostname);
  const key = resolveKey(provider, env);
  const ready = !remote || provider.kind === 'ollama' || Boolean(key);
  return { id: provider.id, label: provider.label, kind: provider.kind, baseUrl: provider.baseUrl, ready, ...(ready ? {} : { reason: `Set ${provider.apiKeyEnv ?? 'apiKey'} for this provider before starting the runtime.` }) };
}

const join2 = (base: string, path: string) => `${base.replace(/\/$/, '')}${path}`;

function authHeaders(provider: ProviderConfig, env: NodeJS.ProcessEnv): Record<string, string> {
  const key = resolveKey(provider, env);
  const headers: Record<string, string> = { ...(provider.headers ?? {}) };
  if (provider.kind === 'anthropic') { if (key) headers['x-api-key'] = key; headers['anthropic-version'] = '2023-06-01'; }
  else if (provider.kind === 'gemini') { if (key) headers['x-goog-api-key'] = key; }
  else if (key) headers.Authorization = `Bearer ${key}`;
  return headers;
}

export async function listModels(provider: ProviderConfig, env: NodeJS.ProcessEnv = process.env): Promise<Array<{ name: string; details?: Record<string, unknown> }>> {
  if (provider.models?.length) return provider.models.map((name) => ({ name }));
  const signal = AbortSignal.timeout(5000);
  const headers = authHeaders(provider, env);
  if (provider.kind === 'ollama') {
    const response = await fetch(join2(provider.baseUrl, '/api/tags'), { signal });
    if (!response.ok) throw new ProviderError('OLLAMA_UNAVAILABLE', `Ollama returned ${response.status}.`);
    return ((await response.json()) as { models?: Array<{ name: string; details?: Record<string, unknown> }> }).models ?? [];
  }
  if (provider.kind === 'gemini') {
    const response = await fetch(join2(provider.baseUrl, '/models?pageSize=200'), { headers, signal });
    if (!response.ok) throw new ProviderError('PROVIDER_UNAVAILABLE', `${provider.label} returned ${response.status} while listing models.`);
    const data = (await response.json()) as { models?: Array<{ name: string; supportedGenerationMethods?: string[] }> };
    return (data.models ?? []).filter((m) => m.supportedGenerationMethods?.includes('generateContent')).map((m) => ({ name: m.name.replace(/^models\//, '') }));
  }
  const response = await fetch(join2(provider.baseUrl, '/models'), { headers, signal });
  if (!response.ok) throw new ProviderError('PROVIDER_UNAVAILABLE', `${provider.label} returned ${response.status} while listing models.`);
  const data = (await response.json()) as { data?: Array<{ id: string }> };
  return (data.data ?? []).map((m) => ({ name: m.id })).sort((a, b) => a.name.localeCompare(b.name));
}

export class ProviderError extends Error { constructor(readonly code: string, message: string, readonly status = 502) { super(message); } }

/** Parse a server-sent-event body into JSON payloads. */
async function* sse(body: ReadableStream<Uint8Array>): AsyncGenerator<unknown> {
  const reader = body.getReader(); const decoder = new TextDecoder(); let pending = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      pending += done ? decoder.decode() : decoder.decode(value, { stream: true });
      const events = pending.split(/\r?\n\r?\n/); pending = done ? '' : events.pop() ?? '';
      for (const event of events) {
        const data = event.split(/\r?\n/).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n');
        if (!data || data === '[DONE]') continue;
        yield JSON.parse(data);
      }
      if (done) return;
    }
  } finally { reader.releaseLock(); }
}

async function* ndjson(body: ReadableStream<Uint8Array>): AsyncGenerator<unknown> {
  const reader = body.getReader(); const decoder = new TextDecoder(); let pending = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      pending += done ? decoder.decode() : decoder.decode(value, { stream: true });
      const lines = pending.split('\n'); pending = done ? '' : lines.pop() ?? '';
      for (const line of lines) if (line.trim()) yield JSON.parse(line);
      if (done) return;
    }
  } finally { reader.releaseLock(); }
}

/** Stream plain text chunks from any supported provider. */
/** Retry once on connection errors and 429/5xx before any output is streamed; never retry after cancellation. */
async function withRetry(send: () => Promise<Response>, signal: AbortSignal): Promise<Response> {
  try {
    const first = await send();
    if (first.status !== 429 && first.status < 500) return first;
    await first.body?.cancel().catch(() => {});
  } catch (error) { if (signal.aborted) throw error; }
  await new Promise((resolve) => setTimeout(resolve, 800));
  if (signal.aborted) throw new ProviderError('CANCELLED', 'Request was cancelled.', 499);
  return send();
}

export async function* streamText(provider: ProviderConfig, request: StreamRequest, env: NodeJS.ProcessEnv = process.env): AsyncGenerator<string> {
  const headers = { 'Content-Type': 'application/json', ...authHeaders(provider, env) };
  const fullPrompt = request.system ? `${request.system}\n\n${request.prompt}` : request.prompt;
  let response: Response;
  if (provider.kind === 'ollama') {
    response = await withRetry(() => fetch(join2(provider.baseUrl, '/api/generate'), { method: 'POST', headers, signal: request.signal, body: JSON.stringify({ model: request.model, prompt: fullPrompt, stream: true, ...(request.json ? { format: 'json' } : {}), options: { temperature: 0.3, num_predict: 8192 } }) }), request.signal);
  } else if (provider.kind === 'anthropic') {
    response = await withRetry(() => fetch(join2(provider.baseUrl, '/messages'), { method: 'POST', headers, signal: request.signal, body: JSON.stringify({ model: request.model, max_tokens: 16000, stream: true, temperature: 0.3, ...(request.system ? { system: request.system } : {}), messages: [{ role: 'user', content: request.prompt }] }) }), request.signal);
  } else if (provider.kind === 'gemini') {
    response = await withRetry(() => fetch(join2(provider.baseUrl, `/models/${encodeURIComponent(request.model)}:streamGenerateContent?alt=sse`), { method: 'POST', headers, signal: request.signal, body: JSON.stringify({ ...(request.system ? { systemInstruction: { parts: [{ text: request.system }] } } : {}), contents: [{ role: 'user', parts: [{ text: request.prompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 16000, ...(request.json ? { responseMimeType: 'application/json' } : {}) } }) }), request.signal);
  } else {
    response = await withRetry(() => fetch(join2(provider.baseUrl, '/chat/completions'), { method: 'POST', headers, signal: request.signal, body: JSON.stringify({ model: request.model, stream: true, temperature: 0.3, messages: [...(request.system ? [{ role: 'system', content: request.system }] : []), { role: 'user', content: request.prompt }] }) }), request.signal);
  }
  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 300).replace(/\s+/g, ' ');
    throw new ProviderError('MODEL_REQUEST_FAILED', `${provider.label} returned ${response.status}${detail ? `: ${detail}` : '.'}`);
  }
  if (!response.body) throw new ProviderError('MODEL_STREAM_UNAVAILABLE', `${provider.label} did not provide a response stream.`);
  if (provider.kind === 'ollama') {
    for await (const item of ndjson(response.body)) { const text = (item as { response?: unknown }).response; if (typeof text === 'string' && text) yield text; }
    return;
  }
  for await (const event of sse(response.body)) {
    if (provider.kind === 'anthropic') {
      const e = event as { type?: string; delta?: { type?: string; text?: string }; error?: { message?: string } };
      if (e.type === 'error') throw new ProviderError('MODEL_STREAM_FAILED', e.error?.message ?? 'Anthropic stream failed.');
      if (e.type === 'content_block_delta' && e.delta?.type === 'text_delta' && e.delta.text) yield e.delta.text;
    } else if (provider.kind === 'gemini') {
      const parts = (event as { candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }> }).candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) if (part.text && !part.thought) yield part.text;
    } else {
      const e = event as { choices?: Array<{ delta?: { content?: string | null } }>; error?: { message?: string } };
      if (e.error) throw new ProviderError('MODEL_STREAM_FAILED', e.error.message ?? 'Provider stream failed.');
      const text = e.choices?.[0]?.delta?.content; if (text) yield text;
    }
  }
}
