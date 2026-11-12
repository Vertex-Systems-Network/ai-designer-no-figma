import { parseDesignSpec, type DesignSpec, type DesignNodeSpec } from './spec';
import { utf8ByteLength } from './utf8';

export type DesignPlan = {
  planVersion:'1.0';
  brief:string;
  design:DesignSpec;
  sections:Array<{frameId:string;purpose:string;componentCandidates?:string[];tokenNames?:string[];assetIds?:string[]}>;
};
export type PlanInventory = {components:Array<{id:string}>;variables?:Array<{id:string}>;styles?:Array<{id:string}>;truncated?:{nodes?:boolean;components?:boolean;variables?:boolean;styles?:boolean}};
export type PlanResult = {valid:boolean;issues:Array<{path:string;message:string}>;value?:DesignPlan;design?:DesignSpec};
const MAX_PLAN_BYTES=640_000;
const idPattern=/^[A-Za-z0-9:_-]{1,128}$/;
const record=(input:unknown):input is Record<string,unknown>=>Boolean(input)&&typeof input==='object'&&!Array.isArray(input);
const strings=(input:unknown,max:number):input is string[]=>Array.isArray(input)&&input.length<=max&&input.every(value=>typeof value==='string'&&value.length>0&&value.length<=128);

/** A plan is a checked map to a fully validated native specification, not an instruction interpreter. */
export function parseDesignPlan(json:string,inventory?:PlanInventory):PlanResult {
  const issues:PlanResult['issues']=[];
  if(utf8ByteLength(json)>MAX_PLAN_BYTES)return{valid:false,issues:[{path:'$',message:`Plan exceeds ${MAX_PLAN_BYTES} bytes.`}]};
  let input:unknown;try{input=JSON.parse(json);}catch{return{valid:false,issues:[{path:'$',message:'Invalid plan JSON.'}]};}
  if(!record(input)||Object.keys(input).some(key=>!['planVersion','brief','design','sections'].includes(key)))return{valid:false,issues:[{path:'$',message:'Plan must contain only planVersion, brief, design and sections.'}]};
  if(input.planVersion!=='1.0')issues.push({path:'planVersion',message:'Expected plan version 1.0.'});
  if(typeof input.brief!=='string'||!input.brief.trim()||input.brief.length>4000)issues.push({path:'brief',message:'Brief must contain 1–4,000 characters.'});
  const checked=parseDesignSpec(JSON.stringify(input.design??null));
  if(!checked.valid)issues.push(...checked.issues.map(issue=>({path:`design.${issue.path}`,message:issue.message})));
  if(!Array.isArray(input.sections)||input.sections.length<1||input.sections.length>40)issues.push({path:'sections',message:'Plan needs 1–40 sections.'});
  if(issues.length)return{valid:false,issues:issues.slice(0,30)};
  const design=checked.value!;const sections=input.sections as unknown[];
  const topFrames=new Set<string>();const nodeById=new Map<string,DesignNodeSpec>();const descendants=new Map<string,Set<string>>();const usedTokens=new Map<string,Set<string>>();
  const visit=(node:DesignNodeSpec)=>{nodeById.set(node.id,node);if('children'in node)node.children.forEach(visit);};
  for(const page of design.pages)for(const node of page.children){if(node.type==='frame'){topFrames.add(node.id);const ids=new Set<string>(),tokens=new Set<string>();const collect=(child:DesignNodeSpec)=>{ids.add(child.id);if(child.fillToken)tokens.add(child.fillToken);if(child.type==='text'&&child.textStyleToken)tokens.add(child.textStyleToken);if('children'in child)child.children.forEach(collect);};collect(node);descendants.set(node.id,ids);usedTokens.set(node.id,tokens);}visit(node);}
  const colorTokens=new Set(design.designSystem?.colors?.map(token=>token.name)??[]);
  const textTokens=new Set(design.designSystem?.typography?.map(token=>token.name)??[]);
  const componentIds=new Set(inventory?.components.map(component=>component.id)??[]);
  const mapped=new Set<string>();
  sections.forEach((raw,index)=>{
    const path=`sections[${index}]`;
    if(!record(raw)||Object.keys(raw).some(key=>!['frameId','purpose','componentCandidates','tokenNames','assetIds'].includes(key))){issues.push({path,message:'Section has unsupported fields.'});return;}
    if(typeof raw.frameId!=='string'||!topFrames.has(raw.frameId))issues.push({path:`${path}.frameId`,message:'Reference a top-level frame in design.'});
    else if(mapped.has(raw.frameId))issues.push({path:`${path}.frameId`,message:'Frame is mapped more than once.'});else mapped.add(raw.frameId);
    if(typeof raw.purpose!=='string'||!raw.purpose.trim()||raw.purpose.length>240)issues.push({path:`${path}.purpose`,message:'Purpose must contain 1–240 characters.'});
    for(const field of ['componentCandidates','tokenNames','assetIds'] as const){if(raw[field]!==undefined&&!strings(raw[field],20))issues.push({path:`${path}.${field}`,message:'Expected up to 20 non-empty identifiers.'});}
    if(strings(raw.componentCandidates,20))for(const id of raw.componentCandidates){if(!idPattern.test(id)||!inventory||!componentIds.has(id))issues.push({path:`${path}.componentCandidates`,message:`Unknown local component ID: ${id.slice(0,128)}.`});}
    if(strings(raw.tokenNames,20))for(const name of raw.tokenNames)if((!colorTokens.has(name)&&!textTokens.has(name))||!usedTokens.get(String(raw.frameId))?.has(name))issues.push({path:`${path}.tokenNames`,message:`Token is not defined and used in this section: ${name.slice(0,128)}.`});
    if(strings(raw.assetIds,20))for(const id of raw.assetIds)if((nodeById.get(id)?.type!=='image'&&nodeById.get(id)?.type!=='vector')||!descendants.get(String(raw.frameId))?.has(id))issues.push({path:`${path}.assetIds`,message:`Asset ID is not an image/vector in this section: ${id.slice(0,128)}.`});
  });
  for(const id of topFrames)if(!mapped.has(id))issues.push({path:'sections',message:`Top-level frame ${id} has no plan section.`});
  if(!topFrames.size)issues.push({path:'design.pages',message:'Plan needs at least one top-level frame.'});
  if(issues.length)return{valid:false,issues:issues.slice(0,30)};
  return{valid:true,issues:[],value:input as DesignPlan,design};
}
