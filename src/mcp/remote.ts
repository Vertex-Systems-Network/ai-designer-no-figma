import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { isIP } from 'node:net';
import { timingSafeEqual, randomBytes } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { mkdir, readFile, writeFile, chmod } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/server';
import { startBridgeServer } from '../bridge/server';
import { createMcpServer } from './server';
import type { JobBroker } from '../bridge/broker';

const tokenPath=()=>join(homedir(),'.ai-designer-no-figma','remote-mcp-token');
const equal=(a:string,b:string)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
export async function remoteToken(path=tokenPath()):Promise<string>{
  await mkdir(dirname(path),{recursive:true,mode:0o700});
  try{const value=(await readFile(path,'utf8')).trim();if(!/^[a-f0-9]{64}$/i.test(value))throw new Error('Remote MCP token file is invalid.');return value;}
  catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;const value=randomBytes(32).toString('hex');try{await writeFile(path,`${value}\n`,{mode:0o600,flag:'wx'});await chmod(path,0o600);return value;}catch(writeError){if((writeError as NodeJS.ErrnoException).code==='EEXIST')return remoteToken(path);throw writeError;}}
}
export async function startRemoteMcpServer(broker:JobBroker,options:{host?:string;port?:number;token?:string;pairingCode?:()=>Promise<string>}={}){
  if(options.port===undefined){let last:unknown;for(const candidate of [8790,8800,8801,8802,8803,8804,8805,8806,8807,8808,8809]){try{return await startRemoteMcpServer(broker,{...options,port:candidate});}catch(error){if((error as NodeJS.ErrnoException).code!=='EADDRINUSE')throw error;last=error;}}throw new Error('All remote MCP listener ports are occupied.',{cause:last});}
  const host=options.host??'127.0.0.1',port=options.port;
  if(!isIP(host)||!['127.0.0.1','::1'].includes(host))throw new Error('Remote MCP listener must bind to loopback.');
  if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Invalid remote MCP port.');
  const token=options.token??await remoteToken();if(!/^[a-f0-9]{64}$/i.test(token))throw new Error('Remote MCP token must be 64 hexadecimal characters.');
  let active=0;
  const server=createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    // Two ways in: /mcp with a Bearer header (desktop clients), or /mcp/<secret> for browser AIs
    // (ChatGPT, Claude.ai) whose connector forms cannot send custom headers. Both use the same secret.
    const path=(req.url??'').split('?')[0]??'';
    const pathSecret=path.startsWith('/mcp/')?path.slice(5):undefined;
    if(path!=='/mcp'&&pathSecret===undefined){res.writeHead(404).end();return;}
    if(req.method!=='POST'){res.writeHead(405,{Allow:'POST'}).end();return;}
    if(req.headers.origin){res.writeHead(403).end();return;}
    const authorization=req.headers.authorization??'';
    const authorized=pathSecret!==undefined?equal(pathSecret,token):authorization.startsWith('Bearer ')&&equal(authorization.slice(7),token);
    if(!authorized){res.writeHead(401,{'WWW-Authenticate':'Bearer'}).end();return;}
    if(active>=8){res.writeHead(429).end();return;}
    active++;
    try{await handle(req,res,broker,options.pairingCode);}catch{if(!res.headersSent)res.writeHead(400).end();else res.destroy();}finally{active--;}
  });
  server.listen(port,host);
  await new Promise<void>((done,reject)=>{server.once('listening',done);server.once('error',reject);});
  const address=server.address();if(!address||typeof address==='string')throw new Error('Remote listener address unavailable.');
  return{server,address:()=>({host:address.address,port:address.port}),close:()=>new Promise<void>((done,reject)=>{server.close(error=>error?reject(error):done());server.closeAllConnections();})};
}
async function handle(req:IncomingMessage,res:ServerResponse,broker:JobBroker,pairingCode?:()=>Promise<string>){
  const chunks:Buffer[]=[];let length=0;
  for await(const part of req){const bytes=Buffer.from(part as Uint8Array);length+=bytes.length;if(length>6*1024*1024){res.writeHead(413).end();return;}chunks.push(bytes);}
  const headers=new Headers();for(const [key,value] of Object.entries(req.headers))if(typeof value==='string')headers.set(key,value);
  const request=new Request('http://localhost/mcp',{method:'POST',headers,body:Buffer.concat(chunks)});
  const transport=new WebStandardStreamableHTTPServerTransport({enableJsonResponse:true});// Browser mode builds a fresh MCP server per HTTP request, so the initialize handshake is gone by the
  // time a tool call arrives. Name the agent from the caller's User-Agent instead (only known AI clients).
  const userAgent=req.headers['user-agent']??'';
  const fromAgent=/claude|anthropic/i.test(userAgent)?'Claude':/openai|chatgpt/i.test(userAgent)?'ChatGPT':undefined;
  const mcp=createMcpServer(broker,{...(pairingCode?{pairingCode}:{}),...(fromAgent?{defaultAgent:fromAgent}:{})});
  try{
    await mcp.connect(transport);
    const response=await transport.handleRequest(request);
    const body=Buffer.from(await response.arrayBuffer());
    if(body.length>8*1024*1024){res.writeHead(502).end();return;}
    response.headers.forEach((value,key)=>{if(!['content-length','transfer-encoding','connection'].includes(key.toLowerCase()))res.setHeader(key,value);});
    res.writeHead(response.status).end(body);
  }finally{await mcp.close();}
}
/** Publish the hub's real address so setup:clients never guesses a port. */
export async function writeHubInfo(url:string,path=join(homedir(),'.ai-designer-no-figma','hub.json')):Promise<void>{
  await mkdir(dirname(path),{recursive:true,mode:0o700});await writeFile(path,`${JSON.stringify({url,updatedAt:new Date().toISOString()})}\n`,{mode:0o600});await chmod(path,0o600);
}
export async function startRemoteServices(){
  const bridge=await startBridgeServer({autoPort:true,pairingMode:'remote'});
  try{const remote=await startRemoteMcpServer(bridge.broker,{pairingCode:()=>bridge.pairing.reveal()});return{bridge,remote};}
  catch(error){await bridge.close();throw error;}
}
/** Browser mode: expose only the remote MCP port through a Cloudflare quick tunnel and print the connector URL. */
export function connectorUrl(tunnelOutput:string,secret:string):string|undefined{
  const match=/https:\/\/(?!api\.)[a-z0-9-]+\.trycloudflare\.com(?![a-z0-9.-])/i.exec(tunnelOutput);return match?`${match[0]}/mcp/${secret}`:undefined;
}
function startTunnel(port:number,secret:string){
  const child=spawn('cloudflared',['tunnel','--no-autoupdate','--url',`http://127.0.0.1:${port}`],{stdio:['ignore','pipe','pipe']});
  let shown=false;const buffers={out:'',err:''};
  // Output arrives in arbitrary chunks; keep a bounded tail per stream so a URL split across chunks is still found.
  const watcher=(stream:'out'|'err')=>(chunk:Buffer)=>{if(shown)return;buffers[stream]=(buffers[stream]+chunk.toString()).slice(-4096);const url=connectorUrl(buffers[stream],secret);if(url){shown=true;console.error(`\n[ai-designer] BROWSER MODE READY. Paste this URL into ChatGPT (Developer mode → Create connector) or Claude.ai (Settings → Connectors → Add custom connector):\n\n    ${url}\n\n[ai-designer] Anyone with this URL can drive your paired Figma file. Do not share it. Stop with Ctrl+C.`);}};
  child.stdout.on('data',watcher('out'));child.stderr.on('data',watcher('err'));
  child.on('error',error=>{console.error((error as NodeJS.ErrnoException).code==='ENOENT'?'[ai-designer] cloudflared is not installed. Install it (winget install Cloudflare.cloudflared / brew install cloudflared), then run npm run mcp:browser again. Local mode keeps working.':`[ai-designer] Tunnel failed: ${error.message}`);});
  child.on('exit',code=>{if(code)console.error(`[ai-designer] Tunnel stopped (exit ${code}). Browser AIs are disconnected; local mode keeps working.`);});
  return child;
}
async function main(){
  const {bridge,remote}=await startRemoteServices();
  console.error(`[ai-designer] Figma pairing bridge on ${bridge.address().host}:${bridge.address().port}; remote MCP on http://${remote.address().host}:${remote.address().port}/mcp`);
  console.error(`[ai-designer] Remote bearer secret stored at ${tokenPath()}; tunnel only port ${remote.address().port}, never the pairing bridge.`);
  if(!process.argv.includes('--tunnel'))console.error('[ai-designer] Browser AIs: run npm run mcp:browser to get a connector URL (path /mcp/<secret from remote-mcp-token>).');
  console.error(`[ai-designer] Figma pairing code: ${bridge.pairing.current()} (also in ~/.ai-designer-no-figma/pairing-code-${bridge.address().port}). Press Enter here for a new code.`);
  await writeHubInfo(`http://${remote.address().host}:${remote.address().port}/mcp`);
  if(process.stdin.isTTY){process.stdin.on('data',()=>{void bridge.pairing.reset().then(code=>console.error(`[ai-designer] New Figma pairing code: ${code}`));});}
  const tunnel=process.argv.includes('--tunnel')?startTunnel(remote.address().port,await remoteToken()):undefined;
  const shutdown=()=>{tunnel?.kill();void remote.close().then(()=>bridge.close());};process.once('SIGINT',shutdown);process.once('SIGTERM',shutdown);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)void main().catch(error=>{console.error(error);process.exitCode=1;});
