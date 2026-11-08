import { sha256 } from '../shared/sha256';
import { utf8Bytes } from '../shared/utf8';

export const MAX_LIBRARY_ASSETS=50;
// localStorage is UTF-16 and typically capped near 5 MiB per origin. Keep a
// conservative decoded-byte budget so base64 and existing plugin settings fit.
export const MAX_LIBRARY_BYTES=2*1024*1024;
const STORAGE_KEY='adnf-asset-library-v1';

export type AssetPayload={kind:'svg';content:string}|{kind:'image';mimeType:'image/png'|'image/jpeg'|'image/gif';content:Uint8Array};
export type StoredAsset={sha256:string;name:string;kind:'svg'|'image';mimeType?:string;width:number;height:number;bytes:number;createdAt:string;nodeId:string;payload:AssetPayload};
export type AssetSummary=Omit<StoredAsset,'payload'>;
type PersistedPayload={kind:'svg';content:string}|{kind:'image';mimeType:'image/png'|'image/jpeg'|'image/gif';base64:string};
type PersistedAsset=Omit<StoredAsset,'payload'> & {payload:PersistedPayload};

function encodeBase64(bytes:Uint8Array):string{
  let binary='';const blockSize=0x8000;
  for(let offset=0;offset<bytes.length;offset+=blockSize)binary+=String.fromCharCode(...bytes.subarray(offset,Math.min(offset+blockSize,bytes.length)));
  return btoa(binary);
}
function decodeBase64(value:string):Uint8Array{
  if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))throw new Error('Saved asset data is malformed. Remove the damaged library entry and import the file again.');
  const binary=atob(value);const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes;
}
function payloadBytes(payload:AssetPayload):Uint8Array{
  const content=payload.kind==='svg'?utf8Bytes(payload.content):payload.content;
  const prefix=utf8Bytes(`${payload.kind}:${payload.kind==='image'?payload.mimeType:'image/svg+xml'}\0`);const value=new Uint8Array(prefix.length+content.length);value.set(prefix);value.set(content,prefix.length);return value;
}
function summaryOf(asset:StoredAsset):AssetSummary{return{sha256:asset.sha256,name:asset.name,kind:asset.kind,...(asset.mimeType?{mimeType:asset.mimeType}:{}),width:asset.width,height:asset.height,bytes:asset.bytes,createdAt:asset.createdAt,nodeId:asset.nodeId};}
function summaryFromPersisted(asset:PersistedAsset):AssetSummary{return{sha256:asset.sha256,name:asset.name,kind:asset.kind,...(asset.mimeType?{mimeType:asset.mimeType}:{}),width:asset.width,height:asset.height,bytes:asset.bytes,createdAt:asset.createdAt,nodeId:asset.nodeId};}
function persisted(payload:AssetPayload):PersistedPayload{return payload.kind==='svg'?payload:{kind:'image',mimeType:payload.mimeType,base64:encodeBase64(payload.content)};}
function restored(asset:PersistedAsset):StoredAsset{
  const payload:AssetPayload=asset.payload.kind==='svg'?asset.payload:{kind:'image',mimeType:asset.payload.mimeType,content:decodeBase64(asset.payload.base64)};
  if(payload.kind==='image'&&payload.content.byteLength!==asset.bytes)throw new Error('Saved asset byte count does not match its metadata. Remove this entry and import it again.');
  return{...asset,payload};
}
function loadAll():PersistedAsset[]{
  let raw:string|null;
  try{raw=localStorage.getItem(STORAGE_KEY);}catch{throw new Error('Figma plugin local storage is unavailable in this context.');}
  if(!raw)return[];
  try{
    const data=JSON.parse(raw) as {version?:unknown;assets?:unknown};
    if(data.version!==1||!Array.isArray(data.assets)||data.assets.length>MAX_LIBRARY_ASSETS)throw new Error('Saved asset library format is invalid.');
    for(const item of data.assets){
      if(!item||typeof item!=='object'||typeof item.sha256!=='string'||!/^[a-f0-9]{64}$/.test(item.sha256)||typeof item.name!=='string'||item.name.length>240||!['svg','image'].includes(item.kind)||!Number.isSafeInteger(item.width)||!Number.isSafeInteger(item.height)||item.width<1||item.height<1||!Number.isSafeInteger(item.bytes)||item.bytes<1||item.bytes>MAX_LIBRARY_BYTES||typeof item.createdAt!=='string'||typeof item.nodeId!=='string'||!item.payload||typeof item.payload!=='object')throw new Error('Saved asset library contains an invalid entry. Remove the damaged entry and import the file again.');
      if(item.payload.kind==='svg'){if(item.kind!=='svg'||typeof item.payload.content!=='string'||utf8Bytes(item.payload.content).byteLength!==item.bytes)throw new Error('Saved SVG metadata is invalid. Remove the damaged entry and import the file again.');}
      else if(item.payload.kind==='image'){if(item.kind!=='image'||!['image/png','image/jpeg','image/gif'].includes(item.payload.mimeType)||typeof item.payload.base64!=='string')throw new Error('Saved image metadata is invalid. Remove the damaged entry and import the file again.');}
      else throw new Error('Saved asset payload type is invalid. Remove the damaged entry and import the file again.');
    }
    return data.assets as PersistedAsset[];
  }catch(error){throw new Error(error instanceof Error?error.message:'Saved asset library is unreadable.');}
}
function persistAll(assets:PersistedAsset[]):void{
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify({version:1,assets}));}
  catch{throw new Error('Figma local storage is full or unavailable. Remove saved assets or use a smaller file; asset storage is capped at 2 MiB of source bytes.');}
}
export async function listStoredAssets():Promise<AssetSummary[]>{return loadAll().map(summaryFromPersisted).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}
export async function readStoredAsset(sha:string):Promise<StoredAsset|undefined>{const entry=loadAll().find(item=>item.sha256===sha);if(!entry)return undefined;const asset=restored(entry);if(sha256(payloadBytes(asset.payload))!==asset.sha256)throw new Error('Saved asset checksum is invalid. Remove this entry and import the file again.');return asset;}
export async function saveStoredAsset(input:Omit<StoredAsset,'sha256'>):Promise<{asset:AssetSummary;duplicate:boolean}>{
  const actualBytes=input.payload.kind==='svg'?utf8Bytes(input.payload.content).byteLength:input.payload.content.byteLength;if(actualBytes!==input.bytes)throw new Error('Asset byte count does not match its validated source data.');
  const sha=sha256(payloadBytes(input.payload));const assets=loadAll();const existing=assets.find(item=>item.sha256===sha);
  if(existing){const updated={...existing,name:input.name,nodeId:input.nodeId,createdAt:input.createdAt};persistAll(assets.map(item=>item.sha256===sha?updated:item));return{asset:summaryOf(restored(updated)),duplicate:true};}
  if(assets.length>=MAX_LIBRARY_ASSETS)throw new Error(`Local asset library is full (${MAX_LIBRARY_ASSETS} assets). Remove an item before saving another.`);
  const total=assets.reduce((sum,item)=>sum+item.bytes,0);if(total+input.bytes>MAX_LIBRARY_BYTES)throw new Error('Local asset library has a 2 MiB source-byte limit. Remove an item or import a smaller asset.');
  const record:StoredAsset={...input,sha256:sha};const entry:PersistedAsset={...record,payload:persisted(record.payload)};persistAll([...assets,entry]);return{asset:summaryOf(record),duplicate:false};
}
export async function deleteStoredAsset(sha:string):Promise<void>{persistAll(loadAll().filter(asset=>asset.sha256!==sha));}
export async function clearStoredAssets():Promise<void>{persistAll([]);}
