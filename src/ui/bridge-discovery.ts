export const BRIDGE_PORTS=[8788,8789,8791,8792,8793,8794,8795,8796,8797,8798] as const;
export type Pairing={endpoint:string;token:string;mode:'remote'|'local'};
/** Discover only manifest-allowlisted loopback services; prefer the remote gateway's broker. */
export async function discoverBridge(fetcher:typeof fetch=fetch):Promise<Pairing>{
  const responses=await Promise.all(BRIDGE_PORTS.map(async port=>{
    const endpoint=`http://localhost:${port}`;const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),1500);
    try{
      const response=await fetcher(`${endpoint}/bridge/pair`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:controller.signal});
      if(!response.ok)return undefined;
      const data=await response.json() as Partial<Pairing>&{ok?:boolean};
      if(data.ok!==true||data.endpoint!==endpoint||typeof data.token!=='string'||!/^[a-f0-9]{64}$/i.test(data.token))return undefined;
      return{endpoint,token:data.token,mode:data.mode==='remote'?'remote' as const:'local' as const};
    }catch{return undefined;}finally{clearTimeout(timer);}
  }));
  const found=responses.find(item=>item?.mode==='remote')??responses.find(item=>item?.mode==='local');
  if(!found)throw new Error('No AI Designer bridge found on the allowed local ports. Start npm run mcp:remote, then reconnect.');
  return found;
}
