import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
import { BridgeFault, JobBroker } from '../bridge/broker';
import type { BridgeJob, BridgeOperation } from '../shared/bridge-contract';
import { parseEditPatch } from '../shared/edit-patch';
import { auditDesignQuality, parseDesignSpec } from '../shared/spec';
import { parseDesignPlan } from '../shared/design-plan';
import { composeResponsivePlan } from '../shared/responsive-composition';
import { buildComponentKit } from '../shared/component-kit';
import { migrateDesignSpec } from '../shared/spec-migrations';
import { validateDesignSpec } from '../shared/spec';
import { parseComponentFamily } from '../shared/component-family';
import type { EditPatch } from '../shared/protocol';
import { startBridgeServer } from '../bridge/server';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { visualPreviewToolResult } from './visual-preview';
import { extractImageSources, loadImage, storeImageOperations } from './image-sources';
import { DESIGN_SCHEMA_GUIDE } from './schema-guide';
import { prepareVisualRepair, verifyVisualRepair } from '../shared/visual-repair';
import designSpecSchema from '../../schema/design-spec-1.0.schema.json' with { type: 'json' };
import { MAX_MCP_ASSET_BYTES, MAX_RASTER_BYTES, MAX_SVG_BYTES, MCP_ASSET_CHUNK_BYTES, sanitizeSvg, validateRasterAsset } from '../shared/assets';

function textResult(value: Record<string,unknown>, isError=false) {
  return { content:[{type:'text' as const,text:JSON.stringify(value)}], structuredContent:value, ...(isError?{isError:true as const}:{}) };
}
function faultResult(error:unknown) {
  const fault=error instanceof BridgeFault?error:new BridgeFault('MCP_TOOL_FAILED',error instanceof Error?error.message:'MCP operation failed.');
  return textResult({error:{code:fault.code,message:fault.message}},true);
}
function summary(job:BridgeJob):Record<string,unknown>{return {jobId:job.jobId,operationId:job.operationId,sessionId:job.sessionId,agentLabel:job.agentLabel,status:job.status,createdAt:job.createdAt,updatedAt:job.updatedAt,...(job.error?{error:job.error}:{})};}
/** Friendly agent names for common MCP clients; unknown clients keep their own name. */
export function agentName(client?:string):string|undefined{
  if(!client)return undefined;const id=client.toLowerCase();
  const known:[RegExp,string][]=[[/claude[- ]?code/,'Claude Code'],[/claude/,'Claude'],[/openai|chatgpt/,'ChatGPT'],[/codex/,'Codex'],[/cursor/,'Cursor'],[/gemini/,'Gemini'],[/copilot|vscode|visual studio/,'Copilot'],[/windsurf|codeium/,'Windsurf'],[/cline/,'Cline'],[/lm ?studio/,'LM Studio'],[/zed/,'Zed']];
  for(const [pattern,name] of known)if(pattern.test(id))return name;
  return client.slice(0,80);
}
function queueOptions(args:{sessionId?:string|undefined;agentLabel?:string|undefined;operationId?:string|undefined}){
  return { ...(args.sessionId?{sessionId:args.sessionId}:{}), ...(args.agentLabel?{agentLabel:args.agentLabel}:{}), ...(args.operationId?{operationId:args.operationId}:{}) };
}
function decodeAssetBase64(value:string,maxBytes=MAX_MCP_ASSET_BYTES):Uint8Array{
  if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))throw new BridgeFault('INVALID_BASE64','Asset bytes must use canonical base64 encoding.');
  const bytes=Buffer.from(value,'base64');if(bytes.toString('base64')!==value)throw new BridgeFault('INVALID_BASE64','Asset bytes must use canonical base64 encoding.');
  if(bytes.byteLength>maxBytes)throw new BridgeFault('ASSET_TOO_LARGE',`Asset transfer is limited to ${Math.floor(maxBytes/1024)} KB.`);
  return new Uint8Array(bytes);
}

export function createMcpServer(broker:JobBroker,options:{pairingCode?:()=>Promise<string>;defaultAgent?:string}={}):McpServer{
  const server=new McpServer({name:'ai-designer-no-figma',version:'0.3.0'},{instructions:'AI Designer controls the Figma file the user has open. At the start of a conversation and whenever the user mentions Figma or "my request", call figma_get_design_requests: the user may have typed a design brief in the Figma plugin for you. Carry each request out with the other figma_* tools. For the best design quality build with figma_run_code (Figma Plugin API JavaScript: Auto Layout, components, variables, text styles), one section per call, then review with figma_capture_selection and fix what looks wrong. Use figma_import_design_schema for quick or portable JSON imports. figma_run_code can also delete, duplicate, move and reorganise existing frames and pages, so never tell the user that deleting or copying is impossible. Designs should look finished: wherever a design needs a picture (hero, product, avatar, illustration, background) and you can generate or find one, create it and send it, either as an image node with src (a public https URL or an absolute file path) in figma_import_design_schema, or first with figma_upload_image and then by assetRef. Do not leave grey placeholders when you can supply a real image. If several Figma windows are connected, your jobs go to the window the user used most recently; figma_get_connection_status lists each window\'s fileName and sessionId.'});
  // Name the agent in Figma from the MCP handshake when the caller did not pass agentLabel.
  // Each AI client (one MCP server instance) sticks to one Figma window, so several AIs can work in several windows
  // at the same time. The first job goes to the window the user used most recently; pass sessionId to switch.
  let pinned:string|undefined;
  const pick=(requested?:string)=>{if(requested){pinned=requested;return requested;}if(!pinned||!broker.isConnected(pinned))pinned=broker.preferredSession();return pinned;};
  const withAgent=<T extends {agentLabel?:string|undefined;sessionId?:string|undefined}>(args:T):T=>({...args,agentLabel:args.agentLabel??agentName(server.server.getClientVersion()?.name)??options.defaultAgent,sessionId:pick(args.sessionId)});
  if(options.pairingCode){const read=options.pairingCode;server.registerTool('figma_get_pairing_code',{description:'Return the 6-digit code the user must type into the AI Designer Figma plugin (Settings → Connect) to pair it with this local bridge. Show it to the user; never send it anywhere else.',inputSchema:z.object({})},async()=>textResult({pairingCode:await read(),instructions:'Open the AI Designer plugin in Figma, go to Settings, type this code and press Connect.'}));}
  server.registerTool('figma_get_connection_status',{description:'Return paired Figma plugin sessions currently heartbeat-active on the local bridge.',inputSchema:z.object({})},async()=>textResult({connected:broker.getSessions().length>0,sessions:broker.getSessions(),transport:'loopback-http',pendingDesignRequests:broker.pendingRequestCount()}));
  server.registerTool('figma_get_design_requests',{description:'Return and clear the design briefs the user typed in the Figma plugin (Generate or Edit) for you to carry out. Generate requests: build the described design and import it with figma_import_design_schema. Edit requests: apply the described change to the current selection with figma_apply_patch.',inputSchema:z.object({})},async()=>textResult({requests:broker.takeRequests()}));
  server.registerTool('figma_get_agent_sessions',{description:'List currently connected plugin sessions. Session IDs are required when more than one session is active.',inputSchema:z.object({})},async()=>textResult({sessions:broker.getSessions()}));
  server.registerTool('figma_get_capabilities',{description:'Report the plugin operations actually wired to the local bridge and current schema limitations.',inputSchema:z.object({})},async()=>textResult({protocolVersion:'1.0',designSchemaVersion:'1.0',bridge:{transport:'HTTP polling',bind:'127.0.0.1',tokenRequired:true},operations:['inspect-selection','render-spec','apply-patch','export-selection','capture-selection'],visualReview:{capture:'bounded JPEG preview of one selected frame',agentLoop:'AI client inspects returned image and requests a targeted patch; recapture after applying'},supportedDesignNodeTypes:['frame','group','component','instance','vector','image','text','rectangle','ellipse','line'],supportedDesignPaints:['solid','linear-gradient','radial-gradient','angular-gradient','diamond-gradient','image-fill','up to 8 stacked fills'],supportedDesignEffects:['drop-shadow','inner-shadow','layer-blur','background-blur','up to 4 effects'],supportedDesignFeatures:['local-color-variables','local-text-styles','responsive-constraints','layout-grids','per-corner-radius','rotation','clips-content'],patchOperations:['set-text','set-fill','rename','set-bounds','set-rotation','set-auto-layout','swap-component','replace-image','set-image-crop'],supportedAssetImports:['sanitized-svg','png','jpeg','gif'],exportLimitations:['component instances require an accessible main component','non-normal blend modes, mixed text styling, compound vector paths and unsupported effects fail explicitly instead of being dropped','token mode/theme metadata is not round-tripped'],cancellation:'queued jobs can be cancelled; a running render is cancelled at the next node boundary when the plugin receives cancel',unsupported:['full-document export','remote library-variable import']}));
  server.registerTool('figma_get_asset_capabilities',{description:'Report actual local asset import support separately from AI generation or client file-access claims.',inputSchema:z.object({})},async()=>textResult({vector:{svgMarkup:true,editableImport:true,maxBytes:MAX_SVG_BYTES,allowedElements:['svg','g','path','rect','circle','ellipse','line','polyline','polygon']},raster:{formats:['image/png','image/jpeg','image/gif'],maxBytes:MAX_RASTER_BYTES,maxDimension:4096,mcpTransferLimitBytes:MAX_RASTER_BYTES,mcpDirectLimitBytes:MAX_MCP_ASSET_BYTES,mcpChunkBytes:MCP_ASSET_CHUNK_BYTES},clientNativeGeneration:'NOT_VERIFIED',clientGeneratedFileAccess:'NOT_VERIFIED',manualLocalFileImport:'SUPPORTED',automaticClientAssetTransfer:'NOT_VERIFIED',officialFigmaMcp:false}));
  server.registerTool('figma_validate_vector',{description:'Sanitize and validate geometric SVG markup without inserting it or executing its contents.',inputSchema:z.object({svg:z.string().min(1).max(MAX_SVG_BYTES)})},async({svg})=>{
    try{const asset=sanitizeSvg(svg);return textResult({valid:true,width:asset.width,height:asset.height,elements:asset.elements,bytes:asset.size,sanitizedSvg:asset.svg});}catch(error){return faultResult(error);}
  });
  server.registerTool('figma_insert_generated_vector',{description:'Queue actual SVG markup supplied by the caller for safe editable Figma vector import. This tool does not generate the asset.',inputSchema:z.object({name:z.string().min(1).max(160),svg:z.string().min(1).max(MAX_SVG_BYTES),sessionId:z.string().min(8).max(128).optional(),agentLabel:z.string().max(80).optional(),operationId:z.string().max(128).optional()})},async(args)=>{
    try{const asset=sanitizeSvg(args.svg);return textResult({...summary(broker.enqueue({type:'insert-svg',name:args.name,svg:asset.svg},queueOptions(withAgent(args))),),asset:{kind:'svg',width:asset.width,height:asset.height,elements:asset.elements,bytes:asset.size}});}catch(error){return faultResult(error);}
  });
  const imageInputSchema=z.object({name:z.string().min(1).max(160),mimeType:z.enum(['image/png','image/jpeg','image/gif']),base64:z.string().min(16).max(Math.ceil(MAX_RASTER_BYTES/3)*4),sessionId:z.string().min(8).max(128).optional(),agentLabel:z.string().max(80).optional(),operationId:z.string().max(128).optional()});
  server.registerTool('figma_validate_image',{description:'Validate transferred PNG/JPEG/GIF bytes and report dimensions/checksum without inserting.',inputSchema:imageInputSchema.pick({mimeType:true,base64:true})},async({mimeType,base64})=>{
    try{const bytes=decodeAssetBase64(base64,MAX_RASTER_BYTES);const info=validateRasterAsset(bytes,mimeType);return textResult({valid:true,...info,sha256:createHash('sha256').update(bytes).digest('hex')});}catch(error){return faultResult(error);}
  });
  server.registerTool('figma_insert_generated_image',{description:'Queue actual PNG/JPEG/GIF bytes supplied by the caller for native Figma image-fill import. Images above the direct-transfer threshold are sent as checksum-verified 64 KiB jobs. Requires file bytes to be accessible to this MCP client; does not generate images.',inputSchema:imageInputSchema},async(args)=>{
    try{
      const bytes=decodeAssetBase64(args.base64,MAX_RASTER_BYTES);const info=validateRasterAsset(bytes,args.mimeType);const checksum=createHash('sha256').update(bytes).digest('hex');
      if(bytes.byteLength<=MAX_MCP_ASSET_BYTES){const job=broker.enqueue({type:'insert-image',name:args.name,mimeType:info.mimeType,bytes:Array.from(bytes)},queueOptions(withAgent(args)));return textResult({...summary(job),asset:{kind:'image',...info,sha256:checksum}});}
      const transferId=randomUUID();const chunkCount=Math.ceil(bytes.byteLength/MCP_ASSET_CHUNK_BYTES);
      const operations:BridgeOperation[]=[{type:'begin-image-transfer',transferId,name:args.name,mimeType:info.mimeType,totalBytes:bytes.byteLength,sha256:checksum,chunkCount}];
      for(let index=0;index<chunkCount;index++){const start=index*MCP_ASSET_CHUNK_BYTES;operations.push({type:'image-transfer-chunk',transferId,index,bytes:Array.from(bytes.subarray(start,Math.min(start+MCP_ASSET_CHUNK_BYTES,bytes.byteLength)))});}
      operations.push({type:'finish-image-transfer',transferId});const jobs=broker.enqueueBatch(operations,queueOptions(withAgent(args)));
      return textResult({transferId,status:'queued',chunkCount,jobIds:jobs.map(job=>job.jobId),sessionId:jobs[0]?.sessionId,agentLabel:jobs[0]?.agentLabel,asset:{kind:'image',...info,sha256:checksum}});
    }catch(error){return faultResult(error);}
  });
  server.registerTool('figma_export_component_family',{description:'Export one selected native component set if it fits portable familyVersion 1.0: 2–8 Style variants, one Label text property, single solid fills and equal sizes. Unsupported native data fails explicitly.',inputSchema:z.object({sessionId:z.string().min(8).max(128).optional(),agentLabel:z.string().max(80).optional(),operationId:z.string().max(128).optional()})},async(args)=>{
    try{return textResult(summary(broker.enqueue({type:'export-component-family'},queueOptions(withAgent(args)))));}catch(error){return faultResult(error);}
  });
  server.registerTool('figma_create_component_family',{description:'Create a bounded native component set on a new Figma page with 2–8 Style variants, a TEXT Label property on each variant, and real review instances. Validates the separate familyVersion 1.0 contract, reads native properties back, and removes the new page on failure. Existing document content is untouched. Requires an open paired plugin session.',inputSchema:z.object({json:z.string().min(1).max(16_384),sessionId:z.string().min(8).max(128).optional(),agentLabel:z.string().max(80).optional(),operationId:z.string().max(128).optional()})},async(args)=>{
    const checked=parseComponentFamily(args.json);if(!checked.valid)return textResult({error:{code:'INVALID_COMPONENT_FAMILY',issues:checked.issues}},true);
    try{return textResult(summary(broker.enqueue({type:'render-component-family',family:checked.value},queueOptions(withAgent(args)))));}catch(error){return faultResult(error);}
  });
  server.registerTool('figma_get_local_design_system',{description:'Read-only bounded inventory of components on the current Figma page and local document variables/text/paint/effect styles. Returns exact IDs, names, types and counts without changing selection. Requires an open paired plugin session; no hosted Figma MCP or REST token.',inputSchema:z.object({sessionId:z.string().min(8).max(128).optional(),agentLabel:z.string().max(80).optional(),operationId:z.string().max(128).optional()})},async(args)=>{
    try{return textResult(summary(broker.enqueue({type:'inspect-design-system'},queueOptions(withAgent(args)))));}catch(error){return faultResult(error);}
  });
  server.registerTool('figma_get_selection',{description:'Queue a selection inspection on a paired Figma plugin. Poll figma_get_job_status/result for the real response.',inputSchema:z.object({sessionId:z.string().min(8).max(128).optional(),agentLabel:z.string().max(80).optional(),operationId:z.string().max(128).optional()})},async(args)=>{
    try{return textResult(summary(broker.enqueue({type:'inspect-selection'},queueOptions(withAgent(args)))));}catch(error){return faultResult(error);}
  });
  server.registerTool('figma_validate_design_plan',{description:'Validate a versioned section plan against its embedded editable schema 1.0 design, and optionally against a supplied bounded local inventory. Exact frame, component candidate, token and asset references are checked. Returns the validated native design specification for the existing import tool. Candidate components are planning metadata, not imported instances. No Figma or provider token required.',inputSchema:z.object({json:z.string().min(1).max(640_000),inventory:z.string().max(64_000).optional()})},async({json,inventory})=>{
    let parsedInventory:unknown;try{parsedInventory=inventory?JSON.parse(inventory):undefined;}catch{return textResult({valid:false,error:{code:'INVALID_INVENTORY',message:'Inventory JSON is invalid.'}},true);}
    if(parsedInventory!==undefined&&(!parsedInventory||typeof parsedInventory!=='object'||!Array.isArray((parsedInventory as {components?:unknown}).components)||(parsedInventory as {components:unknown[]}).components.length>80))return textResult({valid:false,error:{code:'INVALID_INVENTORY',message:'Inventory must contain at most 80 component identities.'}},true);
    const result=parseDesignPlan(json,parsedInventory as Parameters<typeof parseDesignPlan>[1]);
    if(!result.valid)return textResult({valid:false,error:{code:'INVALID_DESIGN_PLAN',issues:result.issues}},true);
    return textResult({valid:true,planVersion:'1.0',sectionCount:result.value!.sections.length,designSpec:result.design,componentCandidatesArePlanningOnly:true});
  });
  server.registerTool('figma_compose_responsive_plan',{description:'Materialize two native width variants from a validated one-frame plan using explicit horizontal constraints. Preserves supplied image/vector payloads; rejects unsupported geometry and overflow. Structural checks only; Figma screenshot review remains required.',inputSchema:z.object({json:z.string().min(1).max(640_000),widths:z.tuple([z.number().int().min(240).max(1920),z.number().int().min(240).max(1920)])})},async({json,widths})=>{
    const result=composeResponsivePlan(json,widths);
    if(!result.valid)return textResult({valid:false,error:{code:'RESPONSIVE_COMPOSITION_FAILED',issues:result.issues}},true);
    return textResult({valid:true,widths,assetCount:result.assets,designSpec:result.design,visualVerification:'NOT TESTED'});
  });
  server.registerTool('figma_audit_design_schema',{description:'Validate a schema 1.0 design and return deterministic, advisory design-quality findings before insertion. Checks contrast, semantic naming, Auto Layout, explicit layer overflow and text-bounds collisions. No Figma session or token required; screenshot review remains necessary.',inputSchema:z.object({json:z.string().min(1).max(512_000)})},async({json})=>{
    const checked=parseDesignSpec(json);
    if(!checked.valid||!checked.value)return textResult({valid:false,error:{code:'INVALID_DESIGN_SPEC',message:'Design JSON failed validation.',issues:checked.issues}},true);
    const findings=auditDesignQuality(checked.value);
    return textResult({valid:true,findings,summary:{warnings:findings.filter(item=>item.severity==='warning').length,suggestions:findings.filter(item=>item.severity==='suggestion').length},visualVerification:'NOT TESTED'});
  });
  server.registerTool('figma_build_component_kit',{description:'Build a reusable native component kit (primary/secondary buttons, text input, metric card, top navigation, table row and a usage frame of real instances) bound to named color and text-style tokens. Colors are adjusted to WCAG AA contrast. Set insert:true to queue it into the paired Figma file; otherwise the validated schema 1.0 JSON is returned for review or editing.',inputSchema:z.object({brandColor:z.string().regex(/^#[0-9A-Fa-f]{6}$/),name:z.string().min(1).max(80).optional(),fontFamily:z.string().min(1).max(80).optional(),typeScale:z.tuple([z.number().min(8).max(96),z.number().min(8).max(96),z.number().min(8).max(96),z.number().min(8).max(96),z.number().min(8).max(160)]).optional(),spacing:z.array(z.number().min(1).max(128)).min(4).max(12).optional(),radius:z.number().min(0).max(48).optional(),theme:z.enum(['light','dark']).optional(),insert:z.boolean().optional(),sessionId:z.string().min(8).max(128).optional(),agentLabel:z.string().max(80).optional(),operationId:z.string().max(128).optional()})},async(args)=>{
    try{
      const spec=buildComponentKit({brandColor:args.brandColor,...(args.name?{name:args.name}:{}),...(args.fontFamily?{fontFamily:args.fontFamily}:{}),...(args.typeScale?{typeScale:args.typeScale}:{}),...(args.spacing?{spacing:args.spacing}:{}),...(args.radius!==undefined?{radius:args.radius}:{}),...(args.theme?{theme:args.theme}:{})});
      const checked=parseDesignSpec(JSON.stringify(spec));
      if(!checked.valid||!checked.value)return textResult({error:{code:'INVALID_DESIGN_SPEC',message:'Generated kit failed validation.',issues:checked.issues}},true);
      if(!args.insert)return textResult({json:JSON.stringify(checked.value),findings:auditDesignQuality(checked.value)});
      return textResult({...summary(broker.enqueue({type:'render-spec',spec:checked.value},queueOptions(withAgent(args)))),findings:auditDesignQuality(checked.value)});
    }catch(error){return faultResult(error);}
  });
  server.registerTool('figma_import_design_schema',{description:'Validate and queue a schema 1.0 design JSON for insertion as editable native Figma nodes. Call figma_get_schema first for every supported property, gradient format and a full example. Images: use "src" (absolute file path or http(s) URL) or "assetRef" from figma_upload_image instead of large base64 — the server uploads them for you. By default each import creates a new page; pass targetPageId to draw into an existing page, or replacePage:true to replace the page with the same name. The result lists created pages, node count and warnings (font substitutions, skipped features).',inputSchema:z.object({json:z.string().min(1).max(512_000),targetPageId:z.string().min(1).max(64).optional(),replacePage:z.boolean().optional(),sessionId:z.string().min(8).max(128).optional(),agentLabel:z.string().max(80).optional(),operationId:z.string().max(100).optional()})},async(args)=>{
    let raw:unknown;
    try{raw=JSON.parse(args.json.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));}catch{return textResult({error:{code:'INVALID_JSON',message:'Design JSON is not valid JSON. Check commas, quotes and braces.'}},true);}
    // Normalise first (fills→paints, top-level children, type case…) so image sources are found in every supported spelling.
    let migrated:ReturnType<typeof migrateDesignSpec>|undefined;
    try{migrated=migrateDesignSpec(raw);}catch{/* strict validation below reports the problem */}
    const value=migrated?.value??raw;
    // Batch roots stay short enough for the broker's ":index" suffix.
    const root=args.operationId?.slice(0,100);
    let images:Awaited<ReturnType<typeof extractImageSources>>;
    try{images=await extractImageSources(value,undefined,undefined,root);}catch(error){return textResult({error:{code:'IMAGE_SOURCE_FAILED',message:error instanceof Error?error.message:String(error)}},true);}
    const checked=validateDesignSpec(value);const report=migrated&&migrated.report.applied.length?migrated.report:undefined;
    if(!checked.valid||!checked.value)return textResult({error:{code:'INVALID_DESIGN_SPEC',message:'Design JSON failed validation. Call figma_get_schema for the exact format.',issues:checked.issues},...(report?{migrated:report}:{})},true);
    try{
      const render:BridgeOperation={type:'render-spec',spec:checked.value,...(args.targetPageId?{targetPageId:args.targetPageId}:{}),...(args.replacePage?{replacePage:true}:{})};
      const base=withAgent(args);
      // Each image is its own batch (≤ 82 jobs for 5 MB), queued in order before the render, so several large
      // images never exceed the broker's per-batch limit. The plugin runs a session's jobs in order.
      const uploadJobs:BridgeJob[]=[];
      for(const [index,batch] of images.batches.entries())uploadJobs.push(...broker.enqueueBatch(batch,queueOptions({...base,...(root?{operationId:`${root}:img${index}`}:{})})));
      const renderJob=broker.enqueue(render,queueOptions({...base,...(root?{operationId:root}:{})}));
      return textResult({...summary(renderJob),...(images.uploaded.length?{uploadedImages:images.uploaded,uploadJobIds:uploadJobs.map(job=>job.jobId)}:{}),...(report?{migrated:report}:{})});
    }catch(error){return faultResult(error);}
  });
  server.registerTool('figma_upload_image',{description:'Upload a PNG/JPEG/GIF (up to 5 MB) to the open Figma file WITHOUT placing it, and get an assetRef to use in design specs: {"type":"image","assetRef":"<ref>"} or a paint {"type":"image","assetRef":"<ref>","scaleMode":"FILL"}. Give exactly one of filePath (absolute path or ~ on the computer running this server), url (http/https) or base64. The MIME type is detected automatically. Uploads stay available until the plugin restarts.',inputSchema:z.object({filePath:z.string().min(1).max(1024).optional(),url:z.string().url().max(2048).optional(),base64:z.string().min(16).max(Math.ceil(MAX_RASTER_BYTES/3)*4+64).optional(),name:z.string().max(160).optional(),sessionId:z.string().min(8).max(128).optional(),agentLabel:z.string().max(80).optional(),operationId:z.string().max(100).optional()})},async(args)=>{
    try{
      const image=await loadImage({...(args.filePath!==undefined?{filePath:args.filePath}:{}),...(args.url!==undefined?{url:args.url}:{}),...(args.base64!==undefined?{base64:args.base64}:{})});
      const jobs=broker.enqueueBatch(storeImageOperations(image,args.name??'Image',args.operationId),queueOptions(withAgent(args)));
      return textResult({assetRef:image.sha256,mimeType:image.mimeType,width:image.width,height:image.height,bytes:image.bytes.byteLength,status:'queued',jobIds:jobs.map(job=>job.jobId),usage:{node:{type:'image',assetRef:image.sha256,scaleMode:'FILL'},paint:{type:'image',assetRef:image.sha256,scaleMode:'FILL'}}});
    }catch(error){return faultResult(error);}
  });
  server.registerTool('figma_list_pages',{description:'List the pages of the open Figma file with their ids (use with targetPageId, replacePage or figma_delete_page).',inputSchema:z.object({sessionId:z.string().min(8).max(128).optional(),agentLabel:z.string().max(80).optional(),operationId:z.string().max(128).optional()})},async(args)=>{
    try{return textResult(summary(broker.enqueue({type:'list-pages'},queueOptions(withAgent(args)))));}catch(error){return faultResult(error);}
  });
  server.registerTool('figma_delete_page',{description:'Delete one page from the open Figma file by id (from figma_list_pages or an import result). Use only for pages you created or the user asked you to remove; it cannot delete the last page. Figma keeps it in undo history (Ctrl+Z).',inputSchema:z.object({pageId:z.string().min(1).max(64),sessionId:z.string().min(8).max(128).optional(),agentLabel:z.string().max(80).optional(),operationId:z.string().max(128).optional()})},async(args)=>{
    try{return textResult(summary(broker.enqueue({type:'delete-page',pageId:args.pageId},queueOptions(withAgent(args)))));}catch(error){return faultResult(error);}
  });
  server.registerTool('figma_get_schema',{description:'Return the full design-spec 1.0 JSON Schema, a reference of every supported property (gradients, text alignment, fonts, per-corner radius, groups, images) and a complete example. Read this before writing figma_import_design_schema input.',inputSchema:z.object({})},async()=>textResult({guide:DESIGN_SCHEMA_GUIDE,jsonSchema:designSpecSchema}));
  server.registerTool('figma_apply_patch',{description:'Validate and queue explicit text/fill/name/bounds/Auto Layout/component-swap/image-replacement operations. The plugin checks every target against its current selection before applying. After a patch, capture the frame again and inspect the returned image.',inputSchema:z.object({json:z.string().min(1).max(262_144),sessionId:z.string().min(8).max(128).optional(),agentLabel:z.string().max(80).optional(),operationId:z.string().max(128).optional()})},async(args)=>{
    const checked=parseEditPatch(args.json);
    if(!checked.valid)return textResult({error:{code:'INVALID_EDIT_PATCH',message:checked.message}},true);
    try{return textResult(summary(broker.enqueue({type:'apply-patch',patch:checked.value as EditPatch},queueOptions(withAgent(args)))));}catch(error){return faultResult(error);}
  });
  server.registerTool('figma_export_selection',{description:'Queue export of exactly one selected supported layer tree to a validated design specification.',inputSchema:z.object({sessionId:z.string().min(8).max(128).optional(),agentLabel:z.string().max(80).optional(),operationId:z.string().max(128).optional()})},async(args)=>{
    try{return textResult(summary(broker.enqueue({type:'export-selection'},queueOptions(withAgent(args)))));}catch(error){return faultResult(error);}
  });
  server.registerTool('figma_capture_selection',{description:'Queue a bounded rendered JPEG preview of a Figma frame: nodeId if given, otherwise the selected frame (or the frame containing the selection), otherwise the frame created by the last import. Retrieve the finished job using figma_get_job_result; it returns the actual image so you can inspect visual hierarchy, spacing, clipping and contrast before proposing a targeted patch. Re-capture after applying each patch.',inputSchema:z.object({nodeId:z.string().min(1).max(64).optional(),sessionId:z.string().min(8).max(128).optional(),agentLabel:z.string().max(80).optional(),operationId:z.string().max(128).optional()})},async(args)=>{
    try{return textResult(summary(broker.enqueue({type:'capture-selection',...(args.nodeId?{nodeId:args.nodeId}:{})},queueOptions(withAgent(args)))));}catch(error){return faultResult(error);}
  });
  server.registerTool('figma_run_code',{description:`Run Figma Plugin API JavaScript in the user's open Figma file, like Figma's own MCP. Best tool for building high-quality designs: use Auto Layout (layoutMode, itemSpacing, padding, layoutSizingHorizontal/Vertical = 'FILL'|'HUG'), real components and variants, local variables and text styles. The code is the body of an async function with \`figma\`, \`console\` and \`assets\` in scope; top-level await works; \`return\` a JSON-serialisable value (return node ids you will need later). Rules: await figma.loadFontAsync({family,style}) before setting text characters or fontName; set layoutMode before layoutSizing*; append a child before setting its FILL sizing; colours are 0..1 RGB; use figma.getNodeByIdAsync, figma.setCurrentPageAsync. Images: upload first with figma_upload_image (filePath/url/base64), then in code use {type:'IMAGE',scaleMode:'FILL',imageHash:assets.imageHash('<assetRef>')} as a fill; figma.createImageAsync(url) is unavailable (no network). No network, no DOM. If the script throws, nodes it added to the current page are removed. Also use it for anything other tools do not cover: delete layers (node.remove()), duplicate frames (node.clone(), then append to another page), move layers between pages, rename, reorder, resize to 1920, select and zoom. Build in steps (one section per call), then check with figma_capture_selection.`,inputSchema:z.object({code:z.string().min(1).max(200_000),sessionId:z.string().min(8).max(128).optional(),agentLabel:z.string().max(80).optional(),operationId:z.string().max(128).optional()})},async(args)=>{
    try{return textResult(summary(broker.enqueue({type:'run-code',code:args.code},queueOptions(withAgent(args)))));}catch(error){return faultResult(error);}
  });
  server.registerTool('figma_get_job_status',{description:'Read the state of a queued, running or completed plugin operation.',inputSchema:z.object({jobId:z.string().uuid()})},async({jobId})=>{
    try{return textResult(summary(broker.getJob(jobId)));}catch(error){return faultResult(error);}
  });
  server.registerTool('figma_get_job_result',{description:'Return the actual Figma plugin result or a truthful running/failed state for an operation. A completed capture-selection job returns the preview as an image content block for visual inspection.',inputSchema:z.object({jobId:z.string().uuid()})},async({jobId})=>{
    try{const job=broker.getJob(jobId);if(job.status==='completed'){const preview=visualPreviewToolResult(job.result);if(preview)return{content:[{type:'text' as const,text:JSON.stringify({...summary(job),preview:preview.structuredContent})},preview.content[1]!],structuredContent:{...summary(job),preview:preview.structuredContent}};}return textResult({ ...summary(job), ...(job.status==='completed'?{result:job.result}:{}), ...(job.status==='failed'?{error:job.error}:{}), ...(job.status==='cancelled'?{message:'Job was cancelled before execution.'}:{}) });}catch(error){return faultResult(error);}
  });
  server.registerTool('figma_prepare_visual_repair',{description:'Bind an inspected Figma screenshot and selected layer snapshot to one caller-observed defect and one validated target patch. Returns evidence and patch for explicit figma_apply_patch; does not infer visual quality or mutate.',inputSchema:z.object({captureJobId:z.string().uuid(),inspectionJobId:z.string().uuid(),json:z.string().min(1).max(262_144),targetId:z.string().min(1).max(200),observation:z.string().min(12).max(500)})},async(args)=>{
    try{const result=prepareVisualRepair(broker.getJob(args.captureJobId),broker.getJob(args.inspectionJobId),args.json,args.targetId,args.observation);return textResult(result,!result.valid);}catch(error){return faultResult(error);}
  });
  server.registerTool('figma_verify_visual_repair',{description:'Compare completed before/patch/after jobs from the same session and frame, reporting screenshot hashes and whether pixels changed. A vision-capable reviewer must still judge if the defect was fixed.',inputSchema:z.object({beforeJobId:z.string().uuid(),patchJobId:z.string().uuid(),afterJobId:z.string().uuid()})},async(args)=>{
    try{const result=verifyVisualRepair(broker.getJob(args.beforeJobId),broker.getJob(args.patchJobId),broker.getJob(args.afterJobId));return textResult(result,!result.valid);}catch(error){return faultResult(error);}
  });
  server.registerTool('figma_cancel_job',{description:'Cancel a queued operation immediately, or request a stop for a running one. A running render stops at the next layer and removes its partial page; short operations finish normally.',inputSchema:z.object({jobId:z.string().uuid()})},async({jobId})=>{
    try{return textResult(summary(broker.cancel(jobId)));}catch(error){return faultResult(error);}
  });
  return server;
}

async function main():Promise<void>{
  const bridge=await startBridgeServer({autoPort:true});
  const address=bridge.address();
  const tokenPath=process.env.BRIDGE_TOKEN?'configured by BRIDGE_TOKEN':join(homedir(),'.ai-designer-no-figma','bridge-token');
  console.error(`[ai-designer] loopback plugin bridge listening on http://${address.host}:${address.port}; token file: ${tokenPath}; Figma pairing code: ${bridge.pairing.current()}`);
  const handle=serveStdio(()=>{
    const server=createMcpServer(bridge.broker,{pairingCode:()=>bridge.pairing.reveal()});
    server.server.onclose=()=>{void bridge.close();};
    return server;
  });
  process.stdin.once('end',()=>{void bridge.close();});
  process.once('SIGINT',()=>{void handle.close();void bridge.close();});
  process.once('SIGTERM',()=>{void handle.close();void bridge.close();});
}

// remote.ts bundles this module too; its import.meta.url then equals the hub entry, so skip the stdio main there.
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href&&!/^remote(-mcp)?\.(ts|mjs|js)$/i.test(basename(process.argv[1]))) void main().catch((error)=>{
  const code=error&&typeof error==='object'&&'code'in error?(error as NodeJS.ErrnoException).code:undefined;
  if(code==='EADDRINUSE')console.error('[ai-designer] All AI Designer bridge ports (8788-8798) are in use. Close older AI Designer MCP processes, then restart your AI app.');
  else console.error(error);
  process.exitCode=1;
});
