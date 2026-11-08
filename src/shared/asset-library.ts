import { sha256 } from './sha256';
import { utf8Bytes } from './utf8';

export const MAX_LIBRARY_ASSETS=50;
export const MAX_LIBRARY_BYTES=2*1024*1024;
export type AssetPayload={kind:'svg';content:string}|{kind:'image';mimeType:'image/png'|'image/jpeg'|'image/gif';content:Uint8Array};
export type StoredAsset={sha256:string;name:string;kind:'svg'|'image';mimeType?:string;width:number;height:number;bytes:number;createdAt:string;nodeId:string;payload:AssetPayload};
export type AssetSummary=Omit<StoredAsset,'payload'>;
export interface AssetStorage {getAsync(key:string):Promise<unknown>;setAsync(key:string,value:unknown):Promise<void>;deleteAsync(key:string):Promise<void>}
const KEY='asset-library-v1';

function payloadBytes(payload:AssetPayload):Uint8Array{
  const content=payload.kind==='svg'?utf8Bytes(payload.content):payload.content;
  const prefix=utf8Bytes(`${payload.kind}:${payload.kind==='image'?payload.mimeType:'image/svg+xml'}\0`);
  const bytes=new Uint8Array(prefix.length+content.length);bytes.set(prefix);bytes.set(content,prefix.length);return bytes;
}
function summary(asset:StoredAsset):AssetSummary{return{sha256:asset.sha256,name:asset.name,kind:asset.kind,...(asset.mimeType?{mimeType:asset.mimeType}:{}),width:asset.width,height:asset.height,bytes:asset.bytes,createdAt:asset.createdAt,nodeId:asset.nodeId};}
function isAsset(value:unknown):value is StoredAsset{
  if(!value||typeof value!=='object')return false;
  const item=value as Partial<StoredAsset>;
  return typeof item.sha256==='string'&&/^[a-f0-9]{64}$/.test(item.sha256)&&typeof item.name==='string'&&item.name.length<=240&&['svg','image'].includes(item.kind??'')&&Number.isSafeInteger(item.width)&&Number.isSafeInteger(item.height)&&!!item.width&&!!item.height&&Number.isSafeInteger(item.bytes)&&!!item.bytes&&typeof item.createdAt==='string'&&typeof item.nodeId==='string'&&!!item.payload&&((item.payload.kind==='svg'&&typeof item.payload.content==='string')||(item.payload.kind==='image'&&['image/png','image/jpeg','image/gif'].includes(item.payload.mimeType??'')&&item.payload.content instanceof Uint8Array));
}
export function createAssetLibrary(storage:AssetStorage){
  async function all():Promise<StoredAsset[]>{const value=await storage.getAsync(KEY);if(value===undefined)return[];if(!Array.isArray(value)||value.length>MAX_LIBRARY_ASSETS||!value.every(isAsset))throw new Error('Figma client storage contains an invalid asset library. Clear it and import the assets again.');return value;}
  return{
    async list():Promise<AssetSummary[]>{return(await all()).map(summary).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));},
    async read(sha:string):Promise<StoredAsset|undefined>{const asset=(await all()).find(item=>item.sha256===sha);if(!asset)return undefined;if(sha256(payloadBytes(asset.payload))!==asset.sha256)throw new Error('Saved asset checksum is invalid. Remove it and import the file again.');return asset;},
    async save(input:Omit<StoredAsset,'sha256'>):Promise<{asset:AssetSummary;duplicate:boolean}>{
      const actual=input.payload.kind==='svg'?utf8Bytes(input.payload.content).length:input.payload.content.byteLength;if(actual!==input.bytes)throw new Error('Asset byte count does not match its validated source data.');
      if(input.bytes>MAX_LIBRARY_BYTES)throw new Error('This asset is larger than the 2 MiB local library limit.');
      const fingerprint=sha256(payloadBytes(input.payload));const assets=await all();const previous=assets.find(item=>item.sha256===fingerprint);
      if(previous){const updated={...previous,name:input.name,nodeId:input.nodeId,createdAt:input.createdAt};await storage.setAsync(KEY,assets.map(item=>item.sha256===fingerprint?updated:item));return{asset:summary(updated),duplicate:true};}
      if(assets.length>=MAX_LIBRARY_ASSETS)throw new Error(`Local asset library is full (${MAX_LIBRARY_ASSETS} items). Remove one before saving another.`);
      if(assets.reduce((sum,item)=>sum+item.bytes,0)+input.bytes>MAX_LIBRARY_BYTES)throw new Error('Local asset library reached its 2 MiB source-byte limit. Remove an item before saving another.');
      const asset:StoredAsset={...input,sha256:fingerprint};await storage.setAsync(KEY,[...assets,asset]);return{asset:summary(asset),duplicate:false};
    },
    async delete(sha:string):Promise<void>{await storage.setAsync(KEY,(await all()).filter(item=>item.sha256!==sha));},
    async clear():Promise<void>{await storage.deleteAsync(KEY);},
  };
}
