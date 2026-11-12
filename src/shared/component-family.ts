import * as z from 'zod/v4';

const variant=z.object({name:z.string().min(1).max(40).regex(/^[A-Za-z0-9 _-]+$/),label:z.string().min(1).max(120),fill:z.string().regex(/^#[0-9A-Fa-f]{6}$/),textColor:z.string().regex(/^#[0-9A-Fa-f]{6}$/)}).strict();
export const componentFamilySchema=z.object({familyVersion:z.literal('1.0'),name:z.string().min(1).max(80),width:z.number().int().min(40).max(800),height:z.number().int().min(24).max(400),variants:z.array(variant).min(2).max(8)}).strict().superRefine((value,ctx)=>{
  const names=new Set<string>();for(const [index,item] of value.variants.entries()){const name=item.name.toLowerCase();if(names.has(name))ctx.addIssue({code:'custom',path:['variants',index,'name'],message:'Variant names must be unique.'});names.add(name);}
});
export type ComponentFamily=z.infer<typeof componentFamilySchema>;
export function parseComponentFamily(json:string):{valid:true;value:ComponentFamily}|{valid:false;issues:Array<{path:string;message:string}>}{
  if(new TextEncoder().encode(json).length>16_384)return{valid:false,issues:[{path:'$',message:'Component family exceeds 16 KB.'}]};
  let input:unknown;try{input=JSON.parse(json);}catch{return{valid:false,issues:[{path:'$',message:'Invalid JSON.'}]};}
  const parsed=componentFamilySchema.safeParse(input);if(!parsed.success)return{valid:false,issues:parsed.error.issues.slice(0,20).map(issue=>({path:issue.path.join('.'),message:issue.message}))};
  return{valid:true,value:parsed.data};
}
