import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { isIP } from 'node:net';
import { timingSafeEqual, randomBytes } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { mkdir, readFile, writeFile, chmod } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
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
export async function startRemoteMcpServer(broker:JobBroker,options:{host?:string;port?:number;token?:string}={}){
  const host=options.host??'127.0.0.1',port=options.port??8790;
  if(!isIP(host)||!['127.0.0.1','::1'].includes(host))throw new Error('Remote MCP listener must bind to loopback.');
  if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Invalid remote MCP port.');
  const token=options.token??await remoteToken();if(!/^[a-f0-9]{64}$/i.test(token))throw new Error('Remote MCP token must be 64 hexadecimal characters.');
  let active=0;
  const server=createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    if(req.url!=='/mcp'||req.method!=='POST'){res.writeHead(404).end();return;}
    if(req.headers.origin){res.writeHead(403).end();return;}
    const authorization=req.headers.authorization??'';
    if(!authorization.startsWith('Bearer ')||!equal(authorization.slice(7),token)){res.writeHead(401,{'WWW-Authenticate':'Bearer'}).end();return;}
    if(active>=8){res.writeHead(429).end();return;}
    active++;
    try{await handle(req,res,broker);}catch{if(!res.headersSent)res.writeHead(400).end();else res.destroy();}finally{active--;}
  });
  server.listen(port,host);
  await new Promise<void>((done,reject)=>{server.once('listening',done);server.once('error',reject);});
  const address=server.address();if(!address||typeof address==='string')throw new Error('Remote listener address unavailable.');
  return{server,address:()=>({host:address.address,port:address.port}),close:()=>new Promise<void>((done,reject)=>{server.close(error=>error?reject(error):done());server.closeAllConnections();})};
}
async function handle(req:IncomingMessage,res:ServerResponse,broker:JobBroker){
  const chunks:Buffer[]=[];let length=0;
  for await(const part of req){const bytes=Buffer.from(part as Uint8Array);length+=bytes.length;if(length>6*1024*1024){res.writeHead(413).end();return;}chunks.push(bytes);}
  const headers=new Headers();for(const [key,value] of Object.entries(req.headers))if(typeof value==='string')headers.set(key,value);
  const request=new Request('http://localhost/mcp',{method:'POST',headers,body:Buffer.concat(chunks)});
  const transport=new WebStandardStreamableHTTPServerTransport({enableJsonResponse:true});const mcp=createMcpServer(broker);
  try{
    await mcp.connect(transport);
    const response=await transport.handleRequest(request);
    const body=Buffer.from(await response.arrayBuffer());
    if(body.length>8*1024*1024){res.writeHead(502).end();return;}
    response.headers.forEach((value,key)=>{if(!['content-length','transfer-encoding','connection'].includes(key.toLowerCase()))res.setHeader(key,value);});
    res.writeHead(response.status).end(body);
  }finally{await mcp.close();}
}
export function bridgeStartupMessage(error:unknown):string|undefined{
  return (error as NodeJS.ErrnoException)?.code==='EADDRINUSE'?'Port 8788 is already owned by another local bridge (often Claude Desktop). Close that MCP process before starting remote mode; one process must own Figma pairing. Your Figma file stays unchanged.':undefined;
}
export async function startRemoteServices(){
  let bridge:Awaited<ReturnType<typeof startBridgeServer>>;
  try{bridge=await startBridgeServer();}
  catch(error){const message=bridgeStartupMessage(error);if(message)throw new Error(message,{cause:error});throw error;}
  try{const remote=await startRemoteMcpServer(bridge.broker);return{bridge,remote};}
  catch(error){await bridge.close();throw error;}
}
async function main(){
  const {bridge,remote}=await startRemoteServices();
  console.error(`[ai-designer] Figma pairing bridge on ${bridge.address().host}:${bridge.address().port}; remote MCP on http://${remote.address().host}:${remote.address().port}/mcp`);
  console.error(`[ai-designer] Remote bearer secret stored at ${tokenPath()}; tunnel only port ${remote.address().port}, never the pairing bridge.`);
  const shutdown=()=>{void remote.close().then(()=>bridge.close());};process.once('SIGINT',shutdown);process.once('SIGTERM',shutdown);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)void main().catch(error=>{console.error(error);process.exitCode=1;});
