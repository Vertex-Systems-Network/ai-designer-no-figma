import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

const hostSource = readFileSync('src/plugin/code.ts', 'utf8');
const paintSource = readFileSync('src/plugin/paint.ts', 'utf8');
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8')) as { permissions?: string[] };

describe('Figma plugin host compatibility', () => {
  it('preserves frame/component overflow clipping across import and export',()=>{
    expect(hostSource).toContain('(node as FrameNode).clipsContent=spec.clipsContent??false');
    expect(hostSource).toContain('frame.clipsContent?{clipsContent:true}:{}');
  });
  it('preserves mixed corner radii and smoothing on frames, components, and rectangles',()=>{
    expect(hostSource).toContain('function applyCornerStyle');
    expect(hostSource).toContain('function exportCornerStyle');
    expect(hostSource).toContain('target.topLeftRadius=spec.cornerRadii.topLeft');
    expect(hostSource).toContain('target.cornerSmoothing=spec.cornerSmoothing');
  });
  it('applies and exports native layer rotation',()=>{
    expect(hostSource).toContain('if(spec.rotation!==undefined)node.rotation=spec.rotation');
    expect(hostSource).toContain('supported.rotation!==0?{rotation:supported.rotation}:{}');
  });
  it('preserves line stroke opacity and rejects lossy multiple strokes',()=>{
    expect(hostSource).toContain("assertSinglePortableStroke(node.name,visibleStrokes.length)");
    expect(hostSource).toContain("assertPortableBlendMode(node.name,'line stroke'");
    expect(hostSource).toContain("paint(spec.stroke ?? spec.fill ?? '#333333',spec.strokeOpacity??1)");
  });
  it('keeps browser networking and timer globals out of the Figma JSVM host', () => {
    expect(hostSource).not.toMatch(/\bfetch\s*\(/);
    expect(hostSource).not.toMatch(/\bnew\s+URL\s*\(/);
    expect(hostSource).not.toMatch(/\bAbortController\b|\bAbortSignal\b/);
    expect(hostSource).not.toMatch(/\bsetTimeout\s*\(|\bsetInterval\s*\(/);
  });

  it('asks Figma only for the signed-in operator identity permission', () => {
    expect(manifest.permissions).toContain('currentuser');
    expect(hostSource).toContain("type:'current-user'");
    expect(hostSource).toContain('figma.currentUser');
  });

  it('supports hiding the panel while keeping the plugin UI alive', () => {
    expect(hostSource).toContain("message.type==='hide-ui'");
    expect(hostSource).toContain('figma.ui.hide()');
    expect(hostSource).toContain("message.type==='bridge-job'");
  });

  it('imports and exports image crop transforms through the design specification',()=>{
    expect(hostSource).toContain("spec.scaleMode==='CROP'&&spec.imageTransform");
    expect(hostSource).toContain("item.scaleMode==='CROP'&&item.imageTransform");
    expect(hostSource).toContain('imageTransform:item.imageTransform');
  });
  it('imports and exports tiled image fill scaling factors',()=>{
    expect(hostSource).toContain("spec.scaleMode==='TILE'&&spec.scalingFactor!==undefined");
    expect(hostSource).toContain("item.scaleMode==='TILE'&&item.scalingFactor!==undefined");
    expect(hostSource).not.toContain('uses TILE scale mode, which is not supported');
  });

  it('exports one selected frame as a bounded visual preview and selects the first rendered frame', () => {
    expect(hostSource).toContain("operation.type==='capture-selection'");
    expect(hostSource).toContain("format:'JPG'");
    expect(hostSource).toContain('700 * 1024');
    expect(hostSource).toContain('figma.currentPage.selection = [firstFrame]');
  });

  it('renders native components, instances, vectors, gradients, and shadows', () => {
    expect(hostSource).toContain('figma.createComponent()');
    expect(hostSource).toContain('component.createInstance()');
    expect(hostSource).toContain('figma.createVector()');
    expect(hostSource).toContain('vector.vectorPaths=');
    expect(hostSource).toContain("type:'GRADIENT_LINEAR'");
    expect(paintSource).toContain("type:'DROP_SHADOW'");
  });

  it('renders and exports bounded solid, gradient and embedded image fill stacks',()=>{
    expect(hostSource).toContain('paints?.length)node.fills=buildPaintStack(paints,item=>figma.createImage');
    expect(hostSource).toContain('paints=await Promise.all(visible.map(item=>toStackItem');
    expect(hostSource).toContain("type:'image',mimeType,data:encodeBase64(bytes)");
    expect(hostSource).toContain("item.type==='GRADIENT_RADIAL'");
    expect(hostSource).toContain("type:'radial-gradient',gradient:toRadial(item)");
    expect(hostSource).toContain("item.type==='GRADIENT_ANGULAR'");
    expect(hostSource).toContain("item.type==='GRADIENT_DIAMOND'");
    expect(hostSource).toContain('combines a paint type unsupported by portable export');
  });


  it('imports and exports text case, decoration and letter spacing',()=>{
    expect(hostSource).toContain('text.letterSpacing=spec.letterSpacing');
    expect(hostSource).toContain('text.textAlignVertical=spec.textAlignVertical');
    expect(hostSource).toContain('text.textAutoResize=spec.textAutoResize');
    expect(hostSource).toContain('text.paragraphSpacing=spec.paragraphSpacing');
    expect(hostSource).toContain('text.textDecoration=spec.textDecoration');
    expect(hostSource).toContain('text.textCase=spec.textCase');
    expect(hostSource).toContain('style.letterSpacing=token.letterSpacing');
    expect(hostSource).toContain('style.textDecoration=token.textDecoration');
    expect(hostSource).toContain('style.textCase=token.textCase');
    expect(hostSource).toContain('style.paragraphSpacing=token.paragraphSpacing');
    expect(hostSource).toContain('textAlignVertical:node.textAlignVertical');
    expect(hostSource).toContain('textAutoResize:node.textAutoResize');
    expect(hostSource).toContain('has mixed character styling');
    expect(hostSource).toContain('letterSpacing:{unit:node.letterSpacing.unit,value:node.letterSpacing.value}');
  });

  it('renders solid rectangle/ellipse strokes and exports losslessly supported outline metadata',()=>{
    expect(hostSource).toContain('node.strokes=[paint(spec.stroke,spec.strokeOpacity??1)]');
    expect(hostSource).toContain("node.strokeAlign=spec.strokeAlign??'CENTER'");
    expect(hostSource).toContain('uses multiple strokes which schema 1.0 cannot preserve');
    expect(hostSource).toContain('strokeAlign:node.strokeAlign');
  });

  it('renders and exports bounded native drop-shadow stacks',()=>{
    expect(hostSource).toContain('buildShadowStack(shadows?.length?shadows:shadow?[shadow]:[])');
    expect(hostSource).toContain('else if(exported.length>1)shadows=exported');
    expect(hostSource).toContain('more than four effects');
  });
  it('renders and exports bounded inner-shadow and blur effects',()=>{
    expect(hostSource).toContain('buildEffectStack(effects)');
    expect(hostSource).toContain("effect.type==='INNER_SHADOW'?'inner-shadow':'drop-shadow'");
    expect(hostSource).toContain("effect.type==='BACKGROUND_BLUR'");
    expect(hostSource).toContain('more than four effects');
    expect(hostSource).toContain("effect.blurType==='PROGRESSIVE'");
    expect(hostSource).toContain("type:'progressive-background-blur'");
  });

  it('supports embedded images, responsive grids, native tokens/styles, and advanced export paths',()=>{
    expect(hostSource).toContain('figma.createImage(bytes)');
    expect(hostSource).toContain('frame.layoutGrids=makeLayoutGrids');
    expect(hostSource).toContain('applyConstraints(node,spec.constraints)');
    expect(hostSource).toContain('figma.variables.createVariableCollection');
    expect(hostSource).toContain('figma.createTextStyle()');
    expect(hostSource).toContain('setBoundVariableForPaint');
    expect(hostSource).toContain("type:'vector',path");
    expect(hostSource).toContain('getBytesAsync()');
  });
});


type MockHostNode={id:string;name:string;type:'FRAME'|'TEXT';x:number;y:number;width:number;height:number;rotation:number;children?:MockHostNode[];fontName?:{family:string;style:string};removed?:boolean;characters?:string;_characters?:string;throwAfterSet?:string};

function mockTextNode(id:string,name:string,initialText:string,throwAfterSet?:string):MockHostNode{
  let characters=initialText;
  let shouldThrow=Boolean(throwAfterSet);
  return {
    id,name,type:'TEXT',x:0,y:0,width:120,height:24,rotation:0,fontName:{family:'Inter',style:'Regular'},
    get characters(){return characters;},
    set characters(value:string){characters=value;if(shouldThrow&&value===throwAfterSet){shouldThrow=false;throw new Error('mock text write failed after mutation');}},
  };
}

async function loadHostWithSelection(selection:MockHostNode[],overrides:Record<string,unknown>={}){
  vi.resetModules();
  const ui:{postMessage:ReturnType<typeof vi.fn>;onmessage?:((message:unknown)=>Promise<void>);resize:ReturnType<typeof vi.fn>;hide:ReturnType<typeof vi.fn>}={postMessage:vi.fn(),resize:vi.fn(),hide:vi.fn()};
  const fakeFigma={
    showUI:vi.fn(),currentPage:{name:'Page 1',selection},currentUser:{name:'Test Operator',photoUrl:null},mixed:Symbol('mixed'),
    ui,on:vi.fn(),notify:vi.fn(),loadFontAsync:vi.fn().mockResolvedValue(undefined),
  };
  Object.assign(fakeFigma,overrides);
  Object.assign(globalThis,{figma:fakeFigma,__html__:'<div id="root"></div>'});
  await import('./code');
  return {figma:fakeFigma,ui};
}

describe('Figma host design-system discovery',()=>{
  afterEach(()=>{Reflect.deleteProperty(globalThis,'figma');Reflect.deleteProperty(globalThis,'__html__');vi.resetModules();});
  it('routes a read-only bridge job and preserves the selected node',async()=>{
    const selected=mockTextNode('selected','Selected','Keep me');
    const component={id:'component-1',name:'Primary button',type:'COMPONENT',x:0,y:0,width:120,height:40};
    const currentPage={id:'page-1',name:'Page',selection:[selected],children:[component]};
    const {ui}=await loadHostWithSelection([selected],{currentPage,
      variables:{getLocalVariablesAsync:vi.fn().mockResolvedValue([{id:'variable-1',name:'Brand',resolvedType:'COLOR',variableCollectionId:'collection-1',valuesByMode:{light:{r:0,g:0,b:0}}}])},
      getLocalTextStylesAsync:vi.fn().mockResolvedValue([]),getLocalPaintStylesAsync:vi.fn().mockResolvedValue([]),getLocalEffectStylesAsync:vi.fn().mockResolvedValue([]),
    });
    await ui.onmessage?.({type:'bridge-job',job:{jobId:'job-1',operationId:'op-1',sessionId:'session-1',agentLabel:'test',operation:{type:'inspect-design-system'},status:'running',createdAt:1,updatedAt:1}});
    expect(ui.postMessage).toHaveBeenCalledWith(expect.objectContaining({type:'bridge-job-result',jobId:'job-1',ok:true,result:expect.objectContaining({components:[expect.objectContaining({id:'component-1'})],variables:[expect.objectContaining({id:'variable-1'})]})}));
    expect(currentPage.selection).toEqual([selected]);
  });
});

describe('Figma host patch behavior',()=>{
  afterEach(()=>{Reflect.deleteProperty(globalThis,'figma');Reflect.deleteProperty(globalThis,'__html__');vi.resetModules();});

  it('loads fonts before bounds/rename/fill writes and undoes them completely (found live 2026-11-12)',async()=>{
    // Real Figma refuses text writes (characters, resize) until the node's font is loaded.
    const loaded=new Set<string>();
    const strictText=(id:string,name:string,text:string):MockHostNode=>{
      let characters=text;let width=248;const node={id,name,type:'TEXT',x:16,y:16,height:17,rotation:0,fontName:{family:'Inter',style:'Regular'},fills:[{type:'SOLID',color:{r:0,g:0,b:0}}] as unknown[],
        get width(){return width;},
        get characters(){return characters;},
        set characters(value:string){if(!loaded.has('Inter/Regular'))throw new Error('in set_characters: Cannot write to node with unloaded font "Inter Regular"');characters=value;},
        resize(w:number){if(!loaded.has('Inter/Regular'))throw new Error('in resize: Cannot write to node with unloaded font "Inter Regular"');width=w;},
      };return node as unknown as MockHostNode;};
    const label=strictText('label','Metric label','Monthly revenue');
    const change=strictText('change','Metric change','+12.4%');
    const card:MockHostNode={id:'card',name:'Card/Metric',type:'FRAME',x:0,y:0,width:280,height:121,rotation:0,children:[label,change]};
    const loadFontAsync=vi.fn(async(font:{family:string;style:string})=>{loaded.add(`${font.family}/${font.style}`);});
    const {ui}=await loadHostWithSelection([card],{loadFontAsync});
    await ui.onmessage?.({type:'apply-patch',patch:{operations:[{op:'set-bounds',targetId:'label',value:{x:16,y:16,width:200,height:17}},{op:'rename',targetId:'label',value:'Revenue label'},{op:'set-fill',targetId:'change',value:'#0B6E4F'}]}});
    expect(loadFontAsync).toHaveBeenCalled();
    expect(label.name).toBe('Revenue label');
    expect((label as unknown as {width:number}).width).toBe(200);
    loaded.clear(); // a later session: fonts are unloaded again before Undo
    await ui.onmessage?.({type:'undo-patch'});
    expect(label.name).toBe('Metric label');
    expect((label as unknown as {width:number}).width).toBe(248);
    expect((change as unknown as {fills:Array<{color:{r:number}}>}).fills[0]!.color.r).toBe(0);
    expect(ui.postMessage).toHaveBeenCalledWith(expect.objectContaining({type:'patch-result',ok:true,message:'The latest plugin patch was reverted.'}));
  });

  it('renames a text layer whose font is unavailable without loading fonts',async()=>{
    const title=mockTextNode('title','Title','Revenue');
    const root:MockHostNode={id:'root',name:'Card',type:'FRAME',x:0,y:0,width:280,height:121,rotation:0,children:[title]};
    const loadFontAsync=vi.fn().mockRejectedValue(new Error('font unavailable'));
    const {ui}=await loadHostWithSelection([root],{loadFontAsync});
    await ui.onmessage?.({type:'apply-patch',patch:{operations:[{op:'rename',targetId:'title',value:'Renamed'}]}});
    expect(title.name).toBe('Renamed');
    await ui.onmessage?.({type:'undo-patch'});
    expect(title.name).toBe('Title');
    expect(loadFontAsync).not.toHaveBeenCalled();
  });

  it('serializes a patch sent while an undo is still loading fonts',async()=>{
    const title=mockTextNode('title','Title','Revenue');
    const root:MockHostNode={id:'root',name:'Card',type:'FRAME',x:0,y:0,width:280,height:121,rotation:0,children:[title]};
    let release:()=>void=()=>{};
    const loadFontAsync=vi.fn().mockResolvedValueOnce(undefined).mockImplementationOnce(()=>new Promise<void>(resolve=>{release=resolve;})).mockResolvedValue(undefined);
    const {ui}=await loadHostWithSelection([root],{loadFontAsync});
    await ui.onmessage?.({type:'apply-patch',patch:{operations:[{op:'set-text',targetId:'title',value:'First'}]}});
    const undo=ui.onmessage?.({type:'undo-patch'});
    const second=ui.onmessage?.({type:'apply-patch',patch:{operations:[{op:'set-text',targetId:'title',value:'Second'}]}});
    await new Promise(resolve=>setTimeout(resolve,0));
    expect(title.characters).toBe('First'); // nothing interleaved while undo waits for fonts
    release();await undo;await second;
    expect(title.characters).toBe('Second');
    await ui.onmessage?.({type:'undo-patch'});
    expect(title.characters).toBe('Revenue');
  });

  it('persists UI settings in figma.clientStorage so pairing survives a plugin restart (found live)',async()=>{
    const store=new Map<string,unknown>([['adnf-bridge-token','a'.repeat(64)],['other-plugin-key','x']]);
    const clientStorage={keysAsync:vi.fn(async()=>[...store.keys()]),getAsync:vi.fn(async(key:string)=>store.get(key)),setAsync:vi.fn(async(key:string,value:unknown)=>{store.set(key,value);})};
    const {ui}=await loadHostWithSelection([],{clientStorage});
    await ui.onmessage?.({type:'storage-set',key:'adnf-bridge-instance',value:'instance-1'});
    await ui.onmessage?.({type:'storage-set',key:'not-ours',value:'ignored'});
    expect(store.get('adnf-bridge-instance')).toBe('instance-1');
    expect(store.has('not-ours')).toBe(false);
    await ui.onmessage?.({type:'storage-request'});
    expect(ui.postMessage).toHaveBeenCalledWith({type:'storage-snapshot',values:{'adnf-bridge-token':'a'.repeat(64),'adnf-bridge-instance':'instance-1'}});
  });

  it('treats clientStorage failures and empty values as best effort, never as a failed operation',async()=>{
    const store=new Map<string,unknown>([['adnf-bridge-token','t']]);
    const clientStorage={keysAsync:vi.fn(async()=>[...store.keys()]),getAsync:vi.fn(async(key:string)=>store.get(key)),
      setAsync:vi.fn(async()=>{throw 'Figma refused the value';}),deleteAsync:vi.fn(async(key:string)=>{store.delete(key);})};
    const {ui}=await loadHostWithSelection([],{clientStorage});
    await ui.onmessage?.({type:'storage-set',key:'adnf-history',value:[{a:1}]});
    clientStorage.getAsync.mockImplementationOnce(async()=>{throw 'unreadable';});
    store.set('adnf-theme','dark');
    await ui.onmessage?.({type:'storage-request'});
    expect(ui.postMessage).toHaveBeenCalledWith({type:'storage-snapshot',values:{'adnf-theme':'dark'}});
    await ui.onmessage?.({type:'storage-set',key:'adnf-bridge-token',value:''});
    expect(store.has('adnf-bridge-token')).toBe(false);
    expect(ui.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({type:'error'}));
  });

  it('applies only selected-tree edits, preserves siblings, and restores edits on undo',async()=>{
    const title=mockTextNode('title','Title','Revenue');
    const sibling=mockTextNode('sibling','Sibling','Untouched');
    const root:MockHostNode={id:'root',name:'Dashboard',type:'FRAME',x:0,y:0,width:800,height:600,rotation:0,children:[title,sibling]};
    const {ui}=await loadHostWithSelection([root]);
    await ui.onmessage?.({type:'apply-patch',patch:{operations:[{op:'rename',targetId:'title',value:'Updated title'},{op:'set-rotation',targetId:'title',value:22}]}});
    expect(title.name).toBe('Updated title');
    expect(title.rotation).toBe(22);
    expect(sibling.name).toBe('Sibling');
    expect(sibling.characters).toBe('Untouched');
    await ui.onmessage?.({type:'undo-patch'});
    expect(title.name).toBe('Title');
    expect(title.rotation).toBe(0);
    expect(sibling.name).toBe('Sibling');
    expect(sibling.characters).toBe('Untouched');
    expect(ui.postMessage).toHaveBeenCalledWith(expect.objectContaining({type:'patch-result',ok:true,message:'The latest plugin patch was reverted.'}));
  });

  it('exports a manually edited title with native pass-through node blend',async()=>{
    const title={...mockTextNode('title','Title','Edited in Figma'),blendMode:'PASS_THROUGH',opacity:1,fontSize:28,getRangeTextStyleId:()=>'',fills:[{type:'SOLID',color:{r:0.09,g:0.09,b:0.09},opacity:1,blendMode:'NORMAL'}],effects:[]} as unknown as MockHostNode;
    const frame={id:'test-card',name:'Test Card',type:'FRAME',x:0,y:0,width:480,height:280,rotation:0,opacity:1,blendMode:'PASS_THROUGH',fills:[],effects:[],layoutMode:'NONE',layoutGrids:[],children:[title]} as unknown as MockHostNode;
    const {ui}=await loadHostWithSelection([frame]);
    await ui.onmessage?.({type:'export-selection'});
    const result=ui.postMessage.mock.calls.find(([message])=>(message as {type?:string}).type==='export-result')?.[0] as {ok:boolean;spec?:{pages:Array<{children:Array<{children:Array<{text:string}>}>}>}}|undefined;
    expect(ui.postMessage.mock.calls.map(([message])=>message)).toEqual(expect.arrayContaining([expect.objectContaining({type:'export-result'})]));
    expect(result?.spec?.pages[0]?.children[0]?.children[0]?.text).toBe('Edited in Figma');
  });
  it('round-trips imported frame after a native text edit in the host',async()=>{
    let serial=0;
    const page={type:'PAGE',id:'new-page',name:'',children:[] as unknown[],async loadAsync(){},appendChild(node:unknown){this.children.push(node);},remove(){}};
    const createFrame=()=>({type:'FRAME',id:`frame-${++serial}`,name:'',x:0,y:0,width:0,height:0,rotation:0,opacity:1,blendMode:'PASS_THROUGH',children:[] as unknown[],fills:[] as unknown[],effects:[] as unknown[],layoutMode:'NONE',layoutGrids:[] as unknown[],clipsContent:false,appendChild(node:unknown){this.children.push(node);},resize(width:number,height:number){this.width=width;this.height=height;}});
    const createText=()=>({type:'TEXT',id:`text-${++serial}`,name:'',x:0,y:0,width:0,height:0,rotation:0,opacity:1,blendMode:'PASS_THROUGH',characters:'',fontName:{family:'Inter',style:'Regular'},fontSize:16,fills:[] as unknown[],effects:[] as unknown[],getRangeTextStyleId:()=>'',resize(width:number,height:number){this.width=width;this.height=height;}});
    const {ui,figma}=await loadHostWithSelection([],{
      createPage:()=>page,createFrame,createText,setCurrentPageAsync:vi.fn(),viewport:{scrollAndZoomIntoView:vi.fn()},
      variables:{getLocalVariableCollectionsAsync:vi.fn().mockResolvedValue([])},getLocalTextStylesAsync:vi.fn().mockResolvedValue([]),
    });
    const spec={schemaVersion:'1.0',name:'Smoke Test',pages:[{id:'page',name:'Smoke Test',children:[{type:'frame',id:'test-card',name:'Test Card',width:480,height:280,fill:'#F6F3EE',children:[{type:'text',id:'test-title',name:'Title',x:32,y:32,width:400,height:48,text:'Editable native design',fontSize:28,color:'#171717'}]}]}]};
    await ui.onmessage?.({type:'render',spec});
    const rendered=page.children[0] as {children:Array<{characters:string}>};
    expect(rendered.children[0]?.characters).toBe('Editable native design');
    rendered.children[0]!.characters='Edited in Figma';
    (figma.currentPage as {selection:unknown[];name:string}).selection=[page.children[0]];
    figma.currentPage.name='Smoke Test';
    await ui.onmessage?.({type:'export-selection'});
    const exported=ui.postMessage.mock.calls.find(([message])=>(message as {type?:string}).type==='export-result')?.[0] as {spec?:{pages:Array<{children:Array<{children:Array<{text:string}>}>}>}}|undefined;
    expect(exported?.spec?.pages[0]?.children[0]?.children[0]?.text).toBe('Edited in Figma');
  });
  it('exports bound color variables and text styles discovered during asynchronous tree conversion',async()=>{
    const styledText={
      id:'styled-text',name:'Heading',type:'TEXT',x:12,y:16,width:220,height:40,rotation:0,opacity:1,
      characters:'Monthly revenue',fontName:{family:'Inter',style:'Semi Bold'},fontSize:24,
      lineHeight:{unit:'PIXELS',value:30},paragraphSpacing:4,letterSpacing:{unit:'PERCENT',value:2},
      textDecoration:'UNDERLINE',textCase:'UPPER',textAlignVertical:'CENTER',textAutoResize:'TRUNCATE',textAlignHorizontal:'RIGHT',
      fills:[{type:'SOLID',color:{r:0.1,g:0.2,b:0.3},opacity:1}],effects:[],constraints:{horizontal:'MIN',vertical:'MIN'},
      boundVariables:{fills:[{id:'color-variable'}]},getRangeTextStyleId:()=> 'text-style',
    } as unknown as MockHostNode;
    const frame={id:'styled-frame',name:'Finance',type:'FRAME',x:4,y:8,width:800,height:600,rotation:15,opacity:1,
      fills:[],effects:[],layoutMode:'HORIZONTAL',itemSpacing:12,paddingTop:16,paddingRight:16,paddingBottom:16,paddingLeft:16,
      primaryAxisAlignItems:'CENTER',primaryAxisSizingMode:'AUTO',counterAxisSizingMode:'FIXED',layoutGrids:[
        {pattern:'GRID',sectionSize:8,visible:false},
        {pattern:'COLUMNS',sectionSize:72,gutterSize:16,count:12,offset:10,alignment:'STRETCH',visible:true},
        {pattern:'ROWS',gutterSize:8,count:6,offset:4,alignment:'CENTER',visible:false},
      ],clipsContent:true,children:[styledText]} as unknown as MockHostNode;
    const {ui}=await loadHostWithSelection([frame],{
      variables:{
        getVariableByIdAsync:vi.fn().mockResolvedValue({name:'Ink/Primary',resolvedType:'COLOR',variableCollectionId:'collection',resolveForConsumer:()=>({value:{r:0.1,g:0.2,b:0.3}})}),
        getVariableCollectionByIdAsync:vi.fn().mockResolvedValue(null),
      },
      getStyleByIdAsync:vi.fn().mockResolvedValue({type:'TEXT',name:'AI Designer · Core / Heading',fontName:{family:'Inter',style:'Semi Bold'},fontSize:24,lineHeight:{unit:'PIXELS',value:30},paragraphSpacing:4,letterSpacing:{unit:'PERCENT',value:2},textDecoration:'UNDERLINE',textCase:'UPPER'}),
      currentPage:{name:'Page 1',selection:[frame]},
    });
    await ui.onmessage?.({type:'export-selection'});
    const exported=ui.postMessage.mock.calls.find(([message])=>(message as {type?:string}).type==='export-result')?.[0] as {spec?:{schemaVersion:string;name:string;designSystem?:{colors?:Array<{name:string;color:string}>;typography?:Array<{name:string;fontFamily:string;fontSize:number;fontWeight:number;lineHeight:number;paragraphSpacing:number;letterSpacing:{unit:string;value:number};textDecoration:string;textCase:string}>};pages:Array<{id:string;name:string;children?:Array<{x:number;y:number;rotation:number;clipsContent:boolean;layout:{mode:string;gap:number;padding:number;alignment:string;primaryAxisSizing:string;counterAxisSizing:string};layoutGrids:Array<Record<string,unknown>>;children?:Array<{id:string;name:string;x:number;y:number;width:number;height:number;fillToken?:string;textStyleToken?:string;fontFamily:string;fontWeight:number;fontSize:number;lineHeight:number;paragraphSpacing:number;letterSpacing:{unit:string;value:number};textDecoration:string;textCase:string;textAlignVertical:string;textAutoResize:string;color:string;align:string;constraints:{horizontal:string;vertical:string}}>}>}>}}|undefined;
    const root=exported?.spec?.pages?.[0]?.children?.[0];
    expect(exported?.spec?.schemaVersion).toBe('1.0');
    expect(exported?.spec?.name).toBe('Finance');
    expect(exported?.spec?.pages[0]).toMatchObject({id:'export-page-styled-frame',name:'Page 1'});
    expect(exported?.spec?.designSystem?.colors).toEqual([expect.objectContaining({name:'Ink/Primary',color:'#1a334d'})]);
    expect(exported?.spec?.designSystem?.typography).toEqual([expect.objectContaining({name:'Heading',fontFamily:'Inter',fontSize:24,fontWeight:600,lineHeight:30,paragraphSpacing:4,letterSpacing:{unit:'PERCENT',value:2},textDecoration:'UNDERLINE',textCase:'UPPER'})]);
    expect(root).toEqual(expect.objectContaining({x:4,y:8,rotation:15,clipsContent:true,layout:{mode:'horizontal',gap:12,padding:16,alignment:'CENTER',primaryAxisSizing:'AUTO',counterAxisSizing:'FIXED'}}));
    expect(root?.layoutGrids).toEqual([
      {pattern:'GRID',sectionSize:8,visible:false},
      {pattern:'COLUMNS',sectionSize:72,gutterSize:16,count:12,offset:10,alignment:'STRETCH',visible:true},
      {pattern:'ROWS',gutterSize:8,count:6,offset:4,alignment:'CENTER',visible:false},
    ]);
    expect(root?.children?.[0]).toEqual(expect.objectContaining({id:'figma-styled-text',name:'Heading',x:12,y:16,width:220,height:40,fillToken:'Ink/Primary',textStyleToken:'Heading',fontFamily:'Inter',fontWeight:600,fontSize:24,lineHeight:30,paragraphSpacing:4,letterSpacing:{unit:'PERCENT',value:2},textDecoration:'UNDERLINE',textCase:'UPPER',textAlignVertical:'CENTER',textAutoResize:'TRUNCATE',color:'#1a334d',align:'RIGHT',constraints:{horizontal:'MIN',vertical:'MIN'}}));

    const lightText={id:'light-weight',name:'Light text',type:'TEXT',x:0,y:0,width:80,height:24,rotation:0,opacity:1,characters:'Light',fontName:{family:'Inter',style:'Light'},fontSize:16,
      lineHeight:{unit:'AUTO'},paragraphSpacing:0,letterSpacing:{unit:'PIXELS',value:0},textDecoration:'NONE',textCase:'ORIGINAL',textAlignVertical:'TOP',textAutoResize:'HEIGHT',textAlignHorizontal:'LEFT',fills:[],effects:[],getRangeTextStyleId:()=>null} as unknown as MockHostNode;
    const lightHost=await loadHostWithSelection([lightText]);
    await lightHost.ui.onmessage?.({type:'export-selection'});
    const lightSpec=lightHost.ui.postMessage.mock.calls.find(([message])=>(message as {type?:string}).type==='export-result')?.[0] as {spec?:{pages:Array<{children:Array<{fontWeight?:number}>}>}}|undefined;
    expect(lightSpec?.spec?.pages[0]?.children[0]?.fontWeight).toBe(300);
  });

  it('exports editable vector paths without flattening them into images',async()=>{
    const vector={id:'vector-1',name:'Arrow mark',type:'VECTOR',x:3,y:4,width:24,height:18,rotation:0,opacity:1,vectorPaths:[{data:'M0 0 L24 9 L0 18 Z'}]} as unknown as MockHostNode;
    const {ui}=await loadHostWithSelection([vector]);
    await ui.onmessage?.({type:'export-selection'});
    const exported=ui.postMessage.mock.calls.find(([message])=>(message as {type?:string}).type==='export-result')?.[0] as {spec?:{pages:Array<{children:Array<{type:string;path?:string}>}>}}|undefined;
    expect(exported?.spec?.pages[0]?.children[0]).toMatchObject({type:'vector',path:'M0 0 L24 9 L0 18 Z'});

    const compound={...vector,id:'compound-vector',vectorPaths:[{data:'M0 0 L24 9 L0 18 Z'},{data:'M8 5 L16 9 L8 13 Z'}]} as unknown as MockHostNode;
    const compoundHost=await loadHostWithSelection([compound]);
    await compoundHost.ui.onmessage?.({type:'export-selection'});
    expect(compoundHost.ui.postMessage).toHaveBeenCalledWith(expect.objectContaining({type:'error',message:expect.stringMatching(/2 editable paths.*supports exactly one path/)}));
  });

  it('rejects text formatting and token combinations that schema 1.0 cannot represent',async()=>{
    const mixed=Symbol('mixed');
    const mixedFont=mockTextNode('mixed-font','Mixed font','Text');
    mixedFont.fontName=mixed as unknown as {family:string;style:string};
    const fontHost=await loadHostWithSelection([mixedFont],{mixed});
    await fontHost.ui.onmessage?.({type:'export-selection'});
    expect(fontHost.ui.postMessage).toHaveBeenCalledWith(expect.objectContaining({type:'error',message:expect.stringMatching(/mixed font or line-height formatting/)}));

    const mixedLine=mockTextNode('mixed-line','Mixed line height','Text') as MockHostNode&{lineHeight?:unknown};
    mixedLine.lineHeight=mixed;
    const lineHost=await loadHostWithSelection([mixedLine],{mixed});
    await lineHost.ui.onmessage?.({type:'export-selection'});
    expect(lineHost.ui.postMessage).toHaveBeenCalledWith(expect.objectContaining({type:'error',message:expect.stringMatching(/mixed font or line-height formatting/)}));

    const mixedTokens=mockTextNode('mixed-token','Mixed token colors','Text') as MockHostNode&{boundVariables?:unknown};
    mixedTokens.boundVariables={textRangeFills:[[{id:'color-one'}],[{id:'color-two'}]]};
    const tokenHost=await loadHostWithSelection([mixedTokens]);
    await tokenHost.ui.onmessage?.({type:'export-selection'});
    expect(tokenHost.ui.postMessage).toHaveBeenCalledWith(expect.objectContaining({type:'error',message:expect.stringMatching(/multiple bound color variables/)}));
  });

  it('exports an instance with its detached main component definition and stable reference',async()=>{
    const component={id:'component-1',name:'Button / Primary',type:'COMPONENT',x:0,y:0,width:120,height:40,rotation:0,opacity:1,fills:[],effects:[],layoutMode:'NONE',layoutGrids:[],clipsContent:false,children:[]} as unknown as MockHostNode;
    const instance={id:'instance-1',name:'Submit button',type:'INSTANCE',x:20,y:30,width:120,height:40,rotation:0,opacity:1,fills:[],effects:[],scaleFactor:1,overrides:[],async getMainComponentAsync(){return component;}} as unknown as MockHostNode;
    const {ui}=await loadHostWithSelection([instance]);
    await ui.onmessage?.({type:'export-selection'});
    const exported=ui.postMessage.mock.calls.find(([message])=>(message as {type?:string}).type==='export-result')?.[0] as {spec?:{pages:Array<{children:Array<{type:string;id:string;componentRef?:string}>}>}}|undefined;
    expect(exported?.spec?.pages[0]?.children).toEqual([
      expect.objectContaining({type:'component',id:'figma-component-1',name:'Button / Primary'}),
      expect.objectContaining({type:'instance',id:'figma-instance-1',componentRef:'figma-component-1'}),
    ]);

    const overridden={...instance,id:'overridden-instance',overrides:[{id:'child-id',overriddenFields:['characters']}]} as unknown as MockHostNode;
    const overrideHost=await loadHostWithSelection([overridden]);
    await overrideHost.ui.onmessage?.({type:'export-selection'});
    expect(overrideHost.ui.postMessage).toHaveBeenCalledWith(expect.objectContaining({type:'error',message:expect.stringMatching(/component overrides that schema 1.0 cannot preserve/)}));

    const scaled={...instance,id:'scaled-instance',scaleFactor:1.25} as unknown as MockHostNode;
    const scaleHost=await loadHostWithSelection([scaled]);
    await scaleHost.ui.onmessage?.({type:'export-selection'});
    expect(scaleHost.ui.postMessage).toHaveBeenCalledWith(expect.objectContaining({type:'error',message:expect.stringMatching(/scale-tool factor that schema 1.0 cannot preserve/)}));
  });

  it('exports embedded raster paint bytes and crop metadata, and rejects unsupported effects',async()=>{
    const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==','base64');
    const imageNode={id:'image-1',name:'Avatar',type:'RECTANGLE',x:0,y:0,width:80,height:80,rotation:0,opacity:1,
      fills:[{type:'IMAGE',imageHash:'image-hash',scaleMode:'CROP',imageTransform:[[0.8,0,0.1],[0,0.8,-0.1]],opacity:1,visible:true,blendMode:'NORMAL'}],
      strokes:[],strokeWeight:0,strokeAlign:'CENTER',topLeftRadius:0,topRightRadius:0,bottomRightRadius:0,bottomLeftRadius:0,cornerSmoothing:0} as unknown as MockHostNode;
    const {figma,ui}=await loadHostWithSelection([imageNode],{getImageByHash:vi.fn(()=>({getBytesAsync:async()=>new Uint8Array(png)}))});
    await ui.onmessage?.({type:'export-selection'});
    const exported=ui.postMessage.mock.calls.find(([message])=>(message as {type?:string}).type==='export-result')?.[0] as {spec?:{pages:Array<{children:Array<{type:string;mimeType?:string;data?:string;scaleMode?:string;imageTransform?:number[][]}>}>}}|undefined;
    expect(exported?.spec?.pages[0]?.children[0]).toMatchObject({type:'image',mimeType:'image/png',data:png.toString('base64'),scaleMode:'CROP',imageTransform:[[0.8,0,0.1],[0,0.8,-0.1]]});
    expect((figma as unknown as {getImageByHash:ReturnType<typeof vi.fn>}).getImageByHash).toHaveBeenCalledWith('image-hash');

    const decoratedImage={...imageNode,id:'decorated-image',topLeftRadius:12,topRightRadius:12,bottomRightRadius:12,bottomLeftRadius:12,cornerSmoothing:0.25,
      strokes:[{type:'SOLID',color:{r:0.1,g:0.2,b:0.3},opacity:0.6,visible:true,blendMode:'NORMAL'}],strokeWeight:2,strokeAlign:'INSIDE'} as unknown as MockHostNode;
    const decorated=await loadHostWithSelection([decoratedImage],{getImageByHash:vi.fn(()=>({getBytesAsync:async()=>new Uint8Array(png)}))});
    await decorated.ui.onmessage?.({type:'export-selection'});
    const decoratedSpec=decorated.ui.postMessage.mock.calls.find(([message])=>(message as {type?:string}).type==='export-result')?.[0] as {spec?:{pages:Array<{children:Array<{type:string;radius?:number;cornerSmoothing?:number;stroke?:string;strokeOpacity?:number;strokeWidth?:number;strokeAlign?:string;paints?:Array<{type:string;mimeType?:string}>}>}>}}|undefined;
    expect(decoratedSpec?.spec?.pages[0]?.children[0]).toMatchObject({type:'rectangle',radius:12,cornerSmoothing:0.25,stroke:'#1a334d',strokeOpacity:0.6,strokeWidth:2,strokeAlign:'INSIDE',paints:[{type:'image',mimeType:'image/png'}]});

    const tiledImage={...imageNode,id:'tiled-image',fills:[{type:'IMAGE',imageHash:'image-hash',scaleMode:'TILE',scalingFactor:1.75,opacity:1,visible:true,blendMode:'NORMAL'}]} as unknown as MockHostNode;
    const tiled=await loadHostWithSelection([tiledImage],{getImageByHash:vi.fn(()=>({getBytesAsync:async()=>new Uint8Array(png)}))});
    await tiled.ui.onmessage?.({type:'export-selection'});
    const tiledSpec=tiled.ui.postMessage.mock.calls.find(([message])=>(message as {type?:string}).type==='export-result')?.[0] as {spec?:{pages:Array<{children:Array<{type:string;scaleMode?:string;scalingFactor?:number}>}>}}|undefined;
    expect(tiledSpec?.spec?.pages[0]?.children[0]).toMatchObject({type:'image',scaleMode:'TILE',scalingFactor:1.75});

    const paintNode={...imageNode,id:'painted-card',fills:[{type:'GRADIENT_LINEAR',gradientTransform:[[1,0,0],[0,1,0]],gradientStops:[
      {position:0,color:{r:0,g:0,b:0,a:1}},{position:1,color:{r:0.05,g:0.5,b:0.3,a:0.6}},
    ],opacity:0.8,visible:true,blendMode:'NORMAL'}],effects:[{type:'DROP_SHADOW',color:{r:0,g:0,b:0,a:0.25},offset:{x:0,y:4},radius:8,spread:1,visible:true,blendMode:'NORMAL'}]} as unknown as MockHostNode;
    const painted=await loadHostWithSelection([paintNode]);
    await painted.ui.onmessage?.({type:'export-selection'});
    const paintedSpec=painted.ui.postMessage.mock.calls.find(([message])=>(message as {type?:string}).type==='export-result')?.[0] as {spec?:{pages:Array<{children:Array<{paints?:Array<{type:string;opacity?:number}>;shadow?:{blur:number;spread:number;offsetY:number}}>}>}}|undefined;
    expect(paintedSpec?.spec?.pages[0]?.children[0]).toMatchObject({paints:[{type:'linear-gradient',opacity:0.8}],shadow:{blur:8,spread:1,offsetY:4}});

    const shiftedTransform:[[number,number,number],[number,number,number]]=[[1,0,0.2],[0,1,0.1]];
    const shiftedGradient={...imageNode,id:'shifted-gradient',fills:[{type:'GRADIENT_LINEAR',gradientTransform:shiftedTransform,gradientStops:[
      {position:0,color:{r:0,g:0,b:0,a:1}},{position:1,color:{r:1,g:1,b:1,a:1}},
    ],opacity:1,visible:true,blendMode:'NORMAL'}],effects:[]} as unknown as MockHostNode;
    const shifted=await loadHostWithSelection([shiftedGradient]);
    await shifted.ui.onmessage?.({type:'export-selection'});
    const shiftedSpec=shifted.ui.postMessage.mock.calls.find(([message])=>(message as {type?:string}).type==='export-result')?.[0] as {spec?:{pages:Array<{children:Array<{gradient?:{direction:string;transform:number[][]}}>}>}}|undefined;
    expect(shiftedSpec?.spec?.pages[0]?.children[0]?.gradient).toMatchObject({direction:'horizontal',transform:shiftedTransform});

    const unsupported={...imageNode,id:'unsupported-effects',fills:[],effects:[{type:'NOISE',visible:true}]} as unknown as MockHostNode;
    const second=await loadHostWithSelection([unsupported]);
    await second.ui.onmessage?.({type:'export-selection'});
    expect(second.ui.postMessage).toHaveBeenCalledWith(expect.objectContaining({type:'error',message:expect.stringMatching(/unsupported effect type.*cannot be exported losslessly/)}));

    const invalidLayer=await loadHostWithSelection([{...imageNode,id:'star-layer',type:'STAR',fills:[],strokes:[]} as unknown as MockHostNode]);
    await invalidLayer.ui.onmessage?.({type:'export-selection'});
    expect(invalidLayer.ui.postMessage).toHaveBeenCalledWith(expect.objectContaining({type:'error',message:expect.stringMatching(/STAR.*cannot be represented in schema 1.0/)}));

    const multiStroke={...imageNode,id:'multi-stroke',fills:[],strokes:[
      {type:'SOLID',color:{r:0,g:0,b:0},opacity:1,visible:true,blendMode:'NORMAL'},
      {type:'SOLID',color:{r:1,g:1,b:1},opacity:1,visible:true,blendMode:'NORMAL'},
    ]} as unknown as MockHostNode;
    const multi=await loadHostWithSelection([multiStroke]);
    await multi.ui.onmessage?.({type:'export-selection'});
    expect(multi.ui.postMessage).toHaveBeenCalledWith(expect.objectContaining({type:'error',message:expect.stringMatching(/multiple strokes which schema 1.0 cannot preserve/)}));

    const framedWithStroke={id:'frame-stroke',name:'Outlined frame',type:'FRAME',x:0,y:0,width:100,height:100,rotation:0,opacity:1,
      fills:[],effects:[],layoutMode:'NONE',layoutGrids:[],clipsContent:false,children:[],strokes:[{type:'SOLID',color:{r:0,g:0,b:0},opacity:1,visible:true,blendMode:'NORMAL'}]} as unknown as MockHostNode;
    const frameHost=await loadHostWithSelection([framedWithStroke]);
    await frameHost.ui.onmessage?.({type:'export-selection'});
    expect(frameHost.ui.postMessage).toHaveBeenCalledWith(expect.objectContaining({type:'error',message:expect.stringMatching(/visible strokes.*cannot preserve for frame layers/)}));
  });

  it('rolls back every selected target after a mid-patch Figma mutation fails',async()=>{
    const first=mockTextNode('first','First','Original first');
    const second=mockTextNode('second','Second','Original second','Trigger failure');
    const sibling=mockTextNode('sibling','Sibling','Keep as-is');
    const root:MockHostNode={id:'root',name:'Canvas',type:'FRAME',x:0,y:0,width:800,height:600,rotation:0,children:[first,second,sibling]};
    const {ui}=await loadHostWithSelection([root]);
    await ui.onmessage?.({type:'apply-patch',patch:{operations:[{op:'set-text',targetId:'first',value:'Temporary mutation'},{op:'set-text',targetId:'second',value:'Trigger failure'}]}});
    expect(first.characters).toBe('Original first');
    expect(second.characters).toBe('Original second');
    expect(sibling.characters).toBe('Keep as-is');
    expect(ui.postMessage).toHaveBeenCalledWith(expect.objectContaining({type:'error',code:'PLUGIN_OPERATION_FAILED',message:'mock text write failed after mutation'}));
    await expect(ui.onmessage?.({type:'undo-patch'})).resolves.toBeUndefined();
    expect(ui.postMessage).toHaveBeenCalledWith(expect.objectContaining({type:'error',message:'There is no plugin patch checkpoint to revert in this session.'}));
  });

  it('removes every partially created page when a later render page fails',async()=>{
    const current=mockTextNode('current','Current','Keep current document');
    const root:MockHostNode={id:'root',name:'Existing',type:'FRAME',x:0,y:0,width:800,height:600,rotation:0,children:[current]};
    const createdPages:Array<{removed:boolean;children:unknown[]}> = [];
    const createdFrames:unknown[]=[];
    const createPage=()=>{
      const page={type:'PAGE',id:`page-${createdPages.length}`,name:'',children:[] as unknown[],removed:false,async loadAsync(){},appendChild(node:unknown){this.children.push(node);},remove(){this.removed=true;}};
      createdPages.push(page);return page;
    };
    const createFrame=()=>{
      const frame={type:'FRAME',id:`frame-${createdFrames.length}`,name:'',x:0,y:0,width:0,height:0,rotation:0,opacity:1,children:[] as unknown[],fills:[] as unknown[],effects:[] as unknown[],layoutGrids:[] as unknown[],appendChild(node:unknown){this.children.push(node);},resize(width:number,height:number){this.width=width;this.height=height;}};
      createdFrames.push(frame);return frame;
    };
    const setCurrentPageAsync=vi.fn();
    const {ui}=await loadHostWithSelection([root],{
      createPage,createFrame,setCurrentPageAsync,
      loadFontAsync:vi.fn().mockRejectedValue(new Error('font missing')),
    });
    const spec={schemaVersion:'1.0',name:'Rollback test',pages:[
      {id:'page-a',name:'First',children:[{type:'frame',id:'frame-a',name:'Temporary frame',width:100,height:100,children:[]}]},
      {id:'page-b',name:'Second',children:[{type:'text',id:'text-b',name:'Missing font text',width:100,height:24,text:'Will fail',fontFamily:'Unavailable Font'}]},
    ]};
    await ui.onmessage?.({type:'render',spec,fontFallback:'Unavailable Font'});
    expect(createdPages).toHaveLength(2);
    expect(createdPages.every(page=>page.removed)).toBe(true);
    expect(createdFrames).toHaveLength(1);
    expect(root.children).toEqual([current]);
    expect(setCurrentPageAsync).not.toHaveBeenCalled();
    expect(ui.postMessage).toHaveBeenCalledWith(expect.objectContaining({type:'error',code:'PLUGIN_OPERATION_FAILED',message:'No supported font could be loaded. Install Inter or choose an available fallback font.'}));
  });
});
