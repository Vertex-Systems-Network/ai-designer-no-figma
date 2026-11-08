import {describe,expect,it} from 'vitest';
import {verifyAssetReadback} from './asset-readback';

describe('native asset readback checks',()=>{
  it('accepts retained vector layers and native image fills',()=>{
    expect(()=>verifyAssetReadback({id:'svg-1',type:'FRAME',width:128,height:128,childCount:3},{id:'svg-1',kind:'svg',width:128,height:128})).not.toThrow();
    expect(()=>verifyAssetReadback({id:'img-1',type:'RECTANGLE',width:64,height:64,imageFill:true},{id:'img-1',kind:'image',width:64,height:64})).not.toThrow();
  });
  it('rejects missing nodes, dimension drift and flattened asset nodes',()=>{
    expect(()=>verifyAssetReadback(null,{id:'svg-1',kind:'svg',width:128,height:128})).toThrow(/did not retain/);
    expect(()=>verifyAssetReadback({id:'img-1',type:'RECTANGLE',width:63,height:64,imageFill:true},{id:'img-1',kind:'image',width:64,height:64})).toThrow(/dimensions/);
    expect(()=>verifyAssetReadback({id:'svg-1',type:'FRAME',width:128,height:128,childCount:0},{id:'svg-1',kind:'svg',width:128,height:128})).toThrow(/editable vector/);
    expect(()=>verifyAssetReadback({id:'img-1',type:'RECTANGLE',width:64,height:64,imageFill:false},{id:'img-1',kind:'image',width:64,height:64})).toThrow(/native image fill/);
  });
});
