import { describe, expect, it, vi } from 'vitest';
import { buildEffectStack, buildPaintStack, buildShadowStack } from './paint';

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
  it('uses an explicit affine transform for diagonal linear gradients',()=>{
    const transform:[[number,number,number],[number,number,number]]=[[.72,-.42,.18],[.31,.86,-.07]];
    expect(buildPaintStack([{type:'linear-gradient',gradient:{direction:'horizontal',transform,stops:[{position:0,color:'#000000'},{position:1,color:'#FFFFFF'}]}}])[0]).toMatchObject({type:'GRADIENT_LINEAR',gradientTransform:transform});
  });
  it('maps radial gradient paints with their affine transform and stop alpha',()=>{
    const transform:[[number,number,number],[number,number,number]]=[[.8,0,.1],[0,.9,.05]];
    const result=buildPaintStack([{type:'radial-gradient',opacity:.75,gradient:{transform,stops:[{position:0,color:'#FFFFFF',opacity:.8},{position:1,color:'#087A55'}]}}]);
    expect(result[0]).toMatchObject({type:'GRADIENT_RADIAL',gradientTransform:transform,opacity:.75,gradientStops:[{position:0,color:{r:1,g:1,b:1,a:.8}},{position:1,color:{r:8/255,g:122/255,b:85/255,a:1}}]});
  });
  it('maps angular and diamond gradient paints natively',()=>{
    const gradient={transform:[[.7,.1,.05],[-.2,.8,.1]] as [[number,number,number],[number,number,number]],stops:[{position:0,color:'#FFFFFF'},{position:1,color:'#087A55'}]};
    const result=buildPaintStack([{type:'angular-gradient',gradient},{type:'diamond-gradient',gradient}]);
    expect(result.map(paint=>paint.type)).toEqual(['GRADIENT_ANGULAR','GRADIENT_DIAMOND']);
    expect(result[0]).toMatchObject({gradientTransform:gradient.transform,gradientStops:[{position:0},{position:1}]});
    expect(result[1]).toMatchObject({gradientTransform:gradient.transform});
  });
  it('maps drop-shadow stacks in order with opacity and spread intact',()=>{
    const shadows=buildShadowStack([{color:'#000000',opacity:.16,offsetX:0,offsetY:4,blur:12,spread:1},{color:'#0D8A60',opacity:.2,offsetX:2,offsetY:1,blur:3}]);
    expect(shadows).toHaveLength(2);
    expect(shadows[0]).toMatchObject({type:'DROP_SHADOW',color:{r:0,g:0,b:0,a:.16},offset:{x:0,y:4},radius:12,spread:1});
    expect(shadows[1]).toMatchObject({type:'DROP_SHADOW',color:{r:13/255,g:138/255,b:96/255,a:.2},offset:{x:2,y:1},radius:3});
  });
  it('maps inner shadows and both native blur effects in order',()=>{
    const effects=buildEffectStack([
      {type:'inner-shadow',color:'#101010',opacity:.24,offsetX:1,offsetY:2,blur:5,spread:1},
      {type:'layer-blur',blur:8},
      {type:'background-blur',blur:12},
    ]);
    expect(effects).toHaveLength(3);
    expect(effects[0]).toMatchObject({type:'INNER_SHADOW',color:{r:16/255,g:16/255,b:16/255,a:.24},offset:{x:1,y:2},radius:5,spread:1});
    expect(effects[1]).toMatchObject({type:'LAYER_BLUR',radius:8});
    expect(effects[2]).toMatchObject({type:'BACKGROUND_BLUR',radius:12});
  });
  it('maps progressive layer/background blur radii and normalized endpoints',()=>{
    const effects=buildEffectStack([
      {type:'progressive-layer-blur',startRadius:2,endRadius:18,startOffset:{x:.1,y:.2},endOffset:{x:.9,y:.8}},
      {type:'progressive-background-blur',startRadius:0,endRadius:12,startOffset:{x:0,y:.5},endOffset:{x:1,y:.5}},
    ]);
    expect(effects[0]).toMatchObject({type:'LAYER_BLUR',blurType:'PROGRESSIVE',startRadius:2,radius:18,startOffset:{x:.1,y:.2},endOffset:{x:.9,y:.8}});
    expect(effects[1]).toMatchObject({type:'BACKGROUND_BLUR',blurType:'PROGRESSIVE',startRadius:0,radius:12,startOffset:{x:0,y:.5},endOffset:{x:1,y:.5}});
  });
  it('resolves embedded image paints and keeps them in the declared order',()=>{
    const resolve=vi.fn(()=> 'image-hash-1');
    const result=buildPaintStack([
      {type:'solid',color:'#FFFFFF'},
      {type:'image',mimeType:'image/png',data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==',scaleMode:'CROP',opacity:.7},
      {type:'linear-gradient',gradient:{direction:'horizontal',stops:[{position:0,color:'#000000'},{position:1,color:'#FFFFFF'}]}},
    ],resolve);
    expect(resolve).toHaveBeenCalledOnce();
    expect(result.map(paint=>paint.type)).toEqual(['SOLID','IMAGE','GRADIENT_LINEAR']);
    expect(result[1]).toMatchObject({type:'IMAGE',imageHash:'image-hash-1',scaleMode:'CROP',opacity:.7});
  });
});
