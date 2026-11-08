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
    expect(tools.map((tool)=>tool.name)).toEqual(expect.arrayContaining(['figma_get_connection_status','figma_get_capabilities','figma_import_design_schema','figma_apply_patch','figma_export_selection','figma_get_job_status','figma_cancel_job','figma_get_asset_capabilities','figma_validate_vector','figma_insert_generated_vector','figma_validate_image','figma_insert_generated_image']));
    expect(tools.some((tool)=>tool.name==='figma_delete_nodes')).toBe(false);
  });
  it('returns honest disconnected state and schema validation errors',async()=>{
    const status=await client.callTool({name:'figma_get_connection_status',arguments:{}});
    expect(status.structuredContent).toMatchObject({connected:false,sessions:[]});
    const invalid=await client.callTool({name:'figma_import_design_schema',arguments:{json:'{}'}});
    expect(invalid.isError).toBe(true);
    expect(invalid.structuredContent).toMatchObject({error:{code:'INVALID_DESIGN_SPEC'}});
  });
  it('exposes accurate capabilities without claiming unsupported Figma APIs',async()=>{
    const result=await client.callTool({name:'figma_get_capabilities',arguments:{}});
    expect(result.structuredContent).toMatchObject({designSchemaVersion:'1.0',operations:['inspect-selection','render-spec','apply-patch','export-selection']});
    expect((result.structuredContent as {unsupported:string[]}).unsupported).toContain('variables');
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
