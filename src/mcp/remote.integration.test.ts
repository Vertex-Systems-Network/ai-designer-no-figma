import { afterEach,describe,it,expect } from 'vitest';
import { Client,StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { JobBroker } from '../bridge/broker';
import { startRemoteMcpServer } from './remote';
import { startBridgeServer } from '../bridge/server';
const token='c'.repeat(64);
let close:(()=>Promise<void>)|undefined;
afterEach(async()=>{await close?.();close=undefined;});
describe('loopback remote MCP gateway',()=>{
  it('refuses unauthenticated and browser-origin requests, then negotiates authenticated MCP tools',async()=>{
    const remote=await startRemoteMcpServer(new JobBroker(),{port:0,token});close=remote.close;
    const url=new URL(`http://127.0.0.1:${remote.address().port}/mcp`);
    const unauthorized=await fetch(url,{method:'POST',body:'{}'});expect(unauthorized.status).toBe(401);
    const origin=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,Origin:'https://evil.example'},body:'{}'});expect(origin.status).toBe(403);
    const client=new Client({name:'remote-test',version:'1.0.0'});
    const transport=new StreamableHTTPClientTransport(url,{authProvider:{token:async()=>token}});
    await client.connect(transport);
    const tools=await client.listTools();expect(tools.tools.map(item=>item.name)).toContain('figma_get_connection_status');
    const status=await client.callTool({name:'figma_get_connection_status',arguments:{}});expect(status.structuredContent).toMatchObject({connected:false,sessions:[]});
    await client.close();
  });
  it('routes a remote MCP request to the locally paired plugin and returns its result',async()=>{
    const broker=new JobBroker();const bridge=await startBridgeServer({port:0,broker,token:'a'.repeat(64),pairingCode:'654321',pluginTokenFile:`/tmp/adnf-remote-test-${process.pid}-plugin-token`});
    const remote=await startRemoteMcpServer(broker,{port:0,token});close=async()=>{await remote.close();await bridge.close();};
    const base=`http://127.0.0.1:${bridge.address().port}`;
    const pairing=await fetch(`${base}/bridge/pair`,{method:'POST',headers:{Origin:'https://www.figma.com'},body:JSON.stringify({code:'654321'})});expect(pairing.status).toBe(200);
    const {token:pluginToken}=await pairing.json() as {token:string};
    const auth={Authorization:`Bearer ${pluginToken}`};
    const connect=await fetch(`${base}/bridge/sessions/connect`,{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({sessionId:'browser-session-1',pluginVersion:'0.1.0'})});expect(connect.status).toBe(200);
    const client=new Client({name:'remote-test',version:'1.0.0'});
    await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${remote.address().port}/mcp`),{authProvider:{token:async()=>token}}));
    const queued=await client.callTool({name:'figma_get_selection',arguments:{}});
    const jobId=(queued.structuredContent as {jobId:string}).jobId;
    const next=await fetch(`${base}/bridge/sessions/browser-session-1/jobs/next`,{headers:auth});
    const polled=await next.json() as {job:{jobId:string;operation:{type:string}}};expect(polled.job).toMatchObject({jobId,operation:{type:'inspect-selection'}});
    const done=await fetch(`${base}/bridge/jobs/${jobId}/result`,{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({sessionId:'browser-session-1',ok:true,result:{summary:{name:'Card',nodes:[]}}})});expect(done.status).toBe(200);
    const result=await client.callTool({name:'figma_get_job_result',arguments:{jobId}});expect(result.structuredContent).toMatchObject({status:'completed',result:{summary:{name:'Card'}}});
    await client.close();
  });
  it('never listens on a public interface',async()=>{
    await expect(startRemoteMcpServer(new JobBroker(),{host:'0.0.0.0',port:0,token})).rejects.toThrow(/loopback/);
  });
});
