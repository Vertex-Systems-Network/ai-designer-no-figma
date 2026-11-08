import {describe,expect,it} from 'vitest';
import {createAssetLibrary,MAX_LIBRARY_ASSETS,MAX_LIBRARY_BYTES,type AssetStorage,type StoredAsset} from './asset-library';
import {sha256} from './sha256';

function memoryStorage(fail=false):AssetStorage{
  const values=new Map<string,unknown>();return{
    async getAsync(key){return values.get(key);},
    async setAsync(key,value){if(fail)throw new Error('storage denied');values.set(key,value);},
    async deleteAsync(key){values.delete(key);},
  };
}
function svgAsset(content='<svg width="10" height="10"><rect width="10" height="10" fill="#000000"/></svg>'):Omit<StoredAsset,'sha256'>{return{name:'Mark',kind:'svg',createdAt:'2026-11-08T00:00:00.000Z',width:10,height:10,bytes:new TextEncoder().encode(content).length,nodeId:'node-1',payload:{kind:'svg',content}};}

describe('Figma client-storage asset library',()=>{
  it('computes standard SHA-256 fingerprints',()=>{
    expect(sha256(new TextEncoder().encode(''))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256(new TextEncoder().encode('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256(new Uint8Array(1000))).toBe('541b3e9daa09b20bf85fa273e5cbd3e80185aa4ec298e765db87742b70138a53');
  });
  it('stores, deduplicates, reads, deletes and clears through the supplied host storage',async()=>{
    const library=createAssetLibrary(memoryStorage());const first=await library.save(svgAsset());expect(first.duplicate).toBe(false);
    const duplicate=await library.save({...svgAsset(),name:'Updated mark',nodeId:'node-2'});expect(duplicate.duplicate).toBe(true);
    expect(await library.list()).toHaveLength(1);expect(await library.read(first.asset.sha256)).toMatchObject({name:'Updated mark',payload:{kind:'svg'}});
    await library.delete(first.asset.sha256);expect(await library.list()).toEqual([]);
    await library.save(svgAsset());await library.clear();expect(await library.list()).toEqual([]);
  });
  it('round-trips raster bytes as Uint8Array without browser storage APIs',async()=>{
    const library=createAssetLibrary(memoryStorage());const bytes=new Uint8Array([1,2,3,4]);const saved=await library.save({name:'pixel.png',kind:'image',mimeType:'image/png',createdAt:'2026-11-08T00:00:00.000Z',width:1,height:1,bytes:bytes.length,nodeId:'image-node',payload:{kind:'image',mimeType:'image/png',content:bytes}});
    const restored=await library.read(saved.asset.sha256);expect(restored?.payload.kind).toBe('image');if(restored?.payload.kind==='image')expect(Array.from(restored.payload.content)).toEqual([1,2,3,4]);
  });
  it('reports host storage denial and enforces library limits',async()=>{
    await expect(createAssetLibrary(memoryStorage(true)).save(svgAsset())).rejects.toThrow('storage denied');
    const library=createAssetLibrary(memoryStorage());
    await expect(library.save(svgAsset(`<svg width="10" height="10">${' '.repeat(MAX_LIBRARY_BYTES+1)}</svg>`))).rejects.toThrow(/larger than the 2 MiB/);
    const crowded=Array.from({length:MAX_LIBRARY_ASSETS},(_,index)=>({...svgAsset(`<svg width="10" height="10"><rect id="${index}" width="10" height="10"/></svg>`),name:`asset-${index}`}));
    for(const item of crowded)await library.save(item);
    await expect(library.save(svgAsset('<svg width="10" height="10"><circle cx="5" cy="5" r="4"/></svg>'))).rejects.toThrow(/full/);
  });
});
