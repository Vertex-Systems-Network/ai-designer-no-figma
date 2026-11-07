import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { isIP } from 'node:net';

const host = process.env.HOST ?? '127.0.0.1';
const port = Number(process.env.PORT ?? 8787);
const ollamaUrl = process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434';
const maxBytes = Math.min(Number(process.env.MAX_BODY_BYTES ?? 262144), 1_048_576);
const allowedOrigins = new Set(['https://www.figma.com', 'https://figma.com', 'http://127.0.0.1:5173', 'http://localhost:5173']);

if (!isIP(host) || !['127.0.0.1', '::1'].includes(host)) throw new Error('HOST must be a loopback IP address (127.0.0.1 or ::1).');
const ollama = new URL(ollamaUrl);
if (!['127.0.0.1', 'localhost', '[::1]'].includes(ollama.hostname)) throw new Error('OLLAMA_URL must point to a loopback host.');

function headers(res: ServerResponse, origin: string | undefined): void {
  if (origin && allowedOrigins.has(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-AI-Designer-Local');
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
    if (req.method === 'GET' && url.pathname === '/api/models') {
      const response = await fetch(new URL('/api/tags', ollama), { signal: AbortSignal.timeout(3000) });
      if (!response.ok) return json(res, 503, { error: { code: 'OLLAMA_UNAVAILABLE', message: `Ollama returned ${response.status}.` } });
      return json(res, 200, await response.json());
    }
    if (req.method === 'POST' && url.pathname === '/api/generate') {
      if (req.headers['x-ai-designer-local'] !== '1') return json(res, 403, { error: { code: 'MISSING_LOCAL_HEADER', message: 'Required local request marker is missing.' } });
      const input = JSON.parse(await body(req)) as { model?: string; prompt?: string; category?: string; style?: string; mode?: 'design' | 'patch'; platform?: string; canvasSize?: string; brandColor?: string; density?: string; typography?: string; complexity?: string };
      if (!input.model || !/^[\w.:-]{1,120}$/.test(input.model)) return json(res, 400, { error: { code: 'INVALID_MODEL', message: 'Choose a model reported by the local runtime.' } });
      if (!input.prompt?.trim() || input.prompt.length > 12000) return json(res, 400, { error: { code: 'INVALID_PROMPT', message: 'Prompt must contain 1–12000 characters.' } });
      const tagsResponse = await fetch(new URL('/api/tags', ollama), { signal: AbortSignal.timeout(3000) });
      if (!tagsResponse.ok) return json(res, 503, { error: { code: 'OLLAMA_UNAVAILABLE', message: 'Could not enumerate installed Ollama models.' } });
      const tags = await tagsResponse.json() as { models?: Array<{name:string}> };
      if (!tags.models?.some((candidate) => candidate.name === input.model)) return json(res, 400, { error: { code: 'MODEL_NOT_INSTALLED', message: 'Selected model is not present in the local Ollama model list.' } });
      const system = input.mode === 'patch'
        ? 'Return only JSON with an operations array. Each operation must be exactly one of {op:"set-text",targetId:string,value:string}, {op:"set-fill",targetId:string,value:"#RRGGBB"}, or {op:"rename",targetId:string,value:string}. Use only supplied logical IDs. Do not return markdown or code.'
        : 'Return only JSON matching schemaVersion 1.0 with name and pages. Each page has id, name, children. Supported node types: frame, group, text, rectangle, ellipse, line. Every node requires unique id, name, positive width and height. Use editable layers and concise meaningful text. Do not return markdown or code.';
      const prompt = `${system}\n\nCategory: ${input.category ?? 'Custom Interface'}\nPlatform: ${input.platform ?? 'Desktop'}\nCanvas: ${input.canvasSize ?? '1440x900'}\nStyle: ${input.style ?? 'Balanced'}\nBrand color: ${input.brandColor ?? 'not specified'}\nDensity: ${input.density ?? 'balanced'}\nTypography: ${input.typography ?? 'system UI'}\nComponent complexity: ${input.complexity ?? 'standard'}\n\nUser brief:\n${input.prompt}`;
      const controller = new AbortController();
      res.on('close', () => { if (!res.writableEnded) controller.abort(); });
      const timeout = setTimeout(() => controller.abort(), 180_000);
      const response = await fetch(new URL('/api/generate', ollama), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ model: input.model, prompt, stream: false, format: 'json', options: { temperature: 0.3, num_predict: 8192 } }),
      });
      clearTimeout(timeout);
      if (!response.ok) return json(res, 502, { error: { code: 'MODEL_REQUEST_FAILED', message: `Local model runtime returned ${response.status}.` } });
      const output = await response.json() as { response?: string; done?: boolean };
      return json(res, 200, { response: output.response ?? '', done: output.done ?? true });
    }
    return json(res, 404, { error: { code: 'NOT_FOUND', message: 'Unknown local endpoint.' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Local runtime error.';
    const code = error instanceof SyntaxError ? 400 : message.includes('size limit') ? 413 : message.includes('timeout') ? 504 : 503;
    return json(res, code, { error: { code: 'LOCAL_RUNTIME_ERROR', message } });
  }
});

server.listen(port, host, () => console.log(`AI Designer local service listening on http://${host}:${port}`));
server.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
