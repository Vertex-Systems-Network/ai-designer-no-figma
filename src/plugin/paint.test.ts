import { describe, expect, it } from 'vitest';
import { buildPaintStack } from './paint';

describe('native Figma paint stack mapping',()=>{
  it('preserves paint order, solid opacity, gradient direction and stop alpha',()=>{
    const result=buildPaintStack([
      {type:'solid',color:'#0D8A60',opacity:.8},
      {type:'linear-gradient',opacity:.45,gradient:{direction:'vertical',stops:[{position:0,color:'#FFFFFF',opacity:.25},{position:1,color:'#000000'}]}},
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({type:'SOLID',color:{r:13/255,g:138/255,b:96/255},opacity:.8});
    expect(result[1]).toMatchObject({type:'GRADIENT_LINEAR',gradientTransform:[[0,-1,1],[1,0,0]],opacity:.45,gradientStops:[{position:0,color:{r:1,g:1,b:1,a:.25}},{position:1,color:{r:0,g:0,b:0,a:1}}]});
  });
});
