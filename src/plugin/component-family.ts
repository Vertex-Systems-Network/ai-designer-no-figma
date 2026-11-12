import type { ComponentFamily } from '../shared/component-family';
import { uniquePageName } from '../shared/page-names';

const color=(hex:string):RGB=>({r:parseInt(hex.slice(1,3),16)/255,g:parseInt(hex.slice(3,5),16)/255,b:parseInt(hex.slice(5,7),16)/255});
const toHex=(rgb:RGB):string=>`#${[rgb.r,rgb.g,rgb.b].map(value=>Math.round(value*255).toString(16).padStart(2,'0')).join('').toUpperCase()}`;
const solid=(hex:string):SolidPaint=>({type:'SOLID',color:color(hex)});

/** Native, isolated component family. A failed build removes only its newly created page. */
export async function renderComponentFamily(spec:ComponentFamily,api:Pick<PluginAPI,'createPage'|'setCurrentPageAsync'|'createComponent'|'createText'|'combineAsVariants'|'createFrame'|'loadFontAsync'|'currentPage'>){
  const page=api.createPage();
  try{
    // A new page's parent is the document, so sibling names come from it without needing figma.root.
    page.name=uniquePageName(`AI Designer · ${spec.name}`,((page.parent as DocumentNode|null)?.children??[]).filter(p=>p!==page).map(p=>p.name));
    await page.loadAsync();
    await api.loadFontAsync({family:'Inter',style:'Regular'});
    const components:ComponentNode[]=[];
    for(const item of spec.variants){
      const component=api.createComponent();page.appendChild(component);
      component.name=`Style=${item.name}`;component.resize(spec.width,spec.height);component.fills=[solid(item.fill)];
      const key=component.addComponentProperty('Label','TEXT',item.label);
      const label=api.createText();component.appendChild(label);label.name='Label';label.characters=item.label;label.fontSize=16;label.fills=[solid(item.textColor)];label.x=16;label.y=Math.max(0,(spec.height-24)/2);label.resize(Math.max(1,spec.width-32),24);
      label.componentPropertyReferences={characters:key};components.push(component);
    }
    const set=api.combineAsVariants(components,page);set.name=spec.name;
    components.forEach((component,index)=>{component.x=index*(spec.width+24);component.y=0;});
    const review=api.createFrame();page.appendChild(review);review.name=`${spec.name} / instances`;review.resize(spec.variants.length*(spec.width+24),spec.height+48);review.x=0;review.y=spec.height+100;
    const instances=components.map((component,index)=>{const instance=component.createInstance();review.appendChild(instance);instance.x=index*(spec.width+24);instance.y=24;return instance;});
    // Read back actual native structure, including the property on each variant.
    const labelProperty=Object.entries(set.componentPropertyDefinitions).find(([,definition])=>definition.type==='TEXT');
    if(!labelProperty)throw new Error('COMPONENT_READBACK_FAILED: Component set has no Label text property.');
    const actual=components.map((component,index)=>{
      const label=component.children.find(node=>node.type==='TEXT');
      const fill=Array.isArray(component.fills)?component.fills.find((paint:Paint)=>paint.type==='SOLID'):undefined;
      const textFill=label?.type==='TEXT'?Array.isArray(label.fills)?label.fills.find((paint:Paint)=>paint.type==='SOLID'):undefined:undefined;
      if(!label||label.type!=='TEXT'||!fill||fill.type!=='SOLID'||!textFill||textFill.type!=='SOLID')throw new Error('COMPONENT_READBACK_FAILED: Native component property or paint is missing.');
      if(label.characters!==spec.variants[index]!.label||toHex(fill.color)!==spec.variants[index]!.fill.toUpperCase()||toHex(textFill.color)!==spec.variants[index]!.textColor.toUpperCase())throw new Error('COMPONENT_READBACK_FAILED: Native content differs from the requested variant.');
      return{id:component.id,name:component.name,label:label.characters,labelProperty:labelProperty[0],fill:toHex(fill.color),textColor:toHex(textFill.color),instanceId:instances[index]!.id};
    });
    await api.setCurrentPageAsync(page);
    return{familyVersion:'1.0',pageId:page.id,componentSetId:set.id,reviewFrameId:review.id,variants:actual};
  }catch(error){page.remove();throw error;}
}

/** Export only the portable family 1.0 subset; reject unsupported native properties. */
export function exportComponentFamily(set:ComponentSetNode):ComponentFamily {
  if(set.children.length<2||set.children.length>8)throw new Error('COMPONENT_EXPORT_UNSUPPORTED: Expected 2–8 variants.');
  const definitions=Object.entries(set.componentPropertyDefinitions);
  if(definitions.length!==2||definitions.filter(([,value])=>value.type==='TEXT').length!==1||definitions.filter(([,value])=>value.type==='VARIANT').length!==1)throw new Error('COMPONENT_EXPORT_UNSUPPORTED: Only Style and Label properties are portable.');
  const labelKey=definitions.find(([,value])=>value.type==='TEXT')![0];
  const variants=set.children.map(child=>{
    if(child.type!=='COMPONENT'||!/^Style=[A-Za-z0-9 _-]+$/.test(child.name))throw new Error('COMPONENT_EXPORT_UNSUPPORTED: Variant naming must use Style=Name.');
    const labelNodes=child.children.filter(node=>node.type==='TEXT');
    if(labelNodes.length!==1||child.children.length!==1)throw new Error('COMPONENT_EXPORT_UNSUPPORTED: Each variant needs exactly one text label.');
    const label=labelNodes[0]!;
    if(label.componentPropertyReferences?.characters!==labelKey)throw new Error('COMPONENT_EXPORT_UNSUPPORTED: Label is not bound to the text property.');
    const fills=Array.isArray(child.fills)?child.fills.filter(paint=>paint.visible!==false):[];
    const textFills=Array.isArray(label.fills)?label.fills.filter(paint=>paint.visible!==false):[];
    if(fills.length!==1||fills[0]?.type!=='SOLID'||textFills.length!==1||textFills[0]?.type!=='SOLID')throw new Error('COMPONENT_EXPORT_UNSUPPORTED: Only single solid fills are portable.');
    return{name:child.name.slice(6),label:label.characters,fill:toHex(fills[0].color),textColor:toHex(textFills[0].color)};
  });
  const first=set.children[0]!;
  if(set.children.some(child=>child.width!==first.width||child.height!==first.height))throw new Error('COMPONENT_EXPORT_UNSUPPORTED: Variant sizes differ.');
  return{familyVersion:'1.0',name:set.name,width:first.width,height:first.height,variants};
}
