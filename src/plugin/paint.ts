import type { EffectSpec, GradientSpec, PaintStackItemSpec, RadialGradientSpec, ShadowSpec } from '../shared/spec';

function rgb(hex: string): RGB {
  const value=hex.replace('#','');
  return {r:parseInt(value.slice(0,2),16)/255,g:parseInt(value.slice(2,4),16)/255,b:parseInt(value.slice(4,6),16)/255};
}

function linearGradient(spec:GradientSpec,opacity=1):GradientPaint {
  const transform:Transform=spec.transform??(spec.direction==='horizontal'?[[1,0,0],[0,1,0]]:[[0,-1,1],[1,0,0]]);
  return {type:'GRADIENT_LINEAR',gradientTransform:transform,gradientStops:spec.stops.map(stop=>({position:stop.position,color:{...rgb(stop.color),a:stop.opacity??1}})),visible:true,opacity,blendMode:'NORMAL'};
}
function radialGradient(spec:RadialGradientSpec,opacity=1):GradientPaint {
  return {type:'GRADIENT_RADIAL',gradientTransform:spec.transform,gradientStops:spec.stops.map(stop=>({position:stop.position,color:{...rgb(stop.color),a:stop.opacity??1}})),visible:true,opacity,blendMode:'NORMAL'};
}

export function buildPaintStack(specs:PaintStackItemSpec[],resolveImageHash?:(spec:Extract<PaintStackItemSpec,{type:'image'}>)=>string):Paint[] {
  return specs.map(spec=>spec.type==='solid'
    ?{type:'SOLID',color:rgb(spec.color),opacity:spec.opacity??1,visible:true,blendMode:'NORMAL'}
    :spec.type==='linear-gradient'
      ?linearGradient(spec.gradient,spec.opacity??1)
      :spec.type==='radial-gradient'
        ?radialGradient(spec.gradient,spec.opacity??1)
        :{type:'IMAGE',imageHash:(resolveImageHash??(()=>{throw new Error('An image paint resolver is required to render embedded image paints.');}))(spec),scaleMode:spec.scaleMode??'FIT',opacity:spec.opacity??1,visible:true,blendMode:'NORMAL'});
}

export function buildShadowStack(specs:ShadowSpec[]):Effect[] {
  return specs.map(spec=>({type:'DROP_SHADOW',color:{...rgb(spec.color),a:spec.opacity},offset:{x:spec.offsetX,y:spec.offsetY},radius:spec.blur,...(spec.spread!==undefined?{spread:spec.spread}:{}),visible:true,blendMode:'NORMAL'}));
}

export function buildEffectStack(specs:EffectSpec[]):Effect[] {
  return specs.map(spec=>{
    if(spec.type==='layer-blur')return {type:'LAYER_BLUR',blurType:'NORMAL',radius:spec.blur,visible:true} as Effect;
    if(spec.type==='background-blur')return {type:'BACKGROUND_BLUR',blurType:'NORMAL',radius:spec.blur,visible:true} as Effect;
    if(!('color' in spec))throw new Error('Unsupported effect specification.');
    return {type:spec.type==='inner-shadow'?'INNER_SHADOW':'DROP_SHADOW',color:{...rgb(spec.color),a:spec.opacity},offset:{x:spec.offsetX,y:spec.offsetY},radius:spec.blur,...(spec.spread!==undefined?{spread:spec.spread}:{}),visible:true,blendMode:'NORMAL'} as Effect;
  });
}
