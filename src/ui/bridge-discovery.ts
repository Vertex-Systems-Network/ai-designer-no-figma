export const BRIDGE_PORTS=[8788,8789,8791,8792,8793,8794,8795,8796,8797,8798] as const;
export type Pairing={endpoint:string;token:string;mode:'remote'|'local'};
/** Discover only manifest-allowlisted loopback services; prefer the remote gateway's broker.
 * The 6-digit code proves the user (not an arbitrary web page) started the pairing. */
export async function discoverBridge(code:string,fetcher:typeof fetch=fetch):Promise<Pairing>{
  const pairingCode=code.trim();
  if(!/^\d{6}$/.test(pairingCode))throw new Error('Enter the 6-digit pairing code. Ask your AI app for "the AI Designer pairing code" or open ~/.ai-designer-no-figma/pairing-code.');
  let rejected=false;
  const responses=await Promise.all(BRIDGE_PORTS.map(async port=>{
    const endpoint=`http://localhost:${port}`;const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),1500);
    try{
      const response=await fetcher(`${endpoint}/bridge/pair`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:pairingCode}),signal:controller.signal});
      if(response.status===401||response.status===429){rejected=true;return undefined;}
      if(!response.ok)return undefined;
      const data=await response.json() as Partial<Pairing>&{ok?:boolean};
      if(data.ok!==true||data.endpoint!==endpoint||typeof data.token!=='string'||!/^[a-f0-9]{64}$/i.test(data.token))return undefined;
      return{endpoint,token:data.token,mode:data.mode==='remote'?'remote' as const:'local' as const};
    }catch{return undefined;}finally{clearTimeout(timer);}
  }));
  const found=responses.find(item=>item?.mode==='remote')??responses.find(item=>item?.mode==='local');
  if(found)return found;
  if(rejected)throw new Error('The AI Designer bridge is running, but the pairing code is wrong or expired. Ask your AI app for the current code and try again.');
  throw new Error('No AI Designer bridge found on the allowed local ports. Start your AI app with the AI Designer MCP enabled (or run npm run mcp:remote), then reconnect.');
}
/** Reconnect with an already issued plugin token (no code needed). Bridges may move between allowed ports after a restart. */
export async function findBridgeWithToken(token:string,preferred?:string,fetcher:typeof fetch=fetch):Promise<string|undefined>{
  if(!/^[a-f0-9]{64}$/i.test(token))return undefined;
  const endpoints=[...new Set([...(preferred?[preferred.replace(/\/$/,'')]:[]),...BRIDGE_PORTS.map(port=>`http://localhost:${port}`)])];
  for(const endpoint of endpoints){
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),1200);
    try{const response=await fetcher(`${endpoint}/bridge/health`,{headers:{Authorization:`Bearer ${token}`},signal:controller.signal});if(response.ok)return endpoint;}
    catch{/* closed port */}finally{clearTimeout(timer);}
  }
  return undefined;
}
