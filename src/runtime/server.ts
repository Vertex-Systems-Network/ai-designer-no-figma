import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { isIP } from 'node:net';
import { buildDesignPrompt } from '../shared/prompts';
import { runDesignAgent } from './design-agent';
import { PairingGate } from '../bridge/server';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { listModels, loadProviders, ProviderError, publicProvider, streamText, type ProviderConfig } from './providers';

const host = process.env.HOST ?? '127.0.0.1';
const port = Number(process.env.PORT ?? 8787);
const ollamaUrl = process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434';
const maxBytes = Math.min(Number(process.env.MAX_BODY_BYTES ?? 262144), 1_048_576);
const maxModelOutputBytes = 512_000;
// Figma plugin iframes report `Origin: null`; without it the plugin could never reach this service.
// Generation also requires the X-AI-Designer-Local header (forces a CORS preflight) and only one job runs at a time.
const allowedOrigins = new Set(['https://www.figma.com', 'https://figma.com', 'null', 'http://127.0.0.1:5173', 'http://localhost:5173']);
const maxConcurrent = 1;
// Origin and the X-AI-Designer-Local header are not authentication (any page can send Origin: null),
// so every model endpoint needs a bearer token issued only after the user types the terminal's pairing code.
const stateDir = process.env.AI_DESIGNER_HOME ?? join(homedir(), '.ai-designer-no-figma');
async function runtimeToken(): Promise<string> {
  const path = join(stateDir, 'runtime-token');
  try { const value = (await readFile(path, 'utf8')).trim(); if (/^[a-f0-9]{64}$/.test(value)) return value; } catch { /* create below */ }
  const value = randomBytes(32).toString('hex');
  await mkdir(dirname(path), { recursive: true, mode: 0o700 }); await writeFile(path, `${value}\n`, { mode: 0o600 }); await chmod(path, 0o600);
  return value;
}
const token = await runtimeToken();
const pairing = await PairingGate.create(process.env.RUNTIME_PAIRING_CODE ? undefined : join(stateDir, 'runtime-pairing-code'), process.env.RUNTIME_PAIRING_CODE);
const authorized = (header: string | undefined) => { const supplied = Buffer.from(header?.startsWith('Bearer ') ? header.slice(7) : ''); const expected = Buffer.from(token); return supplied.length === expected.length && timingSafeEqual(supplied, expected); };
let active = 0;
async function findProvider(id: string): Promise<ProviderConfig> {
  const provider = (await loadProviders()).find((item) => item.id === id);
  if (!provider) throw new ProviderError('UNKNOWN_PROVIDER', `Provider ${id} is not configured.`, 400);
  return provider;
}

if (!isIP(host) || !['127.0.0.1', '::1'].includes(host)) throw new Error('HOST must be a loopback IP address (127.0.0.1 or ::1).');
const ollama = new URL(ollamaUrl);
if (!['127.0.0.1', 'localhost', '[::1]'].includes(ollama.hostname)) throw new Error('OLLAMA_URL must point to a loopback host.');

function headers(res: ServerResponse, origin: string | undefined): void {
  if (origin && allowedOrigins.has(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-AI-Designer-Local');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
}
function json(res: ServerResponse, status: number, value: unknown): void { res.statusCode = status; res.end(JSON.stringify(value)); }
async function body(req: IncomingMessage): Promise<string> {
  let text = ''; let bytes = 0;
  for await (const chunk of req) {
    bytes += Buffer.byteLength(chunk);
    if (bytes > maxBytes) throw new Error('Request exceeds the configured size limit.');
    text += chunk;
  }
  return text;
}

const server = createServer(async (req, res) => {
  headers(res, req.headers.origin);
  const origin = req.headers.origin;
  if (origin && !allowedOrigins.has(origin)) return json(res, 403, { error: { code: 'ORIGIN_DENIED', message: 'Request origin is not allowed.' } });
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  try {
    if (req.method === 'GET' && url.pathname === '/api/health') return json(res, 200, { ok: true, runtime: 'local', ollamaUrl });
    if (req.method === 'POST' && url.pathname === '/api/pair') {
      const input = JSON.parse(await body(req)) as { code?: unknown };
      try { if (!await pairing.verify(input.code)) return json(res, 401, { error: { code: 'PAIRING_CODE_INVALID', message: 'Wrong runtime pairing code. Use the code printed in the npm run runtime terminal.' } }); }
      catch { return json(res, 429, { error: { code: 'PAIRING_LOCKED', message: 'Too many wrong codes. Press Enter in the runtime terminal for a new code.' } }); }
      return json(res, 200, { ok: true, token });
    }
    if (!authorized(req.headers.authorization)) return json(res, 401, { error: { code: 'RUNTIME_UNAUTHORIZED', message: 'Pair the plugin with the local runtime first (Settings → runtime pairing code).' } });
    if (req.method === 'GET' && url.pathname === '/api/providers') {
      const providers = await loadProviders();
      return json(res, 200, { providers: providers.map((provider) => publicProvider(provider)), configFile: 'providers.json in ~/.ai-designer-no-figma (or AI_DESIGNER_PROVIDERS)' });
    }
    if (req.method === 'GET' && url.pathname === '/api/models') {
      const provider = await findProvider(url.searchParams.get('provider') ?? 'ollama');
      return json(res, 200, { provider: provider.id, models: await listModels(provider) });
    }
    if (req.method === 'POST' && (url.pathname === '/api/generate' || url.pathname === '/api/agent')) {
      if (req.headers['x-ai-designer-local'] !== '1') return json(res, 403, { error: { code: 'MISSING_LOCAL_HEADER', message: 'Required local request marker is missing.' } });
      const input = JSON.parse(await body(req)) as { provider?: string; model?: string; prompt?: string; category?: string; style?: string; mode?: 'design' | 'patch'; platform?: string; canvasSize?: string; brandColor?: string; density?: string; typography?: string; complexity?: string };
      if (!input.model || !/^[\w.:/@-]{1,160}$/.test(input.model)) return json(res, 400, { error: { code: 'INVALID_MODEL', message: 'Choose a model reported by the selected provider.' } });
      if (!input.prompt?.trim() || input.prompt.length > 12000) return json(res, 400, { error: { code: 'INVALID_PROMPT', message: 'Prompt must contain 1–12000 characters.' } });
      const provider = await findProvider(input.provider ?? 'ollama');
      const status = publicProvider(provider);
      if (!status.ready) return json(res, 400, { error: { code: 'PROVIDER_NOT_CONFIGURED', message: status.reason ?? 'Provider is not configured.' } });
      if (!provider.models?.length || provider.kind === 'ollama') {
        let installed: Array<{ name: string }>;
        try { installed = await listModels(provider); } catch { installed = []; if (provider.kind === 'ollama') return json(res, 503, { error: { code: 'OLLAMA_UNAVAILABLE', message: 'Could not enumerate installed Ollama models.' } }); }
        if ((provider.kind === 'ollama' || installed.length) && !installed.some((candidate) => candidate.name === input.model)) return json(res, 400, { error: { code: 'MODEL_NOT_INSTALLED', message: `Model ${input.model} is not offered by ${provider.label}.` } });
      }
      if (active >= maxConcurrent) return json(res, 429, { error: { code: 'RUNTIME_BUSY', message: 'Another generation is running. Wait for it or cancel it first.' } });
      const settings={category:input.category??'Custom Interface',platform:input.platform??'Desktop',canvasSize:input.canvasSize??'1440x900',style:input.style??'Balanced',brandColor:input.brandColor??'#087A55',density:input.density??'balanced',typography:input.typography??'system UI',complexity:input.complexity??'standard'};
      const patchSystem = 'Return only JSON with an operations array. Each operation must be exactly one of {op:"set-text",targetId:string,value:string}, {op:"set-fill",targetId:string,value:"#RRGGBB"}, {op:"rename",targetId:string,value:string}, {op:"set-bounds",targetId:string,value:{x:number,y:number,width:number,height:number}}, {op:"set-auto-layout",targetId:string,value:{mode:"NONE"|"HORIZONTAL"|"VERTICAL",gap:number,padding:number,alignment:"MIN"|"CENTER"|"MAX"|"SPACE_BETWEEN"}}. Use only supplied logical IDs. For bounds use positive width/height. Do not return markdown or code.';
      const request = input.mode === 'patch'
        ? { system: patchSystem, prompt: `Category: ${settings.category}\nPlatform: ${settings.platform}\nCanvas: ${settings.canvasSize}\nStyle: ${settings.style}\nBrand color: ${settings.brandColor}\nDensity: ${settings.density}\nTypography: ${settings.typography}\nComponent complexity: ${settings.complexity}\n\nUser brief:\n${input.prompt}` }
        : { prompt: buildDesignPrompt(input.prompt, settings) };
      const controller = new AbortController();
      res.on('close', () => { if (!res.writableEnded) controller.abort(); });
      const timeout = setTimeout(() => controller.abort(), 180_000);
      active++;
      try {
        if (url.pathname === '/api/agent' && input.mode !== 'patch') {
          res.statusCode = 200; res.setHeader('Content-Type','application/x-ndjson; charset=utf-8'); res.setHeader('X-Content-Type-Options','nosniff');
          const complete = async (call: { system?: string; prompt: string }) => {
            let out = '';
            for await (const text of streamText(provider, { model: input.model!, ...call, json: true, signal: controller.signal })) {
              out += text; if (Buffer.byteLength(out) > maxModelOutputBytes) throw new Error('Model output exceeds the 500 KB limit.');
            }
            return out;
          };
          for await (const event of runDesignAgent(input.prompt, settings, complete)) {
            if (event.type === 'result') res.write(`${JSON.stringify({ response: event.json, findings: event.findings, rounds: event.rounds, done: true })}\n`);
            else res.write(`${JSON.stringify({ agent: event, done: false })}\n`);
          }
          return res.end();
        }
        const stream = streamText(provider, { model: input.model, ...request, json: true, signal: controller.signal });
        let outputBytes = 0; let started = false;
        for await (const text of stream) {
          if (!started) { started = true; res.statusCode = 200; res.setHeader('Content-Type','application/x-ndjson; charset=utf-8'); res.setHeader('X-Content-Type-Options','nosniff'); }
          outputBytes += Buffer.byteLength(text);
          if (outputBytes > maxModelOutputBytes) throw new Error('Model output exceeds the 500 KB limit.');
          res.write(`${JSON.stringify({ response: text, done: false })}\n`);
        }
        if (!started) { res.statusCode = 200; res.setHeader('Content-Type','application/x-ndjson; charset=utf-8'); }
        res.write(`${JSON.stringify({ response: '', done: true })}\n`);
        return res.end();
      } finally { clearTimeout(timeout); active--; }
    }
    return json(res, 404, { error: { code: 'NOT_FOUND', message: 'Unknown local endpoint.' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Local runtime error.';
    const code = error instanceof ProviderError ? error.status : error instanceof SyntaxError ? 400 : message.includes('size limit') ? 413 : message.includes('timeout') ? 504 : 503;
    if(res.headersSent){if(!res.destroyed)res.end(`${JSON.stringify({error:{code:'MODEL_STREAM_FAILED',message}})}\n`);return;}
    return json(res, code, { error: { code: error instanceof ProviderError ? error.code : 'LOCAL_RUNTIME_ERROR', message } });
  }
});

server.listen(port, host, () => console.log(`AI Designer local service listening on http://${host}:${port}\nRuntime pairing code: ${pairing.current()} (type it in the plugin Settings; press Enter here for a new code)`));
if (process.stdin.isTTY) process.stdin.on('data', () => { void pairing.reset().then((code) => console.log(`New runtime pairing code: ${code}`)); });
server.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
