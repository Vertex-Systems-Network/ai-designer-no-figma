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
    showUI:vi.fn(),currentPage:{selection},currentUser:{name:'Test Operator',photoUrl:null},mixed:Symbol('mixed'),
    ui,on:vi.fn(),notify:vi.fn(),loadFontAsync:vi.fn().mockResolvedValue(undefined),
  };
  Object.assign(fakeFigma,overrides);
  Object.assign(globalThis,{figma:fakeFigma,__html__:'<div id="root"></div>'});
  await import('./code');
  return {figma:fakeFigma,ui};
}

describe('Figma host patch behavior',()=>{
  afterEach(()=>{Reflect.deleteProperty(globalThis,'figma');Reflect.deleteProperty(globalThis,'__html__');vi.resetModules();});

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

  it('exports bound color variables and text styles discovered during asynchronous tree conversion',async()=>{
    const styledText={
      id:'styled-text',name:'Heading',type:'TEXT',x:12,y:16,width:220,height:40,rotation:0,opacity:1,
      characters:'Monthly revenue',fontName:{family:'Inter',style:'Semi Bold'},fontSize:24,
      lineHeight:{unit:'PIXELS',value:30},paragraphSpacing:0,letterSpacing:{unit:'PIXELS',value:0},
      textDecoration:'NONE',textCase:'ORIGINAL',textAlignVertical:'TOP',textAutoResize:'HEIGHT',textAlignHorizontal:'LEFT',
      fills:[{type:'SOLID',color:{r:0.1,g:0.2,b:0.3},opacity:1}],effects:[],constraints:{horizontal:'MIN',vertical:'MIN'},
      boundVariables:{fills:[{id:'color-variable'}]},getRangeTextStyleId:()=> 'text-style',
    } as unknown as MockHostNode;
    const frame={id:'styled-frame',name:'Finance',type:'FRAME',x:0,y:0,width:800,height:600,rotation:0,opacity:1,
      fills:[],effects:[],layoutMode:'NONE',layoutGrids:[],clipsContent:false,children:[styledText]} as unknown as MockHostNode;
    const {ui}=await loadHostWithSelection([frame],{
      variables:{
        getVariableByIdAsync:vi.fn().mockResolvedValue({name:'Ink/Primary',resolvedType:'COLOR',variableCollectionId:'collection',resolveForConsumer:()=>({value:{r:0.1,g:0.2,b:0.3}})}),
        getVariableCollectionByIdAsync:vi.fn().mockResolvedValue(null),
      },
      getStyleByIdAsync:vi.fn().mockResolvedValue({type:'TEXT',name:'AI Designer · Core / Heading',fontName:{family:'Inter',style:'Semi Bold'},fontSize:24,lineHeight:{unit:'PIXELS',value:30},paragraphSpacing:0,letterSpacing:{unit:'PIXELS',value:0},textDecoration:'NONE',textCase:'ORIGINAL'}),
      currentPage:{name:'Page 1',selection:[frame]},
    });
    await ui.onmessage?.({type:'export-selection'});
    const exported=ui.postMessage.mock.calls.find(([message])=>(message as {type?:string}).type==='export-result')?.[0] as {spec?:{designSystem?:{colors?:Array<{name:string}>;typography?:Array<{name:string}>};pages?:Array<{children?:Array<{children?:Array<{fillToken?:string;textStyleToken?:string}>}>}>}}|undefined;
    expect(exported?.spec?.designSystem?.colors).toEqual([expect.objectContaining({name:'Ink/Primary',color:'#1a334d'})]);
    expect(exported?.spec?.designSystem?.typography).toEqual([expect.objectContaining({name:'Heading'})]);
    expect(exported?.spec?.pages?.[0]?.children?.[0]?.children?.[0]).toEqual(expect.objectContaining({fillToken:'Ink/Primary',textStyleToken:'Heading'}));
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
