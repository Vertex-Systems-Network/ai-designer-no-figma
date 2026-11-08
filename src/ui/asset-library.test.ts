import { afterEach,describe,expect,it } from 'vitest';
import { sha256 } from '../shared/sha256';
import { clearStoredAssets,deleteStoredAsset,listStoredAssets,readStoredAsset,saveStoredAsset } from './asset-library';

const originalStorage=globalThis.localStorage;
function installStorage(failWrites=false){
  const values=new Map<string,string>();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{if(failWrites)throw new Error('quota');values.set(key,value);},removeItem:(key:string)=>values.delete(key),clear:()=>values.clear(),key:(index:number)=>[...values.keys()][index]??null,get length(){return values.size;}}});
}
afterEach(()=>{if(originalStorage===undefined)delete (globalThis as {localStorage?:Storage}).localStorage;else Object.defineProperty(globalThis,'localStorage',{configurable:true,value:originalStorage});});

describe('local asset identity',()=>{
  it('computes standard SHA-256 fingerprints for known UTF-8 payloads',()=>{
    expect(sha256(new TextEncoder().encode(''))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256(new TextEncoder().encode('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('handles a payload spanning several SHA-256 blocks',()=>{
    expect(sha256(new Uint8Array(1000))).toBe('541b3e9daa09b20bf85fa273e5cbd3e80185aa4ec298e765db87742b70138a53');
  });
  it('persists SVG and raster source in localStorage, deduplicates and supports reuse/removal',async()=>{
    installStorage();
    const svg='<svg width="10" height="10"><rect width="10" height="10" fill="#000000"/></svg>';
    const metadata={name:'Mark',kind:'svg' as const,createdAt:'2026-11-08T00:00:00.000Z',width:10,height:10,bytes:new TextEncoder().encode(svg).length,nodeId:'node-1',payload:{kind:'svg' as const,content:svg}};
    const first=await saveStoredAsset(metadata);expect(first.duplicate).toBe(false);
    const updated=await saveStoredAsset({...metadata,name:'Updated mark',nodeId:'node-2'});expect(updated.duplicate).toBe(true);
    expect(await listStoredAssets()).toHaveLength(1);
    expect(await readStoredAsset(first.asset.sha256)).toMatchObject({name:'Updated mark',payload:{kind:'svg',content:svg}});
    await deleteStoredAsset(first.asset.sha256);expect(await listStoredAssets()).toEqual([]);
    await saveStoredAsset(metadata);await clearStoredAssets();expect(await listStoredAssets()).toEqual([]);
  });
  it('reports local browser storage denial without relying on IndexedDB',async()=>{
    installStorage(true);
    const svg='<svg width="10" height="10"><rect width="10" height="10" fill="#000000"/></svg>';
    await expect(saveStoredAsset({name:'Mark',kind:'svg',createdAt:'2026-11-08T00:00:00.000Z',width:10,height:10,bytes:new TextEncoder().encode(svg).length,nodeId:'node-1',payload:{kind:'svg',content:svg}})).rejects.toThrow(/local storage is full or unavailable/);
  });
});
