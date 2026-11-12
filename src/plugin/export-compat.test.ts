import { describe, expect, it } from 'vitest';
import { assertPortableBlendMode, assertSinglePortableStroke } from './export-compat';

describe('portable export blend-mode checks', () => {
  it('accepts normal blending on all export surfaces', () => {
    for (const surface of ['node', 'paint', 'effect']) {
      expect(() => assertPortableBlendMode('Card', surface, 'NORMAL')).not.toThrow();
    }
  });

  it('allows pass-through containers while rejecting unrepresented paint/effect modes', () => {
    expect(() => assertPortableBlendMode('Frame', 'node', 'PASS_THROUGH', true)).not.toThrow();
    expect(() => assertPortableBlendMode('Title', 'node', 'PASS_THROUGH', true)).not.toThrow();
    expect(() => assertPortableBlendMode('Title', 'node', 'MULTIPLY', true)).toThrow(/cannot preserve/);
    expect(() => assertPortableBlendMode('Card', 'paint', 'MULTIPLY')).toThrow(/cannot preserve/);
    expect(() => assertPortableBlendMode('Card', 'effect', 'SCREEN')).toThrow(/Change it to Normal/);
  });

  it('rejects multi-stroke export rather than silently omitting visible strokes',()=>{
    expect(()=>assertSinglePortableStroke('Rule',0)).not.toThrow();
    expect(()=>assertSinglePortableStroke('Rule',1)).not.toThrow();
    expect(()=>assertSinglePortableStroke('Rule',2)).toThrow(/can preserve only one/);
  });
});
