import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

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
    expect(tools.map((tool)=>tool.name)).toEqual(expect.arrayContaining(['figma_get_connection_status','figma_get_capabilities','figma_import_design_schema','figma_apply_patch','figma_export_selection','figma_get_job_status','figma_cancel_job']));
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
});
