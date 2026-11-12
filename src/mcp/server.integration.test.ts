import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { deflateSync } from 'node:zlib';
import { MAX_MCP_ASSET_BYTES, MAX_RASTER_BYTES, MCP_ASSET_CHUNK_BYTES } from '../shared/assets';

function imageBase64(extraBytes=0):string{
  const chunk=(type:string,data:Buffer)=>{const name=Buffer.from(type);const crcData=Buffer.concat([name,data]);let crc=0xffffffff;for(const byte of crcData){crc^=byte;for(let i=0;i<8;i++)crc=(crc&1)?0xedb88320^(crc>>>1):crc>>>1;}crc=(crc^0xffffffff)>>>0;const size=Buffer.alloc(4);size.writeUInt32BE(data.length);const check=Buffer.alloc(4);check.writeUInt32BE(crc);return Buffer.concat([size,name,data,check]);};
  const header=Buffer.alloc(13);header.writeUInt32BE(1,0);header.writeUInt32BE(1,4);header.set([8,6,0,0,0],8);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),...(extraBytes?[chunk('tEXt',Buffer.alloc(extraBytes,65))]:[]),chunk('IDAT',deflateSync(Buffer.from([0,255,0,0,255]))),chunk('IEND',Buffer.alloc(0))]).toString('base64');
}

let transport:StdioClientTransport;
let client:Client;

beforeAll(async()=>{
  transport=new StdioClientTransport({command:process.execPath,args:['--import','tsx','src/mcp/server.ts'],cwd:process.cwd(),env:{...process.env,BRIDGE_HOST:'127.0.0.1',BRIDGE_PORT:'0',BRIDGE_TOKEN:'b'.repeat(64)},stderr:'ignore'});
  client=new Client({name:'ai-designer-mcp-integration-test',version:'1.0.0'});
  await client.connect(transport);
},20000);
afterAll(async()=>{await client?.close();await transport?.close();});

describe('official MCP stdio server',()=>{
  it('negotiates the MCP protocol and lists only implemented, versioned tools',async()=>{
    const {tools}=await client.listTools();
    expect(tools.map((tool)=>tool.name)).toEqual(expect.arrayContaining(['figma_get_connection_status','figma_get_capabilities','figma_get_local_design_system','figma_validate_design_plan','figma_create_component_family','figma_export_component_family','figma_audit_design_schema','figma_import_design_schema','figma_apply_patch','figma_export_selection','figma_capture_selection','figma_get_job_status','figma_cancel_job','figma_get_asset_capabilities','figma_validate_vector','figma_insert_generated_vector','figma_validate_image','figma_insert_generated_image']));
    expect(tools.some((tool)=>tool.name==='figma_delete_nodes')).toBe(false);
  });
  it('returns honest disconnected state and schema validation errors',async()=>{
    const status=await client.callTool({name:'figma_get_connection_status',arguments:{}});
    expect(status.structuredContent).toMatchObject({connected:false,sessions:[]});
    const invalid=await client.callTool({name:'figma_import_design_schema',arguments:{json:'{}'}});
    expect(invalid.isError).toBe(true);
    expect(invalid.structuredContent).toMatchObject({error:{code:'INVALID_DESIGN_SPEC'}});
  });
  it('audits a valid design without a Figma connection and rejects invalid JSON',async()=>{
    const design={schemaVersion:'1.0',name:'Sample',pages:[{id:'page-1',name:'Page',children:[{type:'frame',id:'frame-1',name:'Hero',width:300,height:100,fill:'#FFFFFF',children:[{type:'text',id:'t1',name:'Headline',x:280,y:10,width:100,height:30,text:'Hello',color:'#DDDDDD',fontSize:16}]}]}]};
    const result=await client.callTool({name:'figma_audit_design_schema',arguments:{json:JSON.stringify(design)}});
    expect(result.structuredContent).toMatchObject({valid:true,visualVerification:'NOT TESTED'});
    expect((result.structuredContent as {summary:{warnings:number}}).summary.warnings).toBeGreaterThanOrEqual(2);
    const invalid=await client.callTool({name:'figma_audit_design_schema',arguments:{json:'{}'}});
    expect(invalid.isError).toBe(true);
    expect(invalid.structuredContent).toMatchObject({valid:false,error:{code:'INVALID_DESIGN_SPEC'}});
  });
  it('validates component family input before needing Figma and reports disconnected for valid input',async()=>{
    const family={familyVersion:'1.0',name:'Button',width:120,height:40,variants:[{name:'Primary',label:'Continue',fill:'#006039',textColor:'#FFFFFF'},{name:'Secondary',label:'Cancel',fill:'#FFFFFF',textColor:'#101010'}]};
    const rejected=await client.callTool({name:'figma_create_component_family',arguments:{json:JSON.stringify({...family,variants:[family.variants[0]]})}});
    expect(rejected.structuredContent).toMatchObject({error:{code:'INVALID_COMPONENT_FAMILY'}});
    const valid=await client.callTool({name:'figma_create_component_family',arguments:{json:JSON.stringify(family)}});
    expect(valid.structuredContent).toMatchObject({error:{code:'FIGMA_DISCONNECTED'}});
  });
  it('validates and materializes a section plan without Figma pairing',async()=>{
    const design={schemaVersion:'1.0',name:'Site',pages:[{id:'p',name:'Home',children:[{type:'frame',id:'hero',name:'Hero',width:400,height:300,children:[]}]}]};
    const plan={planVersion:'1.0',brief:'Studio site',design,sections:[{frameId:'hero',purpose:'Introduction'}]};
    const valid=await client.callTool({name:'figma_validate_design_plan',arguments:{json:JSON.stringify(plan)}});
    expect(valid.structuredContent).toMatchObject({valid:true,sectionCount:1,designSpec:design,componentCandidatesArePlanningOnly:true});
    const invalid=await client.callTool({name:'figma_validate_design_plan',arguments:{json:JSON.stringify({...plan,sections:[{frameId:'missing',purpose:'Wrong'}]})}});
    expect(invalid.structuredContent).toMatchObject({valid:false,error:{code:'INVALID_DESIGN_PLAN'}});
  });
  it('requires an open paired plugin for read-only design-system inventory',async()=>{
    const result=await client.callTool({name:'figma_get_local_design_system',arguments:{}});
    expect(result.structuredContent).toMatchObject({error:{code:'FIGMA_DISCONNECTED'}});
  });
  it('exposes accurate capabilities without claiming unsupported Figma APIs',async()=>{
    const result=await client.callTool({name:'figma_get_capabilities',arguments:{}});
    expect(result.structuredContent).toMatchObject({designSchemaVersion:'1.0',operations:['inspect-selection','render-spec','apply-patch','export-selection','capture-selection'],visualReview:{agentLoop:'AI client inspects returned image and requests a targeted patch; recapture after applying'}});
    expect((result.structuredContent as {supportedDesignNodeTypes:string[]}).supportedDesignNodeTypes).toEqual(expect.arrayContaining(['component','instance','vector']));
    expect((result.structuredContent as {supportedDesignPaints:string[]}).supportedDesignPaints).toEqual(expect.arrayContaining(['linear-gradient','drop-shadow','image-fill']));
    expect((result.structuredContent as {supportedDesignFeatures:string[]}).supportedDesignFeatures).toEqual(expect.arrayContaining(['local-color-variables','local-text-styles','responsive-constraints','layout-grids']));
    expect((result.structuredContent as {exportLimitations:string[]}).exportLimitations).toContain('token binding metadata is not round-tripped');
  });
  it('reports file-transfer limits and validates actual vector/image payloads',async()=>{
    const caps=await client.callTool({name:'figma_get_asset_capabilities',arguments:{}});
    expect(caps.structuredContent).toMatchObject({clientNativeGeneration:'NOT_VERIFIED',clientGeneratedFileAccess:'NOT_VERIFIED',manualLocalFileImport:'SUPPORTED',raster:{formats:['image/png','image/jpeg','image/gif'],mcpTransferLimitBytes:MAX_RASTER_BYTES,mcpDirectLimitBytes:MAX_MCP_ASSET_BYTES,mcpChunkBytes:MCP_ASSET_CHUNK_BYTES}});
    const vector=await client.callTool({name:'figma_validate_vector',arguments:{svg:'<svg width="20" height="20"><circle cx="10" cy="10" r="8" fill="#0D8A60"/></svg>'}});
    expect(vector.structuredContent).toMatchObject({valid:true,width:20,height:20,elements:2});
    const rejected=await client.callTool({name:'figma_validate_vector',arguments:{svg:'<svg width="20" height="20"><script>alert(1)</script></svg>'}});
    expect(rejected.isError).toBe(true);
    const image=await client.callTool({name:'figma_validate_image',arguments:{mimeType:'image/png',base64:imageBase64()}});
    expect(image.structuredContent).toMatchObject({valid:true,mimeType:'image/png',width:1,height:1});
    const largerImage=await client.callTool({name:'figma_validate_image',arguments:{mimeType:'image/png',base64:imageBase64(MAX_MCP_ASSET_BYTES+1)}});
    expect(largerImage.structuredContent).toMatchObject({valid:true,mimeType:'image/png',width:1,height:1});expect((largerImage.structuredContent as {size:number}).size).toBeGreaterThan(MAX_MCP_ASSET_BYTES);
    const largerInsert=await client.callTool({name:'figma_insert_generated_image',arguments:{name:'large.png',mimeType:'image/png',base64:imageBase64(MAX_MCP_ASSET_BYTES+1)}});
    expect(largerInsert.structuredContent).toMatchObject({error:{code:'FIGMA_DISCONNECTED'}});
  });
});
