import type { AssetSummary, StoredAsset } from '../shared/asset-library';
import type { HostToUi, UiToHost } from '../shared/protocol';
export type { AssetPayload, AssetSummary, StoredAsset } from '../shared/asset-library';

type Operation='list'|'read'|'save'|'delete'|'clear';
type Reply=Extract<HostToUi,{type:'asset-library-response'}>;
let requestSequence=0;
const pending=new Map<string,{resolve:(reply:Reply)=>void;reject:(error:Error)=>void}>();
let initialized=false;
export function initializeAssetLibraryBridge():void{
  if(initialized)return;initialized=true;
  window.addEventListener('message',(event:MessageEvent)=>{
    const reply=event.data?.pluginMessage as Reply|undefined;if(reply?.type!=='asset-library-response')return;
    const request=pending.get(reply.requestId);if(!request)return;pending.delete(reply.requestId);
    if(reply.ok)request.resolve(reply);else request.reject(new Error(reply.message||'Figma local asset storage failed.'));
  });
}
function request(operation:Operation,details:Pick<Extract<UiToHost,{type:'asset-library-request'}>,'sha'|'asset'>={}):Promise<Reply>{
  if(!initialized)initializeAssetLibraryBridge();
  const requestId=`asset-${Date.now().toString(36)}-${(++requestSequence).toString(36)}`;
  return new Promise((resolve,reject)=>{
    pending.set(requestId,{resolve,reject});
    parent.postMessage({pluginMessage:{type:'asset-library-request',requestId,operation,...details} satisfies UiToHost},'*');
    setTimeout(()=>{const waiting=pending.get(requestId);if(waiting){pending.delete(requestId);waiting.reject(new Error('Figma host did not answer the local asset storage request. Reopen the plugin and try again.'));}},8000);
  });
}
export async function listStoredAssets():Promise<AssetSummary[]>{return(await request('list')).assets??[];}
export async function readStoredAsset(sha:string):Promise<StoredAsset|undefined>{return(await request('read',{sha})).asset as StoredAsset|undefined;}
export async function saveStoredAsset(asset:Omit<StoredAsset,'sha256'>):Promise<{asset:AssetSummary;duplicate:boolean}>{const reply=await request('save',{asset});if(!reply.asset)throw new Error('Figma host returned no saved asset record.');return{asset:reply.asset as AssetSummary,duplicate:reply.duplicate===true};}
export async function deleteStoredAsset(sha:string):Promise<void>{await request('delete',{sha});}
export async function clearStoredAssets():Promise<void>{await request('clear');}
