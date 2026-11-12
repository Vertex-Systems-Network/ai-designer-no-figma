import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createServer as createNetServer } from 'node:net';

let fakeOllama: Server;
let child: ChildProcess;
let serviceUrl = '';
let requestsSeen = 0;
let lastModelPrompt = '';
let streamModeRequested = false;
let slowRequestStarted = false;
let cancelledUpstreamResponse = false;

async function freePort(): Promise<number> {
  const probe = createNetServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = (probe.address() as {port:number}).port;
  await new Promise<void>((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  return port;
}

beforeAll(async () => {
  fakeOllama = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    if (req.url === '/api/tags') {
      res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({models:[{name:'test-model:latest',details:{parameter_size:'1B'}}]})); return;
    }
    if (req.url === '/api/generate') {
      requestsSeen += 1;
      const input = JSON.parse(body) as {model:string;prompt:string;format:string;stream?:boolean};
      lastModelPrompt=input.prompt;
      streamModeRequested=input.stream===true;
      if(input.prompt.includes('slow-cancel-probe')){slowRequestStarted=true;res.on('close',()=>{cancelledUpstreamResponse=true;});return;}
      const output=JSON.stringify({echoModel:input.model,hasInstructions:input.prompt.includes('Return'),format:input.format});
      res.setHeader('Content-Type','application/x-ndjson');
      res.write(`${JSON.stringify({response:output.slice(0,Math.min(18,output.length)),done:false})}\n`);
      res.end(`${JSON.stringify({response:output.slice(Math.min(18,output.length)),done:true})}\n`); return;
    }
    res.statusCode=404;res.end('{}');
  });
  fakeOllama.listen(0,'127.0.0.1'); await once(fakeOllama,'listening');
  const ollamaPort = (fakeOllama.address() as {port:number}).port;
  const port = await freePort(); serviceUrl = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath,['--import','tsx','src/runtime/server.ts'],{
    cwd:process.cwd(),env:{...process.env,HOST:'127.0.0.1',PORT:String(port),OLLAMA_URL:`http://127.0.0.1:${ollamaPort}`,MAX_BODY_BYTES:'262144',AI_DESIGNER_PROVIDERS:'/nonexistent/providers.json',OPENAI_API_KEY:''},stdio:'ignore',
  });
  const deadline = Date.now()+8000;
  while(Date.now()<deadline){
    try{const response=await fetch(`${serviceUrl}/api/health`);if(response.ok)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error('Local runtime did not start for integration tests.');
},15000);

afterAll(async () => {
  child?.kill('SIGTERM');
  if(fakeOllama?.listening)await new Promise<void>((resolve)=>fakeOllama.close(()=>resolve()));
});

describe('loopback runtime HTTP integration',()=>{
  it('reports a local health response',async()=>{
    const response=await fetch(`${serviceUrl}/api/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ok:true,runtime:'local'});
  });
  it('lists only the local Ollama models endpoint',async()=>{
    const response=await fetch(`${serviceUrl}/api/models`);
    expect((await response.json()).models[0].name).toBe('test-model:latest');
  });
  it('rejects non-allowlisted browser origins',async()=>{
    const response=await fetch(`${serviceUrl}/api/health`,{headers:{Origin:'https://untrusted.example'}});
    expect(response.status).toBe(403);
  });
  it('requires the explicit local request marker',async()=>{
    const response=await fetch(`${serviceUrl}/api/generate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'test-model:latest',prompt:'hello'})});
    expect(response.status).toBe(403);
  });
  it('rejects models not reported as installed',async()=>{
    const response=await fetch(`${serviceUrl}/api/generate`,{method:'POST',headers:{'Content-Type':'application/json','X-AI-Designer-Local':'1'},body:JSON.stringify({model:'missing',prompt:'hello'})});
    expect(response.status).toBe(400);
  });
  it('returns actionable errors for malformed JSON and oversized bodies',async()=>{
    const malformed=await fetch(`${serviceUrl}/api/generate`,{method:'POST',headers:{'Content-Type':'application/json','X-AI-Designer-Local':'1'},body:'{broken'});
    expect(malformed.status).toBe(400);
    const oversized=await fetch(`${serviceUrl}/api/generate`,{method:'POST',headers:{'Content-Type':'application/json','X-AI-Designer-Local':'1'},body:`{"prompt":"${'x'.repeat(263000)}"}`});
    expect(oversized.status).toBe(413);
  });
  it('refuses a non-loopback listen address',async()=>{
    const blocked=spawn(process.execPath,['--import','tsx','src/runtime/server.ts'],{cwd:process.cwd(),env:{...process.env,HOST:'0.0.0.0',PORT:'18788'},stdio:['ignore','ignore','pipe']});
    const exit=once(blocked,'exit');
    const [code]=await exit;
    expect(code).not.toBe(0);
  });
  it('forwards a bounded structured request to the installed local model',async()=>{
    const response=await fetch(`${serviceUrl}/api/generate`,{method:'POST',headers:{'Content-Type':'application/json','X-AI-Designer-Local':'1'},body:JSON.stringify({model:'test-model:latest',prompt:'Create a sample screen',mode:'design'})});
    expect(response.status).toBe(200);
    const chunks=(await response.text()).trim().split('\n').map((line)=>JSON.parse(line) as {response:string;done:boolean});
    const result=chunks.map(chunk=>chunk.response).join('');
    expect(JSON.parse(result)).toMatchObject({echoModel:'test-model:latest',hasInstructions:true,format:'json'});
    expect(lastModelPrompt).toContain('Return one valid JSON object only');
    expect(lastModelPrompt).toContain('Supported node types are frame, group, component, instance, vector, image');
    expect(lastModelPrompt).toContain('Category-specific structure:');
    expect(streamModeRequested).toBe(true);
    expect(chunks.at(-1)?.done).toBe(true);
    expect(requestsSeen).toBe(1);
  });
  it('gives local patch generation the same bounded Auto Layout operation as the UI',async()=>{
    const response=await fetch(`${serviceUrl}/api/generate`,{method:'POST',headers:{'Content-Type':'application/json','X-AI-Designer-Local':'1'},body:JSON.stringify({model:'test-model:latest',prompt:'Current selection summary: node-1',mode:'patch',category:'Dashboard'})});
    expect(response.status).toBe(200);
    expect(lastModelPrompt).toContain('set-auto-layout');
    expect(lastModelPrompt).toContain('Use only supplied logical IDs');
    expect(lastModelPrompt).toContain('Dashboard');
  });
  it('propagates a cancelled UI request to the local model stream',async()=>{
    slowRequestStarted=false;cancelledUpstreamResponse=false;
    const controller=new AbortController();
    const generation=fetch(`${serviceUrl}/api/generate`,{method:'POST',headers:{'Content-Type':'application/json','X-AI-Designer-Local':'1'},body:JSON.stringify({model:'test-model:latest',prompt:'slow-cancel-probe'}) ,signal:controller.signal}).catch(()=>undefined);
    const deadline=Date.now()+2000;
    while(!slowRequestStarted&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,20));
    expect(slowRequestStarted).toBe(true);
    controller.abort();await generation;
    const closeDeadline=Date.now()+2000;
    while(!cancelledUpstreamResponse&&Date.now()<closeDeadline)await new Promise(resolve=>setTimeout(resolve,20));
    expect(cancelledUpstreamResponse).toBe(true);
  });
});
