import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { isIP } from 'node:net';
import { buildDesignPrompt } from '../shared/prompts';

const host = process.env.HOST ?? '127.0.0.1';
const port = Number(process.env.PORT ?? 8787);
const ollamaUrl = process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434';
const maxBytes = Math.min(Number(process.env.MAX_BODY_BYTES ?? 262144), 1_048_576);
const maxModelOutputBytes = 512_000;
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
      const settings={category:input.category??'Custom Interface',platform:input.platform??'Desktop',canvasSize:input.canvasSize??'1440x900',style:input.style??'Balanced',brandColor:input.brandColor??'#087A55',density:input.density??'balanced',typography:input.typography??'system UI',complexity:input.complexity??'standard'};
      const system = input.mode === 'patch'
        ? 'Return only JSON with an operations array. Each operation must be exactly one of {op:"set-text",targetId:string,value:string}, {op:"set-fill",targetId:string,value:"#RRGGBB"}, {op:"rename",targetId:string,value:string}, {op:"set-bounds",targetId:string,value:{x:number,y:number,width:number,height:number}}, {op:"set-auto-layout",targetId:string,value:{mode:"NONE"|"HORIZONTAL"|"VERTICAL",gap:number,padding:number,alignment:"MIN"|"CENTER"|"MAX"|"SPACE_BETWEEN"}}. Use only supplied logical IDs. For bounds use positive width/height. Do not return markdown or code.'
        : undefined;
      const prompt = input.mode === 'patch'
        ? `${system}\n\nCategory: ${settings.category}\nPlatform: ${settings.platform}\nCanvas: ${settings.canvasSize}\nStyle: ${settings.style}\nBrand color: ${settings.brandColor}\nDensity: ${settings.density}\nTypography: ${settings.typography}\nComponent complexity: ${settings.complexity}\n\nUser brief:\n${input.prompt}`
        : buildDesignPrompt(input.prompt, settings);
      const controller = new AbortController();
      res.on('close', () => { if (!res.writableEnded) controller.abort(); });
      const timeout = setTimeout(() => controller.abort(), 180_000);
      try {
        const response = await fetch(new URL('/api/generate', ollama), {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
          body: JSON.stringify({ model: input.model, prompt, stream: true, format: 'json', options: { temperature: 0.3, num_predict: 8192 } }),
        });
        if (!response.ok) return json(res, 502, { error: { code: 'MODEL_REQUEST_FAILED', message: `Local model runtime returned ${response.status}.` } });
        if (!response.body) return json(res, 502, { error: { code: 'MODEL_STREAM_UNAVAILABLE', message: 'Local model runtime did not provide a response stream.' } });
        res.statusCode=200;
        res.setHeader('Content-Type','application/x-ndjson; charset=utf-8');
        res.setHeader('X-Content-Type-Options','nosniff');
        const decoder=new TextDecoder();let pending='';let outputBytes=0;
        const consume=(line:string):void=>{
          if(!line.trim())return;
          const item=JSON.parse(line) as {response?:unknown;done?:boolean};
          const text=typeof item.response==='string'?item.response:'';
          outputBytes+=Buffer.byteLength(text);
          if(outputBytes>maxModelOutputBytes)throw new Error('Local model output exceeds the 500 KB limit.');
          res.write(`${JSON.stringify({response:text,done:item.done===true})}\n`);
        };
        const reader=response.body.getReader();
        try{while(true){const {value,done}=await reader.read();if(done)break;pending+=decoder.decode(value,{stream:true});const lines=pending.split('\n');pending=lines.pop()??'';for(const line of lines)consume(line);}pending+=decoder.decode();if(pending.trim())consume(pending);}finally{reader.releaseLock();}
        return res.end();
      } finally {clearTimeout(timeout);}
    }
    return json(res, 404, { error: { code: 'NOT_FOUND', message: 'Unknown local endpoint.' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Local runtime error.';
    const code = error instanceof SyntaxError ? 400 : message.includes('size limit') ? 413 : message.includes('timeout') ? 504 : 503;
    if(res.headersSent){if(!res.destroyed)res.end(`${JSON.stringify({error:{code:'MODEL_STREAM_FAILED',message}})}\n`);return;}
    return json(res, code, { error: { code: 'LOCAL_RUNTIME_ERROR', message } });
  }
});

server.listen(port, host, () => console.log(`AI Designer local service listening on http://${host}:${port}`));
server.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
