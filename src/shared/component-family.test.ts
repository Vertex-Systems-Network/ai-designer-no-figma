import { describe,expect,it } from 'vitest';
import { parseComponentFamily } from './component-family';
const family={familyVersion:'1.0',name:'Button',width:120,height:40,variants:[{name:'Primary',label:'Continue',fill:'#006039',textColor:'#FFFFFF'},{name:'Secondary',label:'Cancel',fill:'#FFFFFF',textColor:'#101010'}]};
describe('component family contract',()=>{
  it('accepts a bounded native variant family',()=>expect(parseComponentFamily(JSON.stringify(family))).toMatchObject({valid:true,value:family}));
  it('rejects duplicates, unsupported property types and oversized families',()=>{
    expect(parseComponentFamily(JSON.stringify({...family,variants:[family.variants[0],{...family.variants[0],name:'primary'}]})).valid).toBe(false);
    expect(parseComponentFamily(JSON.stringify({...family,variants:[{...family.variants[0],script:'run()'},family.variants[1]]})).valid).toBe(false);
    expect(parseComponentFamily(JSON.stringify({...family,variants:[family.variants[0]]})).valid).toBe(false);
    expect(parseComponentFamily(JSON.stringify({...family,name:'x'.repeat(17000)})).valid).toBe(false);
  });
});
