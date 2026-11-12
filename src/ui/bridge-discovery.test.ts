import { describe,it,expect } from 'vitest';
import { BRIDGE_PORTS,discoverBridge,findBridgeWithToken } from './bridge-discovery';
const token='d'.repeat(64);
const fake=(available:Record<number,'local'|'remote'>)=>async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=new URL(String(input));const port=Number(url.port);const mode=available[port];
  if(!mode)throw new Error('closed');
  if(JSON.parse(String(init?.body)).code!=='123456')return new Response('{}',{status:401});
  return new Response(JSON.stringify({ok:true,endpoint:`http://localhost:${port}`,token,mode,instanceId:`i-${port}`}),{status:200});
};
describe('Figma plugin local bridge discovery',()=>{
  it('pairs with the first bridge that accepts the code and records its identity',async()=>{
    const found=await discoverBridge('123456',fake({8789:'remote'}) as typeof fetch);
    expect(found).toEqual({endpoint:'http://localhost:8789',token,mode:'remote',instanceId:'i-8789'});
  });
  it('reconnects only to the same bridge instance',async()=>{
    const health=(id:string)=>(async()=>new Response(JSON.stringify({instanceId:id}),{status:200})) as unknown as typeof fetch;
    expect(await findBridgeWithToken(token,'i-1',undefined,health('i-1'))).toBe('http://localhost:8788');
    expect(await findBridgeWithToken(token,'i-1',undefined,health('other'))).toBeUndefined();
  });
  it('uses a single local bridge when remote mode is absent',async()=>{
    expect(await discoverBridge('123456',fake({8791:'local'}) as typeof fetch)).toMatchObject({endpoint:'http://localhost:8791'});
  });
  it('requires an allowlisted responding bridge',async()=>{
    await expect(discoverBridge('123456',fake({9000:'remote'}) as typeof fetch)).rejects.toThrow(/No AI Designer bridge/);
    expect(BRIDGE_PORTS).not.toContain(8790);
  });
  it('reports a wrong pairing code instead of pairing',async()=>{
    await expect(discoverBridge('000000',fake({8788:'local'}) as typeof fetch)).rejects.toThrow(/pairing code is wrong/);
    await expect(discoverBridge('abc',fake({8788:'local'}) as typeof fetch)).rejects.toThrow(/6-digit/);
  });
});
