import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
import { BridgeFault, JobBroker } from '../bridge/broker';
import type { BridgeJob } from '../shared/bridge-contract';
import { parseEditPatch } from '../shared/edit-patch';
import { parseDesignSpec } from '../shared/spec';
import type { EditPatch } from '../shared/protocol';
import { startBridgeServer } from '../bridge/server';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

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

export function createMcpServer(broker:JobBroker):McpServer{
  const server=new McpServer({name:'ai-designer-no-figma',version:'0.2.0'});
  server.registerTool('figma_get_connection_status',{description:'Return paired Figma plugin sessions currently heartbeat-active on the local bridge.',inputSchema:z.object({})},async()=>textResult({connected:broker.getSessions().length>0,sessions:broker.getSessions(),transport:'loopback-http'}));
  server.registerTool('figma_get_agent_sessions',{description:'List currently connected plugin sessions. Session IDs are required when more than one session is active.',inputSchema:z.object({})},async()=>textResult({sessions:broker.getSessions()}));
  server.registerTool('figma_get_capabilities',{description:'Report the plugin operations actually wired to the local bridge and current schema limitations.',inputSchema:z.object({})},async()=>textResult({protocolVersion:'1.0',designSchemaVersion:'1.0',bridge:{transport:'HTTP polling',bind:'127.0.0.1',tokenRequired:true},operations:['inspect-selection','render-spec','apply-patch','export-selection'],supportedDesignNodeTypes:['frame','group','text','rectangle','ellipse','line'],patchOperations:['set-text','set-fill','rename','set-bounds'],unsupported:['images','SVG paths','gradients','effects','components','variables','full-document export']}));
  server.registerTool('figma_get_selection',{description:'Queue a selection inspection on a paired Figma plugin. Poll figma_get_job_status/result for the real response.',inputSchema:z.object({sessionId:z.string().min(8).max(128).optional(),agentLabel:z.string().max(80).optional(),operationId:z.string().max(128).optional()})},async(args)=>{
    try{return textResult(summary(broker.enqueue({type:'inspect-selection'},queueOptions(args))));}catch(error){return faultResult(error);}
  });
  server.registerTool('figma_import_design_schema',{description:'Validate and queue a schema 1.0 design JSON for insertion as editable native Figma nodes. This creates a new page.',inputSchema:z.object({json:z.string().min(1).max(512_000),sessionId:z.string().min(8).max(128).optional(),agentLabel:z.string().max(80).optional(),operationId:z.string().max(128).optional()})},async(args)=>{
    const checked=parseDesignSpec(args.json);
    if(!checked.valid||!checked.value)return textResult({error:{code:'INVALID_DESIGN_SPEC',message:'Design JSON failed validation.',issues:checked.issues}},true);
    try{return textResult(summary(broker.enqueue({type:'render-spec',spec:checked.value},queueOptions(args))));}catch(error){return faultResult(error);}
  });
  server.registerTool('figma_apply_patch',{description:'Validate and queue explicit text/fill/name/bounds operations. The plugin checks every target against its current selection before applying.',inputSchema:z.object({json:z.string().min(1).max(262_144),sessionId:z.string().min(8).max(128).optional(),agentLabel:z.string().max(80).optional(),operationId:z.string().max(128).optional()})},async(args)=>{
    const checked=parseEditPatch(args.json);
    if(!checked.valid)return textResult({error:{code:'INVALID_EDIT_PATCH',message:checked.message}},true);
    try{return textResult(summary(broker.enqueue({type:'apply-patch',patch:checked.value as EditPatch},queueOptions(args))));}catch(error){return faultResult(error);}
  });
  server.registerTool('figma_export_selection',{description:'Queue export of exactly one selected supported layer tree to a validated design specification.',inputSchema:z.object({sessionId:z.string().min(8).max(128).optional(),agentLabel:z.string().max(80).optional(),operationId:z.string().max(128).optional()})},async(args)=>{
    try{return textResult(summary(broker.enqueue({type:'export-selection'},queueOptions(args))));}catch(error){return faultResult(error);}
  });
  server.registerTool('figma_get_job_status',{description:'Read the state of a queued, running or completed plugin operation.',inputSchema:z.object({jobId:z.string().uuid()})},async({jobId})=>{
    try{return textResult(summary(broker.getJob(jobId)));}catch(error){return faultResult(error);}
  });
  server.registerTool('figma_get_job_result',{description:'Return the actual Figma plugin result or a truthful running/failed state for an operation.',inputSchema:z.object({jobId:z.string().uuid()})},async({jobId})=>{
    try{const job=broker.getJob(jobId);return textResult({ ...summary(job), ...(job.status==='completed'?{result:job.result}:{}), ...(job.status==='failed'?{error:job.error}:{}), ...(job.status==='cancelled'?{message:'Job was cancelled before execution.'}:{}) });}catch(error){return faultResult(error);}
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

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) void main().catch((error)=>{console.error(error);process.exitCode=1;});
