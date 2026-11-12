export const BRIDGE_PORTS=[8788,8789,8791,8792,8793,8794,8795,8796,8797,8798] as const;
export type Pairing={endpoint:string;token:string;mode:'remote'|'local';instanceId:string};
/** Try allowlisted loopback ports one at a time and stop at the first bridge that accepts the code.
 * Every bridge has its own code, so the bridge that accepts it is exactly the broker the user's AI app talks to. */
export async function discoverBridge(code:string,fetcher:typeof fetch=fetch):Promise<Pairing>{
  const pairingCode=code.trim();
  if(!/^\d{6}$/.test(pairingCode))throw new Error('Enter the 6-digit pairing code. Ask your AI app for "the AI Designer pairing code".');
  let rejected=false;let locked=false;
  for(const port of BRIDGE_PORTS){
    const endpoint=`http://localhost:${port}`;const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),1500);
    try{
      const response=await fetcher(`${endpoint}/bridge/pair`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:pairingCode}),signal:controller.signal});
      if(response.status===401){rejected=true;continue;}
      if(response.status===429){locked=true;continue;}
      if(!response.ok)continue;
      const data=await response.json() as Partial<Pairing>&{ok?:boolean};
      if(data.ok!==true||data.endpoint!==endpoint||typeof data.token!=='string'||!/^[a-f0-9]{64}$/i.test(data.token)||typeof data.instanceId!=='string')continue;
      return{endpoint,token:data.token,mode:data.mode==='remote'?'remote':'local',instanceId:data.instanceId};
    }catch{/* closed port */}finally{clearTimeout(timer);}
  }
  if(locked)throw new Error('Pairing is temporarily locked after wrong codes. Ask your AI app for the pairing code again; that unlocks it and gives a fresh code.');
  if(rejected)throw new Error('The AI Designer bridge is running, but the pairing code is wrong or expired. Ask your AI app for the current code and try again.');
  throw new Error('No AI Designer bridge found on the allowed local ports. Start your AI app with the AI Designer MCP enabled (or run npm run mcp:hub), then reconnect.');
}
/** Reconnect without a code only to the same bridge instance that was paired; a restarted or different bridge needs a new code. */
export async function findBridgeWithToken(token:string,instanceId:string,preferred?:string,fetcher:typeof fetch=fetch):Promise<string|undefined>{
  if(!/^[a-f0-9]{64}$/i.test(token)||!instanceId)return undefined;
  const endpoints=[...new Set([...(preferred?[preferred.replace(/\/$/,'')]:[]),...BRIDGE_PORTS.map(port=>`http://localhost:${port}`)])];
  for(const endpoint of endpoints){
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),1200);
    try{const response=await fetcher(`${endpoint}/bridge/health`,{headers:{Authorization:`Bearer ${token}`},signal:controller.signal});if(response.ok&&(await response.json() as {instanceId?:string}).instanceId===instanceId)return endpoint;}
    catch{/* closed port */}finally{clearTimeout(timer);}
  }
  return undefined;
}
