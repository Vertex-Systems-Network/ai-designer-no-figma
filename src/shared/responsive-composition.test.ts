import { describe,it,expect } from 'vitest';
import { composeResponsivePlan } from './responsive-composition';
const plan=(children:unknown[])=>JSON.stringify({planVersion:'1.0',brief:'Responsive hero',design:{schemaVersion:'1.0',name:'Hero',pages:[{id:'page',name:'Page',children:[{type:'frame',id:'hero',name:'Hero',width:800,height:400,children}]}]},sections:[{frameId:'hero',purpose:'Hero',assetIds:['mark']}]});
const nodes=[{type:'vector',id:'mark',name:'Mark',x:20,y:20,width:40,height:40,path:'M0 0 L40 40',constraints:{horizontal:'MIN',vertical:'MIN'}},{type:'text',id:'title',name:'Title',x:80,y:20,width:180,height:60,text:'A real heading',textAutoResize:'HEIGHT',constraints:{horizontal:'STRETCH',vertical:'MIN'}},{type:'rectangle',id:'action',name:'Action',x:600,y:100,width:120,height:40,constraints:{horizontal:'MAX',vertical:'MIN'}}];
describe('responsive composition',()=>{
 it('makes two independent editable sizes and keeps supplied asset path',()=>{
  const result=composeResponsivePlan(plan(nodes),[800,700]);expect(result.valid).toBe(true);expect(result.assets).toBe(1);
  const a=result.design!.pages[0]!.children[0]!,b=result.design!.pages[1]!.children[0]!;
  expect(a.width).toBe(800);expect(b.width).toBe(700);
  if(!('children'in a)||!('children'in b))throw Error('frame expected');
  expect(b.children[1]!.width).toBe(80);expect(b.children[2]!.x).toBe(500);
  expect(b.children[0]).toMatchObject({type:'vector',path:'M0 0 L40 40'});
 });
 it('rejects clipping on narrow width',()=>expect(composeResponsivePlan(plan(nodes),[800,500]).issues.join(' ')).toContain('horizontal bounds'));
 it('rejects unsupported nested layout',()=>{
  const result=composeResponsivePlan(plan([{type:'frame',id:'nested',name:'Nested',width:200,height:100,layout:{mode:'horizontal'},children:[]},nodes[0]]),[800,700]);expect(result.issues.join(' ')).toContain('Auto Layout');
 });
});
