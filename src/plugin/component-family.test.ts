import { describe,expect,it,vi } from 'vitest';
import { exportComponentFamily, renderComponentFamily } from './component-family';
import type { ComponentFamily } from '../shared/component-family';
const spec:ComponentFamily={familyVersion:'1.0',name:'Button',width:120,height:40,variants:[{name:'Primary',label:'Continue',fill:'#006039',textColor:'#FFFFFF'},{name:'Secondary',label:'Cancel',fill:'#FFFFFF',textColor:'#101010'}]};
type MockNode={id:string;type:string;name:string;children:MockNode[];x:number;y:number;width:number;height:number;fills:unknown[];componentPropertyReferences:unknown;appendChild:(child:MockNode)=>void;loadAsync:ReturnType<typeof vi.fn>;resize:(width:number,height:number)=>void;remove:ReturnType<typeof vi.fn>;addComponentProperty:ReturnType<typeof vi.fn>;createInstance:()=>MockNode;componentPropertyDefinitions:Record<string,{type:string}>;characters?:string;fontSize?:number};
let serial=0;
function node(type:string):MockNode{
  const children:MockNode[]=[];
  return {id:`${type}-${++serial}`,type,name:'',children,x:0,y:0,width:0,height:0,fills:[] as unknown[],componentPropertyReferences:null as unknown,
    appendChild(child:MockNode){children.push(child);},loadAsync:vi.fn().mockResolvedValue(undefined),resize(width:number,height:number){this.width=width;this.height=height;},remove:vi.fn(),
    addComponentProperty:vi.fn().mockReturnValue('Label#1'),createInstance(){return node('INSTANCE');},componentPropertyDefinitions:{'Label#1':{type:'TEXT'}}};
}
function host(failCombine=false){
  const oldPage=node('PAGE');const selected=[node('TEXT')];const currentPage={...oldPage,selection:selected};const page=node('PAGE');
  const api={currentPage,createPage:vi.fn().mockReturnValue(page),setCurrentPageAsync:vi.fn().mockResolvedValue(undefined),createComponent:vi.fn(()=>node('COMPONENT')),createText:vi.fn(()=>node('TEXT')),createFrame:vi.fn(()=>node('FRAME')),loadFontAsync:vi.fn().mockResolvedValue(undefined),combineAsVariants:vi.fn((components:ReturnType<typeof node>[])=>{if(failCombine)throw new Error('combine failed');const set=node('COMPONENT_SET');set.componentPropertyDefinitions={'Label#1':{type:'TEXT'},Style:{type:'VARIANT'}};set.children.push(...components);return set;})};
  return {api,page,currentPage};
}
describe('native component family',()=>{
  it('creates variants, text properties, instances and reports native readback without touching existing selection',async()=>{
    serial=0;const {api,page,currentPage}=host();const original=currentPage.selection;
    const result=await renderComponentFamily(spec,api as unknown as PluginAPI);
    expect(result).toMatchObject({familyVersion:'1.0',pageId:page.id,variants:[{name:'Style=Primary',label:'Continue',fill:'#006039',instanceId:expect.any(String)},{name:'Style=Secondary',label:'Cancel',fill:'#FFFFFF',instanceId:expect.any(String)}]});
    expect(result.componentSetId).toBeTruthy();expect(result.reviewFrameId).toBeTruthy();
    expect(currentPage.selection).toBe(original);expect(page.remove).not.toHaveBeenCalled();
    expect(api.createComponent).toHaveBeenCalledTimes(2);expect(api.setCurrentPageAsync).toHaveBeenCalledWith(page);
    const set=api.combineAsVariants.mock.results[0]?.value;
    expect(exportComponentFamily(set as unknown as ComponentSetNode)).toEqual(spec);
  });
  it('gives a rebuilt family a unique page name instead of duplicating the existing one',async()=>{
    serial=0;const {api,page}=host();const existing=node('PAGE');existing.name='AI Designer · Button';
    (page as unknown as {parent:{children:unknown[]}}).parent={children:[existing,page]};
    await renderComponentFamily(spec,api as unknown as PluginAPI);
    expect(page.name).toBe('AI Designer · Button (2)');
  });
  it('rejects unsupported native properties during export',()=>{
    const set=node('COMPONENT_SET');set.children=[node('COMPONENT'),node('COMPONENT')];set.componentPropertyDefinitions={Style:{type:'VARIANT'},'Label#1':{type:'TEXT'},Extra:{type:'BOOLEAN'}};
    expect(()=>exportComponentFamily(set as unknown as ComponentSetNode)).toThrow('Only Style and Label');
  });
  it('removes only the newly created page when Figma variant combination fails',async()=>{
    serial=0;const {api,page,currentPage}=host(true);const before=currentPage.selection;
    await expect(renderComponentFamily(spec,api as unknown as PluginAPI)).rejects.toThrow('combine failed');
    expect(page.remove).toHaveBeenCalledOnce();expect(currentPage.selection).toBe(before);expect(api.setCurrentPageAsync).not.toHaveBeenCalled();
  });
});
