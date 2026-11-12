import { describe, expect, it, vi } from 'vitest';
import { inventoryLocalDesignSystem } from './design-inventory';

describe('local design-system inventory',()=>{
  it('reads exact IDs and local token metadata without changing selection or nodes',async()=>{
    const selection=[{id:'selected'}];
    const component={id:'comp-1',name:'Button / Primary',type:'COMPONENT',width:120,height:40};
    const page={id:'page-1',name:'Design',selection,children:[{id:'frame-1',name:'Foundation',type:'FRAME',children:[component]}]};
    const api={currentPage:page,variables:{getLocalVariablesAsync:vi.fn().mockResolvedValue([{id:'v-1',name:'Brand / Primary',resolvedType:'COLOR',variableCollectionId:'collection-1',valuesByMode:{light:{r:0,g:0,b:0},dark:{r:1,g:1,b:1}}}])},getLocalTextStylesAsync:vi.fn().mockResolvedValue([{id:'t-1',name:'Heading'}]),getLocalPaintStylesAsync:vi.fn().mockResolvedValue([]),getLocalEffectStylesAsync:vi.fn().mockResolvedValue([])};
    const before=JSON.stringify(page);
    const result=await inventoryLocalDesignSystem(api as unknown as PluginAPI);
    expect(result).toMatchObject({scope:'current-page-components-and-local-document-tokens',components:[{id:'comp-1',name:'Button / Primary'}],variables:[{id:'v-1',collectionId:'collection-1',modeIds:['light','dark']}],styles:[{id:'t-1',type:'TEXT'}]});
    expect(JSON.stringify(page)).toBe(before);
    expect(page.selection).toBe(selection);
  });
  it('bounds large trees and token lists and reports truncation',async()=>{
    const page={id:'p',name:'P',children:Array.from({length:600},(_,i)=>({id:`c-${i}`,name:'C',type:'COMPONENT',width:10,height:10}))};
    const api={currentPage:page,variables:{getLocalVariablesAsync:vi.fn().mockResolvedValue(Array.from({length:90},(_,i)=>({id:`v-${i}`,name:'V',resolvedType:'COLOR',variableCollectionId:'c',valuesByMode:{m:0}})))},getLocalTextStylesAsync:vi.fn().mockResolvedValue(Array.from({length:90},(_,i)=>({id:`s-${i}`,name:'S'}))),getLocalPaintStylesAsync:vi.fn().mockResolvedValue([]),getLocalEffectStylesAsync:vi.fn().mockResolvedValue([])};
    const result=await inventoryLocalDesignSystem(api as unknown as PluginAPI);
    expect(result.components).toHaveLength(80);expect(result.variables).toHaveLength(80);expect(result.styles).toHaveLength(80);
    expect(result.truncated).toEqual({nodes:true,components:true,variables:true,styles:true});
    expect(result.counts.scannedNodes).toBe(500);
  });
});
