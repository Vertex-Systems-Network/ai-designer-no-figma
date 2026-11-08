import type { AssetSummary, StoredAsset } from '../shared/asset-library';
export type { AssetPayload, AssetSummary, StoredAsset } from '../shared/asset-library';

type Operation='list'|'read'|'save'|'delete'|'clear';
let endpoint='http://localhost:8788';
let token='';
export function initializeAssetLibraryBridge():void{}
export function configureStoredAssetBridge(nextEndpoint:string,nextToken:string):void{endpoint=nextEndpoint;token=nextToken;}

function bytesToBase64(bytes:Uint8Array):string{
  let binary='';for(let offset=0;offset<bytes.length;offset+=0x8000)binary+=String.fromCharCode(...bytes.subarray(offset,offset+0x8000));
  return btoa(binary);
}
function base64ToBytes(value:string):Uint8Array{
  const binary=atob(value);const bytes=new Uint8Array(binary.length);for(let index=0;index<binary.length;index++)bytes[index]=binary.charCodeAt(index);return bytes;
}
function encodeAsset(asset:Omit<StoredAsset,'sha256'>):Record<string,unknown>{
  return {...asset,payload:asset.payload.kind==='image'?{...asset.payload,content:bytesToBase64(asset.payload.content)}:asset.payload};
}
function decodeAsset(asset:Record<string,unknown>):StoredAsset{
  const payload=asset.payload as Record<string,unknown>|undefined;
  if(payload?.kind==='image'&&typeof payload.content==='string')return{...asset,payload:{...payload,content:base64ToBytes(payload.content)}} as unknown as StoredAsset;
  return asset as unknown as StoredAsset;
}
async function request<T>(operation:Operation,sha?:string,asset?:Omit<StoredAsset,'sha256'>):Promise<T>{
  if(!token)throw new Error('Connect Claude in Settings to save and reuse assets on this device.');
  const url=operation==='list'||operation==='save'||operation==='clear'?`${endpoint}/bridge/assets`: `${endpoint}/bridge/assets/${encodeURIComponent(sha??'')}`;
  const method=operation==='list'?'GET':operation==='save'?'POST':operation==='clear'?'DELETE':operation==='read'?'GET':'DELETE';
  const response=await fetch(url,{method,headers:{Authorization:`Bearer ${token}`,...(asset?{'Content-Type':'application/json'}:{})},...(asset?{body:JSON.stringify({asset:encodeAsset(asset)})}:{})});
  const result=await response.json() as T & {error?:{message?:string}};
  if(!response.ok)throw new Error(result.error?.message??'The local asset library could not be reached. Reconnect Claude and retry.');
  return result;
}
export async function listStoredAssets():Promise<AssetSummary[]>{return(await request<{assets:AssetSummary[]}>('list')).assets??[];}
export async function readStoredAsset(sha:string):Promise<StoredAsset|undefined>{const result=await request<{asset?:Record<string,unknown>}>('read',sha);return result.asset?decodeAsset(result.asset):undefined;}
export async function saveStoredAsset(asset:Omit<StoredAsset,'sha256'>):Promise<{asset:AssetSummary;duplicate:boolean}>{const result=await request<{asset:AssetSummary;duplicate:boolean}>('save',undefined,asset);if(!result.asset)throw new Error('Local asset library returned no saved record.');return result;}
export async function deleteStoredAsset(sha:string):Promise<void>{await request('delete',sha);}
export async function clearStoredAssets():Promise<void>{await request('clear');}
