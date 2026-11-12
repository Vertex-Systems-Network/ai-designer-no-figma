import { timingSafeEqual, randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { isIP } from 'node:net';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { BridgeFault, JobBroker } from './broker';
import { createAssetLibrary, type StoredAsset } from '../shared/asset-library';
import { sanitizeSvg, validateRasterAsset } from '../shared/assets';

const allowedOrigins = new Set(['https://www.figma.com','https://figma.com','null','http://127.0.0.1:5173','http://localhost:5173']);
const maxBodyBytes = 4*1_048_576;
export const BRIDGE_DISCOVERY_PORTS=[8788,8789,8791,8792,8793,8794,8795,8796,8797,8798] as const;
type ServerOptions = { host?: string; port?: number; autoPort?:boolean; pairingMode?:'local'|'remote'; token?: string; tokenFile?: string; pluginTokenFile?:string; assetLibraryFile?:string; pairingCodeFile?:string; pairingCode?:string; broker?: JobBroker };
/** Short code the user types into the plugin. It proves the pairing request came from someone who can read local files or the AI client, not from an arbitrary web page that can also send `Origin: null`. */
export class PairingGate{
  private failures=0;
  private lockedUntil=0;
  constructor(private code:string,private readonly file?:string){}
  static async create(file:string|undefined,fixed?:string):Promise<PairingGate>{const gate=new PairingGate(fixed??PairingGate.generate(),file);if(!fixed)await gate.persist();return gate;}
  static generate():string{return String(randomBytes(4).readUInt32BE(0)%1_000_000).padStart(6,'0');}
  current():string{return this.code;}
  async verify(input:unknown):Promise<boolean>{
    if(Date.now()<this.lockedUntil)throw new BridgeFault('PAIRING_LOCKED','Too many wrong pairing codes. Wait one minute, then use the new code.');
    if(typeof input==='string'&&/^\d{6}$/.test(input.trim())&&constantTimeEqual(input.trim(),this.code)){this.failures=0;return true;}
    this.failures++;
    // Rotate after repeated guesses so a hostile page cannot brute-force the 10^6 space.
    if(this.failures>=5){this.failures=0;this.lockedUntil=Date.now()+60_000;this.code=PairingGate.generate();await this.persist();}
    return false;
  }
  private async persist():Promise<void>{if(!this.file)return;await mkdir(dirname(this.file),{recursive:true,mode:0o700});await writeFile(this.file,`${this.code}\n`,{encoding:'utf8',mode:0o600});await chmod(this.file,0o600);}
}
export const defaultPairingCodeFile=()=>join(homedir(),'.ai-designer-no-figma','pairing-code');

export async function startBridgeServer(options: ServerOptions = {}): Promise<{server:Server;broker:JobBroker;token:string;pairing:PairingGate;close:()=>Promise<void>;address:()=>{host:string;port:number}}>{
  if(options.autoPort){let last:unknown;for(const candidate of BRIDGE_DISCOVERY_PORTS){try{return await startBridgeServer({...options,autoPort:false,port:candidate});}catch(error){if((error as NodeJS.ErrnoException).code!=='EADDRINUSE')throw error;last=error;}}throw new Error('All allowed Figma pairing ports are occupied.',{cause:last});}
  const host=options.host??process.env.BRIDGE_HOST??'127.0.0.1';
  const port=options.port??Number(process.env.BRIDGE_PORT??8788);
  if (!isIP(host)||!['127.0.0.1','::1'].includes(host)) throw new Error('BRIDGE_HOST must be a loopback IP address.');
  if (!Number.isInteger(port)||port<0||port>65535) throw new Error('BRIDGE_PORT must be between 0 and 65535.');
  const token=await readOrCreateToken(options.token??process.env.BRIDGE_TOKEN,options.tokenFile);
  // Keep the plugin credential stable across Claude Desktop restarts. A fresh
  // in-memory token made an already paired Figma panel appear invalid after
  // the MCP process restarted.
  const pluginToken=await readOrCreateToken(undefined,options.pluginTokenFile??join(homedir(),'.ai-designer-no-figma','plugin-token'));
  const assetLibrary=createAssetLibrary(createFileStorage(options.assetLibraryFile??join(homedir(),'.ai-designer-no-figma','asset-library.json')));
  const broker=options.broker??new JobBroker();
  const pairing=await PairingGate.create(options.pairingCodeFile??(options.pairingCode?undefined:defaultPairingCodeFile()),options.pairingCode??process.env.BRIDGE_PAIRING_CODE);
  const server=createServer(async(req,res)=>{
    try { await handle(req,res,broker,token,pluginToken,assetLibrary,server.address(),options.pairingMode??'local',pairing); }
    catch(error){
      const fault=error instanceof BridgeFault?error:new BridgeFault('BRIDGE_INTERNAL_ERROR',error instanceof Error?error.message:'Bridge request failed.');
      sendJson(res,fault.code==='INVALID_JSON'?400:fault.code==='BODY_TOO_LARGE'?413:fault.code==='UNAUTHORIZED'||fault.code==='PAIRING_CODE_INVALID'?401:fault.code==='ORIGIN_DENIED'?403:fault.code==='PAIRING_LOCKED'?429:fault.code==='NOT_FOUND'?404:409,{error:{code:fault.code,message:fault.message}});
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
  return {server,broker,token,pairing,close,address:()=>({host:actual.address,port:actual.port})};
}

async function handle(req:IncomingMessage,res:ServerResponse,broker:JobBroker,token:string,pluginToken:string,assetLibrary:ReturnType<typeof createAssetLibrary>,address:ReturnType<Server['address']>,pairingMode:'local'|'remote',pairing:PairingGate):Promise<void>{
  const origin=req.headers.origin;
  if (origin&&!allowedOrigins.has(origin)) throw new BridgeFault('ORIGIN_DENIED','Request origin is not allowed.');
  if (origin) res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Methods','GET, POST, DELETE, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');
  if (req.method==='OPTIONS'){res.statusCode=204;res.end();return;}
  if(req.method==='POST'&&req.url==='/bridge/pair'){
    if(!origin||!allowedOrigins.has(origin))throw new BridgeFault('ORIGIN_DENIED','Pairing is only available from the Figma plugin UI.');
    const body=await readBody(req);
    if(!await pairing.verify(body.code))throw new BridgeFault('PAIRING_CODE_INVALID','Pairing code is missing or wrong. Ask your AI client for the AI Designer pairing code (tool figma_get_pairing_code) or read ~/.ai-designer-no-figma/pairing-code.');
    const port=address&&typeof address!=='string'?address.port:8788;
    sendJson(res,200,{ok:true,endpoint:`http://localhost:${port}`,token:pluginToken,mode:pairingMode});return;
  }
  const url=new URL(req.url??'/','http://127.0.0.1');
  const authorization=req.headers.authorization??'';
  const supplied=authorization.startsWith('Bearer ')?authorization.slice(7):'';
  const isPluginCredential=constantTimeEqual(supplied,pluginToken);
  if(!isPluginCredential&&!constantTimeEqual(supplied,token))throw new BridgeFault('UNAUTHORIZED','Bridge pairing is no longer valid. Connect Claude again in Figma Settings.');
  if(isPluginCredential&&!['/bridge/health','/bridge/sessions/connect','/bridge/sessions/heartbeat','/bridge/assets'].includes(url.pathname)&&!/^\/bridge\/assets\/[a-f0-9]{64}$/i.test(url.pathname)&&!/^\/bridge\/sessions\/[a-zA-Z0-9:_-]+\/jobs\/next$/.test(url.pathname)&&!/^\/bridge\/jobs\/[0-9a-f-]{36}\/result$/i.test(url.pathname))throw new BridgeFault('FORBIDDEN','This pairing only allows the Figma plugin transport and local asset library.');
  if(req.method==='GET'&&url.pathname==='/bridge/assets'){sendJson(res,200,{assets:await assetLibrary.list()});return;}
  if(req.method==='POST'&&url.pathname==='/bridge/assets'){
    const data=await readBody(req);const asset=validateAssetInput(data.asset);
    const saved=await assetLibrary.save(asset);sendJson(res,200,{asset:saved.asset,duplicate:saved.duplicate});return;
  }
  if(req.method==='DELETE'&&url.pathname==='/bridge/assets'){await assetLibrary.clear();sendJson(res,200,{ok:true});return;}
  const assetMatch=url.pathname.match(/^\/bridge\/assets\/([a-f0-9]{64})$/i);
  if(assetMatch&&req.method==='GET'){const asset=await assetLibrary.read(assetMatch[1]!);sendJson(res,200,{...(asset?{asset:encodeStoredAsset(asset)}:{})});return;}
  if(assetMatch&&req.method==='DELETE'){await assetLibrary.delete(assetMatch[1]!);sendJson(res,200,{ok:true});return;}
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
    sendJson(res,200,{session:broker.heartbeat(data.sessionId),cancel:broker.cancellationsFor(data.sessionId)});return;
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
  for await(const chunk of req){bytes+=Buffer.byteLength(chunk);if(bytes>maxBodyBytes)throw new BridgeFault('BODY_TOO_LARGE','Bridge request exceeds the 4 MB limit.');raw+=chunk;}
  try{const value=JSON.parse(raw);if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();return value as Record<string,unknown>;}
  catch{throw new BridgeFault('INVALID_JSON','Request body must be a JSON object.');}
}
function validateAssetInput(value:unknown):Omit<StoredAsset,'sha256'>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new BridgeFault('INVALID_ASSET','Asset record is required.');
  const input=value as Record<string,unknown>;const payload=input.payload as Record<string,unknown>|undefined;
  if(typeof input.name!=='string'||input.name.length<1||input.name.length>240||typeof input.createdAt!=='string'||typeof input.nodeId!=='string'||input.nodeId.length>200||!Number.isSafeInteger(input.width)||!Number.isSafeInteger(input.height)||!Number.isSafeInteger(input.bytes))throw new BridgeFault('INVALID_ASSET','Asset metadata is invalid.');
  if(!payload||typeof payload!=='object')throw new BridgeFault('INVALID_ASSET','Asset source is missing.');
  if(payload.kind==='svg'&&typeof payload.content==='string'){
    const sanitized=sanitizeSvg(payload.content);
    return{name:input.name,kind:'svg',createdAt:input.createdAt,nodeId:input.nodeId,width:sanitized.width,height:sanitized.height,bytes:sanitized.size,payload:{kind:'svg',content:sanitized.svg}};
  }
  if(payload.kind==='image'&&typeof payload.mimeType==='string'&&typeof payload.content==='string'){
    const bytes=decodeBase64(payload.content);const details=validateRasterAsset(bytes,payload.mimeType);
    if(input.bytes!==bytes.byteLength||input.width!==details.width||input.height!==details.height)throw new BridgeFault('INVALID_ASSET','Image metadata does not match its source bytes.');
    return{name:input.name,kind:'image',mimeType:details.mimeType,createdAt:input.createdAt,nodeId:input.nodeId,width:details.width,height:details.height,bytes:bytes.byteLength,payload:{kind:'image',mimeType:details.mimeType,content:bytes}};
  }
  throw new BridgeFault('INVALID_ASSET','Asset source must be safe SVG markup or a supported raster image.');
}
function decodeBase64(value:string):Uint8Array{
  if(value.length>Math.ceil(2*1024*1024/3)*4||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))throw new BridgeFault('INVALID_ASSET','Asset source exceeds the local library size limit or has invalid encoding.');
  const bytes=Buffer.from(value,'base64');if(bytes.toString('base64')!==value)throw new BridgeFault('INVALID_ASSET','Asset source has invalid base64 encoding.');return new Uint8Array(bytes);
}
function encodeStoredAsset(asset:StoredAsset):Record<string,unknown>{return{...asset,payload:asset.payload.kind==='image'?{...asset.payload,content:Buffer.from(asset.payload.content).toString('base64')}:asset.payload};}
function createFileStorage(path:string){
  return{
    async getAsync(key:string):Promise<unknown>{
      try{const text=await readFile(path,'utf8');const values=JSON.parse(text,(_name,item:unknown)=>{const encoded=item&&typeof item==='object'&&!Array.isArray(item)?(item as Record<string,unknown>).__adnfBytes:undefined;return typeof encoded==='string'?new Uint8Array(Buffer.from(encoded,'base64')):item;}) as Record<string,unknown>;return values[key];}
      catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return undefined;throw new Error('The local asset library file could not be read.');}
    },
    async setAsync(key:string,value:unknown):Promise<void>{
      await mkdir(dirname(path),{recursive:true,mode:0o700});
      const current=await this.getAsync(key);const values:Record<string,unknown>=current===undefined?{}:{[key]:current};values[key]=value;
      const temp=`${path}.tmp-${randomBytes(6).toString('hex')}`;
      try{await writeFile(temp,JSON.stringify(values,(_name,item:unknown)=>item instanceof Uint8Array?{__adnfBytes:Buffer.from(item).toString('base64')}:item),{encoding:'utf8',mode:0o600,flag:'wx'});await rename(temp,path);await chmod(path,0o600);}
      catch(error){await rm(temp,{force:true});throw error;}
    },
    async deleteAsync(key:string):Promise<void>{if(key==='asset-library-v1')await rm(path,{force:true});},
  };
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
