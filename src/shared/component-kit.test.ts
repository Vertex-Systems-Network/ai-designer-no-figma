import { describe, expect, it } from 'vitest';
import { buildComponentKit, contrast } from './component-kit';
import { auditDesignQuality, validateDesignSpec } from './spec';

describe('reusable component kit',()=>{
  for(const [brand,theme] of [['#0D8A60','light'],['#FFD400','light'],['#3B82F6','dark']] as const){
    it(`builds a valid token-bound kit for ${brand} (${theme})`,()=>{
      const spec=buildComponentKit({brandColor:brand,theme,name:'Acme'});
      const result=validateDesignSpec(spec);
      expect(result.issues).toEqual([]);
      const colors=Object.fromEntries(spec.designSystem!.colors!.map(c=>[c.name,c.color]));
      expect(contrast(colors['Color/On primary']!,colors['Color/Primary']!)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors['Color/Muted']!,colors['Color/Surface']!)).toBeGreaterThanOrEqual(4.5);
      expect(auditDesignQuality(result.value!).filter(f=>f.severity==='warning')).toEqual([]);
      const names=JSON.stringify(spec);
      for(const n of ['Button/Primary','Button/Secondary','Input/Text','Card/Metric','Navigation/Top bar','Table/Row'])expect(names).toContain(n);
    });
  }
  it('rejects invalid input',()=>{
    expect(()=>buildComponentKit({brandColor:'green'})).toThrow(/RRGGBB/);
    expect(()=>buildComponentKit({brandColor:'#000000',spacing:[4,8]})).toThrow(/four/);
  });
});
