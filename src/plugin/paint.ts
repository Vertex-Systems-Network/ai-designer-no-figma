import type { GradientSpec, PaintStackItemSpec, ShadowSpec } from '../shared/spec';

function rgb(hex: string): RGB {
  const value=hex.replace('#','');
  return {r:parseInt(value.slice(0,2),16)/255,g:parseInt(value.slice(2,4),16)/255,b:parseInt(value.slice(4,6),16)/255};
}

function linearGradient(spec:GradientSpec,opacity=1):GradientPaint {
  const transform:Transform=spec.direction==='horizontal'?[[1,0,0],[0,1,0]]:[[0,-1,1],[1,0,0]];
  return {type:'GRADIENT_LINEAR',gradientTransform:transform,gradientStops:spec.stops.map(stop=>({position:stop.position,color:{...rgb(stop.color),a:stop.opacity??1}})),visible:true,opacity,blendMode:'NORMAL'};
}

export function buildPaintStack(specs:PaintStackItemSpec[]):Paint[] {
  return specs.map(spec=>spec.type==='solid'
    ?{type:'SOLID',color:rgb(spec.color),opacity:spec.opacity??1,visible:true,blendMode:'NORMAL'}
    :linearGradient(spec.gradient,spec.opacity??1));
}

export function buildShadowStack(specs:ShadowSpec[]):Effect[] {
  return specs.map(spec=>({type:'DROP_SHADOW',color:{...rgb(spec.color),a:spec.opacity},offset:{x:spec.offsetX,y:spec.offsetY},radius:spec.blur,...(spec.spread!==undefined?{spread:spec.spread}:{}),visible:true,blendMode:'NORMAL'}));
}
