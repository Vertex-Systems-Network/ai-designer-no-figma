import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
import { BridgeFault, JobBroker } from '../bridge/broker';
import type { BridgeJob, BridgeOperation } from '../shared/bridge-contract';
import { parseEditPatch } from '../shared/edit-patch';
import { parseDesignSpec } from '../shared/spec';
import type { EditPatch } from '../shared/protocol';
import { startBridgeServer } from '../bridge/server';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { visualPreviewToolResult } from './visual-preview';
import { MAX_MCP_ASSET_BYTES, MAX_RASTER_BYTES, MAX_SVG_BYTES, MCP_ASSET_CHUNK_BYTES, sanitizeSvg, validateRasterAsset } from '../shared/assets';

function textResult(value: Record<string,unknown>, isError=false) {
  return { content:[{type:'text' as const,text:JSON.stringify(value)}], structuredContent:value, ...(isError?{isError:true as const}:{}) };
}
function faultResult(error:unknown) {
  const fault=error instanceof BridgeFault?error:new BridgeFault('MCP_TOOL_FAILED',error instanceof Error?error.message:'MCP operation failed.');
  return textResult({error:{code:fault.code,message:fault.message}},true);
}
function summary(job:BridgeJob):Record<string,unknown>{return {jobId:job.jobId,operationId:job.operationId,sessionId:job.sessionId,agentLabel:job.agentLabel,status:job.status,createdAt:job.createdAt,updatedAt:job.updatedAt,...(job.error?{error:job.error}:{})};}
function queueOptions(args:{sessionId?:string|undefined;agentLabel?:string|undefined;operationId?:string|undefined}){
  return { ...(args.sessionId?{sessionId:args.sessionId}:{}), ...(args.agentLabel?{agentLabel:args.agentLabel}:{}), ...(args.operationId?{operationId:args.operationId}:{}) };
}
function decodeAssetBase64(value:string,maxBytes=MAX_MCP_ASSET_BYTES):Uint8Array{
  if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))throw new BridgeFault('INVALID_BASE64','Asset bytes must use canonical base64 encoding.');
  const bytes=Buffer.from(value,'base64');if(bytes.toString('base64')!==value)throw new BridgeFault('INVALID_BASE64','Asset bytes must use canonical base64 encoding.');
  if(bytes.byteLength>maxBytes)throw new BridgeFault('ASSET_TOO_LARGE',`Asset transfer is limited to ${Math.floor(maxBytes/1024)} KB.`);
  return new Uint8Array(bytes);
}

export function createMcpServer(broker:JobBroker):McpServer{
  const server=new McpServer({name:'ai-designer-no-figma',version:'0.2.0'});
  server.registerTool('figma_get_connection_status',{description:'Return paired Figma plugin sessions currently heartbeat-active on the local bridge.',inputSchema:z.object({})},async()=>textResult({connected:broker.getSessions().length>0,sessions:broker.getSessions(),transport:'loopback-http'}));
  server.registerTool('figma_get_agent_sessions',{description:'List currently connected plugin sessions. Session IDs are required when more than one session is active.',inputSchema:z.object({})},async()=>textResult({sessions:broker.getSessions()}));
  server.registerTool('figma_get_capabilities',{description:'Report the plugin operations actually wired to the local bridge and current schema limitations.',inputSchema:z.object({})},async()=>textResult({protocolVersion:'1.0',designSchemaVersion:'1.0',bridge:{transport:'HTTP polling',bind:'127.0.0.1',tokenRequired:true},operations:['inspect-selection','render-spec','apply-patch','export-selection','capture-selection'],visualReview:{capture:'bounded JPEG preview of one selected frame',agentLoop:'AI client inspects returned image and requests a targeted patch; recapture after applying'},supportedDesignNodeTypes:['frame','group','component','instance','vector','text','rectangle','ellipse','line'],supportedDesignPaints:['solid','linear-gradient','drop-shadow'],patchOperations:['set-text','set-fill','rename','set-bounds','set-auto-layout'],supportedAssetImports:['sanitized-svg','png','jpeg','gif'],unsupported:['Figma variables','Figma styles','full-document export','round-trip export of components, vectors, gradients and effects']}));
  server.registerTool('figma_get_asset_capabilities',{description:'Report actual local asset import support separately from AI generation or client file-access claims.',inputSchema:z.object({})},async()=>textResult({vector:{svgMarkup:true,editableImport:true,maxBytes:MAX_SVG_BYTES,allowedElements:['svg','g','path','rect','circle','ellipse','line','polyline','polygon']},raster:{formats:['image/png','image/jpeg','image/gif'],maxBytes:MAX_RASTER_BYTES,maxDimension:4096,mcpTransferLimitBytes:MAX_RASTER_BYTES,mcpDirectLimitBytes:MAX_MCP_ASSET_BYTES,mcpChunkBytes:MCP_ASSET_CHUNK_BYTES},clientNativeGeneration:'NOT_VERIFIED',clientGeneratedFileAccess:'NOT_VERIFIED',manualLocalFileImport:'SUPPORTED',automaticClientAssetTransfer:'NOT_VERIFIED',officialFigmaMcp:false}));
  server.registerTool('figma_validate_vector',{description:'Sanitize and validate geometric SVG markup without inserting it or executing its contents.',inputSchema:z.object({svg:z.string().min(1).max(MAX_SVG_BYTES)})},async({svg})=>{
    try{const asset=sanitizeSvg(svg);return textResult({valid:true,width:asset.width,height:asset.height,elements:asset.elements,bytes:asset.size,sanitizedSvg:asset.svg});}catch(error){return faultResult(error);}
  });
  server.registerTool('figma_insert_generated_vector',{description:'Queue actual SVG markup supplied by the caller for safe editable Figma vector import. This tool does not generate the asset.',inputSchema:z.object({name:z.string().min(1).max(160),svg:z.string().min(1).max(MAX_SVG_BYTES),sessionId:z.string().min(8).max(128).optional(),agentLabel:z.string().max(80).optional(),operationId:z.string().max(128).optional()})},async(args)=>{
    try{const asset=sanitizeSvg(args.svg);return textResult({...summary(broker.enqueue({type:'insert-svg',name:args.name,svg:asset.svg},queueOptions(args)),),asset:{kind:'svg',width:asset.width,height:asset.height,elements:asset.elements,bytes:asset.size}});}catch(error){return faultResult(error);}
  });
  const imageInputSchema=z.object({name:z.string().min(1).max(160),mimeType:z.enum(['image/png','image/jpeg','image/gif']),base64:z.string().min(16).max(Math.ceil(MAX_RASTER_BYTES/3)*4),sessionId:z.string().min(8).max(128).optional(),agentLabel:z.string().max(80).optional(),operationId:z.string().max(128).optional()});
  server.registerTool('figma_validate_image',{description:'Validate transferred PNG/JPEG/GIF bytes and report dimensions/checksum without inserting.',inputSchema:imageInputSchema.pick({mimeType:true,base64:true})},async({mimeType,base64})=>{
    try{const bytes=decodeAssetBase64(base64,MAX_RASTER_BYTES);const info=validateRasterAsset(bytes,mimeType);return textResult({valid:true,...info,sha256:createHash('sha256').update(bytes).digest('hex')});}catch(error){return faultResult(error);}
  });
  server.registerTool('figma_insert_generated_image',{description:'Queue actual PNG/JPEG/GIF bytes supplied by the caller for native Figma image-fill import. Images above the direct-transfer threshold are sent as checksum-verified 64 KiB jobs. Requires file bytes to be accessible to this MCP client; does not generate images.',inputSchema:imageInputSchema},async(args)=>{
    try{
      const bytes=decodeAssetBase64(args.base64,MAX_RASTER_BYTES);const info=validateRasterAsset(bytes,args.mimeType);const checksum=createHash('sha256').update(bytes).digest('hex');
      if(bytes.byteLength<=MAX_MCP_ASSET_BYTES){const job=broker.enqueue({type:'insert-image',name:args.name,mimeType:info.mimeType,bytes:Array.from(bytes)},queueOptions(args));return textResult({...summary(job),asset:{kind:'image',...info,sha256:checksum}});}
      const transferId=randomUUID();const chunkCount=Math.ceil(bytes.byteLength/MCP_ASSET_CHUNK_BYTES);
      const operations:BridgeOperation[]=[{type:'begin-image-transfer',transferId,name:args.name,mimeType:info.mimeType,totalBytes:bytes.byteLength,sha256:checksum,chunkCount}];
      for(let index=0;index<chunkCount;index++){const start=index*MCP_ASSET_CHUNK_BYTES;operations.push({type:'image-transfer-chunk',transferId,index,bytes:Array.from(bytes.subarray(start,Math.min(start+MCP_ASSET_CHUNK_BYTES,bytes.byteLength)))});}
      operations.push({type:'finish-image-transfer',transferId});const jobs=broker.enqueueBatch(operations,queueOptions(args));
      return textResult({transferId,status:'queued',chunkCount,jobIds:jobs.map(job=>job.jobId),sessionId:jobs[0]?.sessionId,agentLabel:jobs[0]?.agentLabel,asset:{kind:'image',...info,sha256:checksum}});
    }catch(error){return faultResult(error);}
  });
  server.registerTool('figma_get_selection',{description:'Queue a selection inspection on a paired Figma plugin. Poll figma_get_job_status/result for the real response.',inputSchema:z.object({sessionId:z.string().min(8).max(128).optional(),agentLabel:z.string().max(80).optional(),operationId:z.string().max(128).optional()})},async(args)=>{
    try{return textResult(summary(broker.enqueue({type:'inspect-selection'},queueOptions(args))));}catch(error){return faultResult(error);}
  });
  server.registerTool('figma_import_design_schema',{description:'Validate and queue a schema 1.0 design JSON for insertion as editable native Figma nodes. Creates a new page and selects its first root frame so you can immediately capture and visually inspect it.',inputSchema:z.object({json:z.string().min(1).max(512_000),sessionId:z.string().min(8).max(128).optional(),agentLabel:z.string().max(80).optional(),operationId:z.string().max(128).optional()})},async(args)=>{
    const checked=parseDesignSpec(args.json);
    if(!checked.valid||!checked.value)return textResult({error:{code:'INVALID_DESIGN_SPEC',message:'Design JSON failed validation.',issues:checked.issues}},true);
    try{return textResult(summary(broker.enqueue({type:'render-spec',spec:checked.value},queueOptions(args))));}catch(error){return faultResult(error);}
  });
  server.registerTool('figma_apply_patch',{description:'Validate and queue explicit text/fill/name/bounds/Auto Layout operations. The plugin checks every target against its current selection before applying. After a patch, capture the frame again and inspect the returned image.',inputSchema:z.object({json:z.string().min(1).max(262_144),sessionId:z.string().min(8).max(128).optional(),agentLabel:z.string().max(80).optional(),operationId:z.string().max(128).optional()})},async(args)=>{
    const checked=parseEditPatch(args.json);
    if(!checked.valid)return textResult({error:{code:'INVALID_EDIT_PATCH',message:checked.message}},true);
    try{return textResult(summary(broker.enqueue({type:'apply-patch',patch:checked.value as EditPatch},queueOptions(args))));}catch(error){return faultResult(error);}
  });
  server.registerTool('figma_export_selection',{description:'Queue export of exactly one selected supported layer tree to a validated design specification.',inputSchema:z.object({sessionId:z.string().min(8).max(128).optional(),agentLabel:z.string().max(80).optional(),operationId:z.string().max(128).optional()})},async(args)=>{
    try{return textResult(summary(broker.enqueue({type:'export-selection'},queueOptions(args))));}catch(error){return faultResult(error);}
  });
  server.registerTool('figma_capture_selection',{description:'Queue a bounded rendered JPEG preview of the selected Figma frame. Retrieve the finished job using figma_get_job_result; it returns the actual image so you can inspect visual hierarchy, spacing, clipping and contrast before proposing a targeted patch. Re-capture after applying each patch.',inputSchema:z.object({sessionId:z.string().min(8).max(128).optional(),agentLabel:z.string().max(80).optional(),operationId:z.string().max(128).optional()})},async(args)=>{
    try{return textResult(summary(broker.enqueue({type:'capture-selection'},queueOptions(args))));}catch(error){return faultResult(error);}
  });
  server.registerTool('figma_get_job_status',{description:'Read the state of a queued, running or completed plugin operation.',inputSchema:z.object({jobId:z.string().uuid()})},async({jobId})=>{
    try{return textResult(summary(broker.getJob(jobId)));}catch(error){return faultResult(error);}
  });
  server.registerTool('figma_get_job_result',{description:'Return the actual Figma plugin result or a truthful running/failed state for an operation. A completed capture-selection job returns the preview as an image content block for visual inspection.',inputSchema:z.object({jobId:z.string().uuid()})},async({jobId})=>{
    try{const job=broker.getJob(jobId);if(job.status==='completed'){const preview=visualPreviewToolResult(job.result);if(preview)return{content:[{type:'text' as const,text:JSON.stringify({...summary(job),preview:preview.structuredContent})},preview.content[1]!],structuredContent:{...summary(job),preview:preview.structuredContent}};}return textResult({ ...summary(job), ...(job.status==='completed'?{result:job.result}:{}), ...(job.status==='failed'?{error:job.error}:{}), ...(job.status==='cancelled'?{message:'Job was cancelled before execution.'}:{}) });}catch(error){return faultResult(error);}
  });
  server.registerTool('figma_cancel_job',{description:'Cancel an operation only while it is still queued. Running Figma Plugin API operations are not interruptible yet.',inputSchema:z.object({jobId:z.string().uuid()})},async({jobId})=>{
    try{return textResult(summary(broker.cancel(jobId)));}catch(error){return faultResult(error);}
  });
  return server;
}

async function main():Promise<void>{
  const bridge=await startBridgeServer();
  const address=bridge.address();
  const tokenPath=process.env.BRIDGE_TOKEN?'configured by BRIDGE_TOKEN':join(homedir(),'.ai-designer-no-figma','bridge-token');
  console.error(`[ai-designer] loopback plugin bridge listening on http://${address.host}:${address.port}; pairing token: ${tokenPath}`);
  const handle=serveStdio(()=>{
    const server=createMcpServer(bridge.broker);
    server.server.onclose=()=>{void bridge.close();};
    return server;
  });
  process.stdin.once('end',()=>{void bridge.close();});
  process.once('SIGINT',()=>{void handle.close();void bridge.close();});
  process.once('SIGTERM',()=>{void handle.close();void bridge.close();});
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) void main().catch((error)=>{
  const code=error&&typeof error==='object'&&'code'in error?(error as NodeJS.ErrnoException).code:undefined;
  if(code==='EADDRINUSE')console.error('[ai-designer] Bridge port 8788 is already in use. Close any older AI Designer MCP process, then restart Claude Desktop.');
  else console.error(error);
  process.exitCode=1;
});
