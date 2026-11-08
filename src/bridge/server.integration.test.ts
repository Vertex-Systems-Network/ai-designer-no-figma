import { afterEach, describe, expect, it } from 'vitest';
import { startBridgeServer } from './server';
import { JobBroker } from './broker';

const token='a'.repeat(64);
const services:Array<Awaited<ReturnType<typeof startBridgeServer>>> = [];
async function makeService(){const service=await startBridgeServer({host:'127.0.0.1',port:0,token,broker:new JobBroker()});services.push(service);return service;}
afterEach(async()=>{for(const service of services.splice(0))await service.close();});

describe('authenticated local plugin bridge',()=>{
  it('rejects missing tokens and unapproved origins',async()=>{
    const service=await makeService();const url=`http://127.0.0.1:${service.address().port}`;
    expect((await fetch(`${url}/bridge/health`)).status).toBe(401);
    expect((await fetch(`${url}/bridge/health`,{headers:{Authorization:`Bearer ${token}`,Origin:'https://attacker.invalid'}})).status).toBe(403);
  });

  it('pairs a plugin, delivers one correlated job, and returns its real result',async()=>{
    const service=await makeService();const url=`http://127.0.0.1:${service.address().port}`;
    const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json',Origin:'https://www.figma.com'};
    const connected=await fetch(`${url}/bridge/sessions/connect`,{method:'POST',headers,body:JSON.stringify({sessionId:'figma-session-1',pluginVersion:'0.2.0'})});
    expect(connected.status).toBe(200);
    const job=service.broker.enqueue({type:'inspect-selection'},{agentLabel:'test-client'});
    const next=await fetch(`${url}/bridge/sessions/figma-session-1/jobs/next`,{headers});
    expect(await next.json()).toMatchObject({job:{jobId:job.jobId,status:'running',agentLabel:'test-client'}});
    const completed=await fetch(`${url}/bridge/jobs/${job.jobId}/result`,{method:'POST',headers,body:JSON.stringify({sessionId:'figma-session-1',ok:true,result:{name:'Dashboard',nodeCount:12}})});
    expect(await completed.json()).toMatchObject({job:{status:'completed',result:{name:'Dashboard',nodeCount:12}}});
  });

  it('rejects a result posted by a different plugin session',async()=>{
    const service=await makeService();const url=`http://127.0.0.1:${service.address().port}`;
    const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
    await fetch(`${url}/bridge/sessions/connect`,{method:'POST',headers,body:JSON.stringify({sessionId:'figma-session-1',pluginVersion:'0.2.0'})});
    await fetch(`${url}/bridge/sessions/connect`,{method:'POST',headers,body:JSON.stringify({sessionId:'figma-session-2',pluginVersion:'0.2.0'})});
    const job=service.broker.enqueue({type:'inspect-selection'},{sessionId:'figma-session-1'});service.broker.takeNext('figma-session-1');
    const response=await fetch(`${url}/bridge/jobs/${job.jobId}/result`,{method:'POST',headers,body:JSON.stringify({sessionId:'figma-session-2',ok:true,result:{}})});
    expect(response.status).toBe(409);expect(await response.json()).toMatchObject({error:{code:'SESSION_MISMATCH'}});
  });
});
