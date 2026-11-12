import { parseDesignPlan } from './design-plan';
import { validateDesignSpec, type DesignNodeSpec, type DesignSpec } from './spec';

export type ResponsiveResult={valid:boolean;issues:string[];design?:DesignSpec;assets?:number};
/** Materialize two explicit, editable sizes. Only absolute-positioned, unrotated frames are supported. */
export function composeResponsivePlan(json:string, widths:[number,number]):ResponsiveResult {
  const checked=parseDesignPlan(json);
  if(!checked.valid)return{valid:false,issues:checked.issues.map(issue=>`${issue.path}: ${issue.message}`)};
  if(widths.length!==2||widths.some(width=>!Number.isInteger(width)||width<240||width>1920)||widths[0]===widths[1])return{valid:false,issues:['Two distinct integer widths between 240 and 1920 are required.']};
  const source=checked.design!;
  if(source.pages.length!==1||source.pages[0]!.children.length!==1||source.pages[0]!.children[0]!.type!=='frame')return{valid:false,issues:['Responsive composition requires exactly one page with one root frame.']};
  const root=source.pages[0]!.children[0]!;
  if(root.layout?.mode && root.layout.mode!=='none')return{valid:false,issues:['Auto Layout root is unsupported for deterministic width transformation.']};
  const issues:string[]=[];
  const assets=new Map<string,string>();
  const visit=(node:DesignNodeSpec,parentWidth:number,nextWidth:number,suffix:string,isRoot=false):DesignNodeSpec=>{
    const copy=structuredClone(node);copy.id=`${node.id}-${suffix}`;if(isRoot)copy.width=nextWidth;
    if(node.rotation)issues.push(`${node.id}: rotated geometry needs live review.`);
    const rule=node.constraints?.horizontal??'MIN';const delta=nextWidth-parentWidth;
    if(rule==='MAX')copy.x=(node.x??0)+delta;
    else if(rule==='CENTER')copy.x=(node.x??0)+delta/2;
    else if(rule==='STRETCH')copy.width=node.width+delta;
    else if(rule==='SCALE'){copy.x=(node.x??0)*nextWidth/parentWidth;copy.width=node.width*nextWidth/parentWidth;}
    if(copy.width<=0||copy.width>10000||copy.x!==undefined&&copy.x<0||((copy.x??0)+copy.width>nextWidth+0.001))issues.push(`${node.id}: horizontal bounds exceed ${nextWidth}px parent.`);
    if(node.type==='text'&&node.textAutoResize==='WIDTH_AND_HEIGHT')issues.push(`${node.id}: automatic text width is unsupported.`);
    if(node.type==='image'||node.type==='vector'){
      const payload=node.type==='image'?node.data:node.path;
      if(assets.has(node.id)&&assets.get(node.id)!==payload)issues.push(`${node.id}: asset payload changed.`);
      assets.set(node.id,payload);
    }
    if('children'in node){
      if(node.layout?.mode&&node.layout.mode!=='none')issues.push(`${node.id}: nested Auto Layout requires live review.`);
      (copy as typeof node & {children:DesignNodeSpec[]}).children=node.children.map(child=>visit(child,node.width,copy.width,suffix));
    }
    return copy;
  };
  const pages=widths.map((width,index)=>{
    const suffix=index===0?'a':'b';
    const frame=visit(root,root.width,width,suffix,true);
    frame.width=width;
    return{id:`${source.pages[0]!.id}-${suffix}`,name:`${source.pages[0]!.name} · ${width}px`,children:[frame]};
  });
  for(const section of checked.value!.sections)for(const id of section.assetIds??[])if(!assets.has(id))issues.push(`${id}: referenced asset absent.`);
  const design:DesignSpec={...source,name:`${source.name} · responsive`,pages};
  const valid=validateDesignSpec(design);
  issues.push(...valid.issues.map(issue=>`${issue.path}: ${issue.message}`));
  return issues.length?{valid:false,issues:issues.slice(0,30)}:{valid:true,issues:[],design,assets:assets.size};
}
