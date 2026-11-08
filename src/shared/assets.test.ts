import { describe, expect, it } from 'vitest';
import { deflateSync } from 'node:zlib';
import { sanitizeSvg, validateRasterAsset } from './assets';

function pngChunk(type:string,data:Uint8Array):Uint8Array{
  const name=new TextEncoder().encode(type);const chunkData=new Uint8Array(name.length+data.length);chunkData.set(name);chunkData.set(data,name.length);
  let crc=0xffffffff;for(const byte of chunkData){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc&1)?0xedb88320^(crc>>>1):crc>>>1;}crc=(crc^0xffffffff)>>>0;
  const result=new Uint8Array(12+data.length);const view=new DataView(result.buffer);view.setUint32(0,data.length);result.set(name,4);result.set(data,8);view.setUint32(8+data.length,crc);return result;
}
function validPng(width=1,height=1):Uint8Array{
  const signature=new Uint8Array([137,80,78,71,13,10,26,10]);const header=new Uint8Array(13);const view=new DataView(header.buffer);view.setUint32(0,width);view.setUint32(4,height);header.set([8,6,0,0,0],8);
  const chunks=[pngChunk('IHDR',header),pngChunk('IDAT',new Uint8Array(deflateSync(new Uint8Array([0,255,0,0,255])))),pngChunk('IEND',new Uint8Array())];
  const result=new Uint8Array(signature.length+chunks.reduce((n,c)=>n+c.length,0));let offset=0;result.set(signature,offset);offset+=signature.length;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}return result;
}

describe('safe vector imports',()=>{
  it('normalizes allowed geometry and reports dimensions and element count',()=>{
    const result=sanitizeSvg('<svg width="24" height="24"><g><path d="M2 2 L22 22 Z" fill="#0D8A60"/></g></svg>');
    expect(result).toMatchObject({width:24,height:24,elements:3});
    expect(result.svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });
  it('rejects executable, external, embedded, and unsupported markup',()=>{
    expect(()=>sanitizeSvg('<svg width="10" height="10"><script>alert(1)</script></svg>')).toThrow(/Unsupported SVG element/);
    expect(()=>sanitizeSvg('<svg width="10" height="10" onload="alert(1)"><path d="M0 0"/></svg>')).toThrow(/attribute/);
    expect(()=>sanitizeSvg('<svg width="10" height="10"><image href="https://example.invalid/a.png"/></svg>')).toThrow(/Unsupported SVG element/);
    expect(()=>sanitizeSvg('<svg width="10" height="10"><path d="M0 0" fill="url(https://x)"/></svg>')).toThrow(/unsafe|simple color/);
  });
  it('rejects malformed trees, unbounded documents, and missing dimensions',()=>{
    expect(()=>sanitizeSvg('<svg width="10" height="10"><g></svg>')).toThrow(/closing tag/);
    expect(()=>sanitizeSvg('<svg><path d="M0 0"/></svg>')).toThrow(/dimensions/);
    expect(()=>sanitizeSvg(`<svg>${'<path d="M0 0"/>'.repeat(5001)}</svg>`)).toThrow(/element limit/);
  });
});

describe('raster image validation',()=>{
  const png=()=>validPng();
  it('detects PNG signatures and dimensions before plugin import',()=>{
    expect(validateRasterAsset(png(),'image/png')).toMatchObject({mimeType:'image/png',width:1,height:1,size:70});
  });
  it('rejects MIME mismatches, invalid signatures, and oversized dimensions',()=>{
    expect(()=>validateRasterAsset(png(),'image/jpeg')).toThrow(/MIME type mismatch/);
    expect(()=>validateRasterAsset(new Uint8Array(24),'image/png')).toThrow(/Unsupported or invalid/);
    expect(()=>validateRasterAsset(validPng(8193,1),'image/png')).toThrow(/dimensions/);
  });
});
