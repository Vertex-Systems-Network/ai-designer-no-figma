import { timingSafeEqual, randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { isIP } from 'node:net';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { BridgeFault, JobBroker } from './broker';

const allowedOrigins = new Set(['https://www.figma.com','https://figma.com','null','http://127.0.0.1:5173','http://localhost:5173']);
const maxBodyBytes = 1_048_576;
type ServerOptions = { host?: string; port?: number; token?: string; tokenFile?: string; broker?: JobBroker };

export async function startBridgeServer(options: ServerOptions = {}): Promise<{server:Server;broker:JobBroker;token:string;close:()=>Promise<void>;address:()=>{host:string;port:number}}>{
  const host=options.host??process.env.BRIDGE_HOST??'127.0.0.1';
  const port=options.port??Number(process.env.BRIDGE_PORT??8788);
  if (!isIP(host)||!['127.0.0.1','::1'].includes(host)) throw new Error('BRIDGE_HOST must be a loopback IP address.');
  if (!Number.isInteger(port)||port<0||port>65535) throw new Error('BRIDGE_PORT must be between 0 and 65535.');
  const token=await readOrCreateToken(options.token??process.env.BRIDGE_TOKEN,options.tokenFile);
  const broker=options.broker??new JobBroker();
  const server=createServer(async(req,res)=>{
    try { await handle(req,res,broker,token); }
    catch(error){
      const fault=error instanceof BridgeFault?error:new BridgeFault('BRIDGE_INTERNAL_ERROR',error instanceof Error?error.message:'Bridge request failed.');
      sendJson(res,fault.code==='INVALID_JSON'?400:fault.code==='BODY_TOO_LARGE'?413:fault.code==='UNAUTHORIZED'?401:fault.code==='ORIGIN_DENIED'?403:fault.code==='NOT_FOUND'?404:409,{error:{code:fault.code,message:fault.message}});
    }
  });
  server.listen(port,host);
  await new Promise<void>((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
  const actual=server.address();
  if (!actual||typeof actual==='string') throw new Error('Bridge server did not expose a TCP address.');
  let closePromise:Promise<void>|undefined;
  const close=():Promise<void>=>{
    if(closePromise)return closePromise;
    closePromise=new Promise((resolve,reject)=>{
      server.close((error)=>error?reject(error):resolve());
      // MCP clients may restart their stdio process while HTTP keep-alive
      // sockets from the Figma plugin are still open. Drain them so the next
      // process can bind the same loopback port immediately.
      server.closeAllConnections();
    });
    return closePromise;
  };
  return {server,broker,token,close,address:()=>({host:actual.address,port:actual.port})};
}

async function handle(req:IncomingMessage,res:ServerResponse,broker:JobBroker,token:string):Promise<void>{
  const origin=req.headers.origin;
  if (origin&&!allowedOrigins.has(origin)) throw new BridgeFault('ORIGIN_DENIED','Request origin is not allowed.');
  if (origin) res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');
  if (req.method==='OPTIONS'){res.statusCode=204;res.end();return;}
  const authorization=req.headers.authorization??'';
  const supplied=authorization.startsWith('Bearer ')?authorization.slice(7):'';
  if(!constantTimeEqual(supplied,token))throw new BridgeFault('UNAUTHORIZED','Bridge pairing token is missing or invalid.');
  const url=new URL(req.url??'/','http://127.0.0.1');
  if(req.method==='GET'&&url.pathname==='/bridge/health'){
    sendJson(res,200,{ok:true,service:'local-figma-bridge',activeSessions:broker.getSessions().length});return;
  }
  if(req.method==='POST'&&url.pathname==='/bridge/sessions/connect'){
    const data=await readBody(req) as {sessionId?:unknown;pluginVersion?:unknown};
    if(typeof data.sessionId!=='string'||typeof data.pluginVersion!=='string')throw new BridgeFault('INVALID_SESSION','sessionId and pluginVersion are required.');
    sendJson(res,200,{session:broker.connect(data.sessionId,data.pluginVersion)});return;
  }
  if(req.method==='POST'&&url.pathname==='/bridge/sessions/heartbeat'){
    const data=await readBody(req) as {sessionId?:unknown};
    if(typeof data.sessionId!=='string')throw new BridgeFault('INVALID_SESSION','sessionId is required.');
    sendJson(res,200,{session:broker.heartbeat(data.sessionId)});return;
  }
  const nextMatch=url.pathname.match(/^\/bridge\/sessions\/([a-zA-Z0-9:_-]+)\/jobs\/next$/);
  if(req.method==='GET'&&nextMatch){sendJson(res,200,{job:broker.takeNext(nextMatch[1]!)});return;}
  const resultMatch=url.pathname.match(/^\/bridge\/jobs\/([0-9a-f-]{36})\/result$/i);
  if(req.method==='POST'&&resultMatch){
    const data=await readBody(req) as {sessionId?:unknown;ok?:unknown;result?:unknown;error?:unknown};
    if(typeof data.sessionId!=='string'||typeof data.ok!=='boolean')throw new BridgeFault('INVALID_RESULT','sessionId and boolean ok are required.');
    const error=data.error&&typeof data.error==='object'?data.error as {code?:unknown;message?:unknown}:undefined;
    const job=broker.complete(data.sessionId,resultMatch[1]!,data.ok,data.result,{code:typeof error?.code==='string'?error.code:'PLUGIN_OPERATION_FAILED',message:typeof error?.message==='string'?error.message:'Plugin operation failed.'});
    sendJson(res,200,{job});return;
  }
  throw new BridgeFault('NOT_FOUND','Unknown bridge route.');
}

async function readBody(req:IncomingMessage):Promise<Record<string,unknown>>{
  let raw='';let bytes=0;
  for await(const chunk of req){bytes+=Buffer.byteLength(chunk);if(bytes>maxBodyBytes)throw new BridgeFault('BODY_TOO_LARGE','Bridge request exceeds the 1 MB limit.');raw+=chunk;}
  try{const value=JSON.parse(raw);if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();return value as Record<string,unknown>;}
  catch{throw new BridgeFault('INVALID_JSON','Request body must be a JSON object.');}
}
function sendJson(res:ServerResponse,status:number,value:unknown):void{res.statusCode=status;res.end(JSON.stringify(value));}
function constantTimeEqual(input:string,expected:string):boolean{
  const left=Buffer.from(input);const right=Buffer.from(expected);
  return left.length===right.length&&timingSafeEqual(left,right);
}
async function readOrCreateToken(explicit:string|undefined,tokenFile?:string):Promise<string>{
  if(explicit){if(!/^[a-f0-9]{64}$/i.test(explicit))throw new Error('BRIDGE_TOKEN must be a 64-character hexadecimal secret.');return explicit;}
  const path=tokenFile??join(homedir(),'.ai-designer-no-figma','bridge-token');
  await mkdir(dirname(path),{recursive:true,mode:0o700});
  try{
    const existing=(await readFile(path,'utf8')).trim();
    if(!/^[a-f0-9]{64}$/i.test(existing))throw new Error(`Bridge token file must contain 64 hexadecimal characters: ${path}`);
    return existing;
  }catch(error){
    if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;
    const value=randomBytes(32).toString('hex');
    try{await writeFile(path,`${value}\n`,{encoding:'utf8',mode:0o600,flag:'wx'});await chmod(path,0o600);return value;}
    catch(writeError){if((writeError as NodeJS.ErrnoException).code==='EEXIST')return (await readFile(path,'utf8')).trim();throw writeError;}
  }
}
