Warning: truncated output (original token count: 16429)
Total output lines: 716

import { MAX_DEPTH, MAX_NODES, MAX_EMBEDDED_IMAGE_BYTES, validateDesignSpec, type ConstraintsSpec, type DesignNodeSpec, type DesignSpec, type EffectSpec, type GradientSpec, type GridSpec, type LayoutSpec, type PaintStackItemSpec, type RadialGradientSpec, type ShadowSpec } from '../shared/spec';
import type { EditPatch, HostToUi, UiToHost } from '../shared/protocol';
import type { BridgeJob, BridgeOperation } from '../shared/bridge-contract';
import { MAX_RASTER_BYTES, MCP_ASSET_CHUNK_BYTES, sanitizeSvg, validateRasterAsset } from '../shared/assets';
import { verifyAssetReadback } from '../shared/asset-readback';
import { sha256 } from '../shared/sha256';
import { decodeBase64, encodeBase64 } from '../shared/base64';
import { MAX_PATCH_IMAGE_BYTES } from '../shared/edit-patch';
import { fromFigmaLayoutMode, fromFigmaPrimaryAxisAlignment, toFigmaLayoutMode, toFigmaPrimaryAxisAlignment } from './compatibility';
import { assertPortableBlendMode, assertSinglePortableStroke } from './export-compat';
import { buildEffectStack, buildPaintStack, buildShadowStack } from './paint';

figma.showUI(__html__, { width: 440, height: 720, themeColors: true });
let cancelActiveRender: (() => void) | undefined;
// Plugin data APIs require a registered manifest ID. Keep spec IDs in memory
// for this plugin session and fall back to native Figma node IDs otherwise.
const logicalIds = new Map<string, string>();
type PatchSnapshot = { target: SceneNode; name: string; fills: readonly Paint[] | PluginAPI['mixed'] | undefined; text: string | undefined; x: number | undefined; y: number | undefined; width: number | undefined; height: number | undefined; rotation?:number; mainComponent?:ComponentNode; componentProperties?:Record<string,string|boolean>; layout?:{mode:FrameNode['layoutMode'];gap:number;paddingTop:number;paddingRight:number;paddingBottom:number;paddingLeft:number;alignment:FrameNode['primaryAxisAlignItems']} };
const patchCheckpoints: PatchSnapshot[][] = [];
let bridgeSessionId = '';
type PendingImageTransfer={name:string;mimeType:'image/png'|'image/jpeg'|'image/gif';totalBytes:number;sha256:string;chunkCount:number;bytes:Uint8Array;receivedBytes:number;updatedAt:number};
const pendingImageTransfers=new Map<string,PendingImageTransfer>();

function rgb(hex: string): RGB {
  const value = hex.replace('#', '');
  return { r: parseInt(value.slice(0, 2), 16) / 255, g: parseInt(value.slice(2, 4), 16) / 255, b: parseInt(value.slice(4, 6), 16) / 255 };
}
type CornerStyleSpec={radius?:number;cornerRadii?:{topLeft:number;topRight:number;bottomRight:number;bottomLeft:number};cornerSmoothing?:number};
function applyCornerStyle(node:SceneNode,spec:CornerStyleSpec):void{
  const target=node as SceneNode&{cornerRadius?:number|PluginAPI['mixed'];cornerSmoothing?:number;topLeftRadius?:number;topRightRadius?:number;bottomRightRadius?:number;bottomLeftRadius?:number};
  if(spec.radius!==undefined&&'cornerRadius' in node)target.cornerRadius=spec.radius;
  if(spec.cornerRadii&&target.topLeftRadius!==undefined&&target.topRightRadius!==undefined&&target.bottomRightRadius!==undefined&&target.bottomLeftRadius!==undefined){target.topLeftRadius=spec.cornerRadii.topLeft;target.topRightRadius=spec.cornerRadii.topRight;target.bottomRightRadius=spec.cornerRadii.bottomRight;target.bottomLeftRadius=spec.cornerRadii.bottomLeft;}
  if(spec.cornerSmoothing!==undefined&&target.cornerSmoothing!==undefined)target.cornerSmoothing=spec.cornerSmoothing;
}
function exportCornerStyle(node:SceneNode):CornerStyleSpec{
  const target=node as SceneNode&{cornerRadius?:number|PluginAPI['mixed'];cornerSmoothing?:number;topLeftRadius?:number;topRightRadius?:number;bottomRightRadius?:number;bottomLeftRadius?:number};
  const result:CornerStyleSpec={};
  if(typeof target.topLeftRadius==='number'&&typeof target.topRightRadius==='number'&&typeof target.bottomRightRadius==='number'&&typeof target.bottomLeftRadius==='number'){const topLeft=target.topLeftRadius,topRight=target.topRightRadius,bottomRight=target.bottomRightRadius,bottomLeft=target.bottomLeftRadius;if(topLeft===topRight&&topRight===bottomRight&&bottomRight===bottomLeft)result.radius=topLeft;else result.cornerRadii={topLeft,topRight,bottomRight,bottomLeft};}
  else if(typeof target.cornerRadius==='number')result.radius=target.cornerRadius;
  if(typeof target.cornerSmoothing==='number'&&target.cornerSmoothing!==0)result.cornerSmoothing=target.cornerSmoothing;
  return result;
}
function paint(hex: string, opacity=1): SolidPaint { return { type: 'SOLID', color: rgb(hex), opacity }; }

type RenderControl = { cancelled: boolean; nodes: number; components: Map<string,ComponentNode>; colors: Map<string,{variable:Variable;color:string}>; textStyles: Map<string,TextStyle> };
function gradientPaint(spec:GradientSpec,opacity=1):GradientPaint {
  const transform:Transform = spec.transform??(spec.direction==='horizontal' ? [[1,0,0],[0,1,0]] : [[0,-1,1],[1,0,0]]);
  return {type:'GRADIENT_LINEAR',gradientTransform:transform,gradientStops:spec.stops.map(stop=>({position:stop.position,color:{...rgb(stop.color),a:stop.opacity??1}})),visible:true,opacity,blendMode:'NORMAL'};
}
function applyNodePaint(node:SceneNode,fill?:string,gradient?:GradientSpec,shadow?:ShadowSpec,paints?:PaintStackItemSpec[],shadows?:ShadowSpec[],effects?:EffectSpec[]):void {
  if('fills' in node){if(paints?.length)node.fills=buildPaintStack(paints,item=>figma.createImage(decodeBase64(item.data,MAX_EMBEDDED_IMAGE_BYTES)).hash);else if(gradient)node.fills=[gradientPaint(gradient)];else if(fill)node.fills=[paint(fill)];}
  if('effects' in node){const effectSpecs=effects?.length?buildEffectStack(effects):buildShadowStack(shadows?.length?shadows:shadow?[shadow]:[]);if(effectSpecs.length)node.effects=effectSpecs;}
}
function applyLayout(frame:FrameNode,layout:LayoutSpec|undefined):void {
  if(!layout||layout.mode==='none')return;
  frame.layoutMode=toFigmaLayoutMode(layout.mode);
  frame.itemSpacing=layout.gap??0;
  frame.paddingTop=frame.paddingRight=frame.paddingBottom=frame.paddingLeft=layout.padding??0;
  frame.primaryAxisAlignItems=toFigmaPrimaryAxisAlignment(layout.alignment);
  frame.primaryAxisSizingMode=layout.primaryAxisSizing??'FIXED';
  frame.counterAxisSizingMode=layout.counterAxisSizing??'FIXED';
}
function applyConstraints(node:SceneNode,constraints:ConstraintsSpec|undefined):void {
  if(constraints&&'constraints' in node)node.constraints=constraints;
}
function makeLayoutGrids(specs:GridSpec[]|undefined):LayoutGrid[]{
  return (specs??[]).map((grid)=>grid.pattern==='GRID'?{pattern:'GRID',sectionSize:grid.sectionSize,visible:grid.visible??true}:{pattern:grid.pattern,...(grid.sectionSize!==undefined?{sectionSize:grid.sectionSize}:{}),gutterSize:grid.gutterSize,count:grid.count,offset:grid.offset??0,alignment:grid.alignment??'STRETCH',visible:grid.visible??true});
}
async function prepareDesignSystem(spec:DesignSpec,control:RenderControl,fontFallback:string):Promise<void>{
  const system=spec.designSystem;if(!system)return;
  const collectionName=`AI Designer · ${(system.name??spec.name).slice(0,100)}`;
  const collections=await figma.variables.getLocalVariableCollectionsAsync();
  const collection=collections.find(item=>item.name===collectionName)??figma.variables.createVariableCollection(collectionName);
  const modeId=collection.defaultModeId;
  const existingVariables=await figma.variables.getLocalVariablesAsync('COLOR');
  for(const token of system.colors??[]){
    let variable=existingVariables.find(item=>item.variableCollectionId===collection.id&&item.name===token.name);
    if(!variable)variable=figma.variables.createVariable(token.name,collection,'COLOR');
    variable.setValueForMode(modeId,{...rgb(token.color),a:1});control.colors.set(token.name,{variable,color:token.color});
  }
  const existingStyles=await figma.getLocalTextStylesAsync();
  for(const token of system.typography??[]){
    const styleName=`${collectionName} / ${token.name}`;
    const style=existingStyles.find(item=>item.name===styleName)??figma.createTextStyle();
    const font={family:token.fontFamily||fontFallback,style:fontStyle(token.fontWeight)};
    try{await figma.loadFontAsync(font);style.fontName=font;}catch{await figma.loadFontAsync({family:fontFallback,style:'Regular'});style.fontName={family:fontFallback,style:'Regular'};}
    style.name=styleName;style.fontSize=token.fontSize;if(token.paragraphSpacing!==undefined)style.paragraphSpacing=token.paragraphSpacing;style.lineHeight=token.lineHeight?{value:token.lineHeight,unit:'PIXELS'}:{unit:'AUTO'};if(token.letterSpacing)style.letterSpacing=token.letterSpacing;if(token.textDecoration)style.textDecoration=token.textDecoration;if(token.textCase)style.textCase=token.textCase;control.textStyles.set(token.name,style);
  }
}
function bindToken(node:SceneNode,tokenName:string|undefined,control:RenderControl):void{
  if(!tokenName)return;const token=control.colors.get(tokenName);if(!token)throw new Error(`COLOR_TOKEN_NOT_FOUND: Unknown design-system color token "${tokenName}".`);
  const boundPaint=figma.variables.setBoundVariableForPaint(paint(token.color),'color',token.variable);
  const bindInStack=(current:readonly Paint[]|PluginAPI['mixed']):Paint[]=>{const stack=current===figma.mixed?[]:[...current];const index=stack.findIndex(item=>item.type==='SOLID');if(index<0)stack.unshift(boundPaint);else stack[index]=boundPaint;return stack;};
  if(node.type==='TEXT'){const current=node.characters.length?node.getRangeFills(0,node.characters.length):[];node.setRangeFills(0,node.characters.length,bindInStack(current));}
  else if('fills' in node)node.fills=bindInStack(node.fills);
  else throw new Error(`COLOR_TOKEN_UNSUPPORTED: Layer "${node.name}" cannot bind a fill variable.`);
}
async function renderNode(spec: DesignNodeSpec, parent: BaseNode & ChildrenMixin, control: RenderControl, fontFallback: string): Promise<SceneNode> {
  control.nodes += 1;
  if (control.nodes % 32 === 0) await Promise.resolve();
  if (control.cancelled) throw new Error('RENDER_CANCELLED: Rendering was cancelled.');
  let node: SceneNode;
  if (spec.type === 'text') {
    const requestedFont = { family: spec.fontFamily || fontFallback, style: fontStyle(spec.fontWeight ?? 400) };
    let loadedFont = requestedFont;
    const candidates = [requestedFont, { family: fontFallback, style: 'Regular' }, { family: 'Inter', style: 'Regular' }];
    let loaded = false;
    for (const candidate of candidates) {
      try { await figma.loadFontAsync(candidate); loadedFont = candidate; loaded = true; break; } catch { /* try a safe fallback */ }
    }
    if (!loaded) throw new Error('No supported font could be loaded. Install Inter or choose an available fallback font.');
    const text = figma.createText();
    text.fontName = loadedFont;
    text.characters = spec.text;
    text.fontSize = spec.fontSize ?? 16;
    text.textAlignHorizontal = spec.align ?? 'LEFT';
    if(spec.textAlignVertical)text.textAlignVertical=spec.textAlignVertical;
    if(spec.textAutoResize)text.textAutoResize=spec.textAutoResize;
    if(spec.paragraphSpacing!==undefined)text.paragraphSpacing=spec.paragraphSpacing;
    if(spec.letterSpacing)text.letterSpacing=spec.letterSpacing;
    if(spec.textDecoration)text.textDecoration=spec.textDecoration;
    if(spec.textCase)text.textCase=spec.textCase;
    if(spec.textStyleToken){const style=control.textStyles.get(spec.textStyleToken);if(!style)throw new Error(`TEXT_STYLE_NOT_FOUND: Unknown text style token "${spec.textStyleToken}".`);await text.setTextStyleIdAsync(style.id);}
    if (spec.color || spec.fill || spec.gradient || spec.paints || spec.shadow || spec.shadows || spec.effects) applyNodePaint(text,spec.color??spec.fill,spec.gradient,spec.shadow,spec.paints,spec.shadows,spec.effects);
    if (spec.lineHeight) text.lineHeight = { value: spec.lineHeight, unit: 'PIXELS' };
    node = text;
  } else if (spec.type === 'rectangle') {
    node = figma.createRectangle();
    if (spec.fill || spec.gradient || spec.paints || spec.shadow || spec.shadows || spec.effects) applyNodePaint(node,spec.fill,spec.gradient,spec.shadow,spec.paints,spec.shadows,spec.effects);
    applyCornerStyle(node,spec);
    if (spec.stroke) { node.strokes=[paint(spec.stroke,spec.strokeOpacity??1)]; node.strokeWeight=spec.strokeWidth??1; node.strokeAlign=spec.strokeAlign??'CENTER'; }
  } else if (spec.type === 'ellipse') {
    node = figma.createEllipse();
    if (spec.fill || spec.gradient || spec.paints || spec.shadow || spec.shadows || spec.effects) applyNodePaint(node,spec.fill,spec.gradient,spec.shadow,spec.paints,spec.shadows,spec.effects);
    if (spec.stroke) { node.strokes=[paint(spec.stroke,spec.strokeOpacity??1)]; node.strokeWeight=spec.strokeWidth??1; node.strokeAlign=spec.strokeAlign??'CENTER'; }
  } else if (spec.type === 'line') {
    const line = figma.createLine();
    line.strokes = [paint(spec.stroke ?? spec.fill ?? '#333333',spec.strokeOpacity??1)];
    line.strokeWeight = spec.strokeWidth ?? 1;
    node = line;
  } else if(spec.type==='vector') {
    const vector=figma.createVector();
    vector.vectorPaths=[{windingRule:'NONZERO',data:spec.path}];
    if(spec.fill||spec.gradient||spec.paints||spec.shadow||spec.shadows||spec.effects)applyNodePaint(vector,spec.fill,spec.gradient,spec.shadow,spec.paints,spec.shadows,spec.effects);
    node=vector;
  } else if(spec.type==='image') {
    const bytes=decodeBase64(spec.data,MAX_EMBEDDED_IMAGE_BYTES);const image=figma.createImage(bytes);const rectangle=figma.createRectangle();rectangle.fills=[{type:'IMAGE',imageHash:image.hash,scaleMode:spec.scaleMode??'FIT',...(spec.scaleMode==='CROP'&&spec.imageTransform?{imageTransform:spec.imageTransform}:{}),...(spec.scaleMode==='TILE'&&spec.scalingFactor!==undefined?{scalingFactor:spec.scalingFactor}:{})}];node=rectangle;
  } else if(spec.type==='instance') {
    const component=control.components.get(spec.componentRef);
    if(!component||component.removed)throw new Error(`COMPONENT_NOT_FOUND: Component "${spec.componentRef}" must be created before its instance.`);
    node=component.createInstance();
  } else if (spec.type === 'frame') {
    node = figma.createFrame();
    (node as FrameNode).clipsContent = false;
  } else if(spec.type==='component') {
    node=figma.createComponent();
  } else {
    node = figma.createFrame();
    (node as FrameNode).fills = [];
  }
  node.name = spec.name;
  parent.appendChild(node);
  node.resize(spec.width, spec.height);
  node.x = spec.x ?? 0;
  node.y = spec.y ?? 0;
  if(spec.rotation!==undefined)node.rotation=spec.rotation;
  node.opacity = spec.opacity ?? 1;
  applyConstraints(node,spec.constraints);
  if(spec.fillToken)bindToken(node,spec.fillToken,control);
  if (spec.type==='frame'||spec.type==='group'||spec.type==='component') {
    applyNodePaint(node,spec.fill,spec.gradient,spec.shadow,spec.paints,spec.shadows,spec.effects);
    if(spec.type==='frame'||spec.type==='component')(node as FrameNode).clipsContent=spec.clipsContent??false;
    applyCornerStyle(node,spec);
    if(spec.type==='component')control.components.set(spec.id,node as ComponentNode);
  }
  logicalIds.set(node.id, spec.id);
  if ((spec.type === 'frame' || spec.type === 'group' || spec.type==='component') && 'children' in spec) {
    const frame = node as FrameNode;
    applyLayout(frame,spec.layout);
    if(spec.type==='frame'||spec.type==='component')frame.layoutGrids=makeLayoutGrids(spec.layoutGrids);
    for (const child of spec.children) await renderNode(child, frame, control, fontFallback);
  }
  return node;
}

function fontStyle(weight: number): string {
  if (weight >= 700) return 'Bold';
  if (weight >= 600) return 'Semi Bold';
  if (weight >= 500) return 'Medium';
  return 'Regular';
}

function placeAssetNode(node:SceneNode,width:number,height:number,name:string):void{
  node.name=name.replace(/[\u0000-\u001f]/g,' ').trim().slice(0,160)||'Imported asset';
  const selected=figma.currentPage.selection.length===1?figma.currentPage.selection[0]:undefined;
  const parent=selected?.type==='FRAME'?selected:figma.currentPage;
  parent.appendChild(node);
  if(parent.type==='FRAME'){node.x=24;node.y=24;}
  else{node.x=figma.viewport.center.x-width/2;node.y=figma.viewport.center.y-height/2;}
  figma.currentPage.selection=[node];figma.viewport.scrollAndZoomIntoView([node]);
}

async function verifyInsertedAsset(node:SceneNode,kind:'svg'|'image',width:number,height:number):Promise<void>{
  const readback=await figma.getNodeByIdAsync(node.id);
  if(!readback||readback.removed)verifyAssetReadback(null,{id:node.id,kind,width,height});
  if(!readback)return;
  if(!('width' in readback)||!('height' in readback)){verifyAssetReadback(null,{id:node.id,kind,width,height});return;}
  const imageFill='fills' in readback&&Array.isArray(readback.fills)&&readback.fills.some(fill=>fill.type==='IMAGE');
  verifyAssetReadback({id:readback.id,type:readback.type,width:readback.width,height:readback.height,...('children' in readback?{childCount:readback.children.length}:{}),imageFill},{id:node.id,kind,width,height});
}

async function insertSvg(name:string,source:string){
  const asset=sanitizeSvg(source);const node=figma.createNodeFromSvg(asset.svg);
  try{node.resize(asset.width,asset.height);placeAssetNode(node,asset.width,asset.height,name);await verifyInsertedAsset(node,'svg',asset.width,asset.height);return {kind:'svg' as const,name:node.name,width:asset.width,height:asset.height,elements:asset.elements,nodeId:node.id};}
  catch(error){if(!node.removed)node.remove();throw error;}
}

async function insertRaster(name:string,mimeType:string,input:number[]){
  if(!Array.isArray(input)||input.length>MAX_RASTER_BYTES)throw new Error('Image payload exceeds the 5 MB import limit.');
  const bytes=new Uint8Array(input);const info=validateRasterAsset(bytes,mimeType);const image=figma.createImage(bytes);
  const node=figma.createRectangle();
  try{node.resize(info.width,info.height);node.fills=[{type:'IMAGE',imageHash:image.hash,scaleMode:'FIT'}];placeAssetNode(node,info.width,info.height,name);await verifyInsertedAsset(node,'image',info.width,info.height);return {kind:'image' as const,name:node.name,width:info.width,height:info.height,mimeType:info.mimeType,bytes:info.size,nodeId:node.id};}
  catch(error){if(!node.removed)node.remove();throw error;}
}

async function renderSpec(spec: DesignSpec, fontFallback: string): Promise<number> {
  const checked = validateDesignSpec(spec);
  if (!checked.valid) throw new Error(`Invalid specification: ${checked.issues.map((i) => `${i.path}: ${i.message}`).join('; ')}`);
  const createdPages: PageNode[] = [];
  const control: RenderControl = { cancelled: false, nodes: 0, components:new Map(), colors:new Map(), textStyles:new Map() };
  cancelActiveRender = () => { control.cancelled = true; };
  try {
    await prepareDesignSystem(spec,control,fontFallback);
    for (const pageSpec of spec.pages) {
      if (control.cancelled) throw new Error('RENDER_CANCELLED: Rendering was cancelled.');
      const page = figma.createPage();
      createdPages.push(page);
      page.name = pageSpec.name;
      await page.loadAsync();
      for (const childSpec of pageSpec.children) await renderNode(childSpec, page, control, fontFallback);
    }
  } catch (error) {
    for (const page of createdPages) page.remove();
    throw error;
  } finally {
    cancelActiveRender = undefined;
  }
  await figma.setCurrentPageAsync(createdPages[0]!);
  const firstFrame = createdPages[0]!.children.find((node) => node.type === 'FRAME');
  if (firstFrame) {
    figma.currentPage.selection = [firstFrame];
    figma.viewport.scrollAndZoomIntoView([firstFrame]);
  }
  return createdPages.reduce((sum, page) => sum + page.children.length, 0);
}

async function captureSelectionPreview(): Promise<{kind:'visual-preview';mimeType:'image/jpeg';base64:string;width:number;height:number;nodeName:string}> {
  const selected = figma.currentPage.selection;
  if (selected.length !== 1) throw new Error('VISUAL_SELECTION_REQUIRED: Select exactly one Figma frame to capture a visual review preview.');
  const node = selected[0]!;
  if (!['FRAME','COMPONENT','INSTANCE'].includes(node.type) || !('exportAsync' in node)) throw new Error('VISUAL_FRAME_REQUIRED: Select a frame, component, or instance for visual review.');
  if (!(node.width > 0 && node.height > 0) || node.height / node.width > 8 || node.width / node.height > 8) throw new Error('VISUAL_BOUNDS_UNSUPPORTED: Selected frame aspect ratio is too extreme to capture safely.');
  const maxBytes = 700 * 1024;
  for (const width of [1024, 768, 512]) {
    const height = Math.max(1, Math.round(width * node.height / node.width));
    if (height > 8192) throw new Error('VISUAL_BOUNDS_UNSUPPORTED: Preview height would exceed 8192 pixels.');
    const bytes = await node.exportAsync({format:'JPG',constraint:{type:'WIDTH',value:width},contentsOnly:true,colorProfile:'SRGB'});
    if (bytes.length <= maxBytes) return {kind:'visual-preview',mimeType:'image/jpeg',base64:encodeBase64(bytes),width,height,nodeName:node.name};
  }
  throw new Error('VISUAL_PREVIEW_TOO_LARGE: Preview is still over 700 KB at 512 pixels wide. Simplify or reduce the selected frame before visual review.');
}

function countLayers(node: BaseNode & ChildrenMixin): number {
  const stack = node.children.slice(0, 10000).map((child) => ({ child, depth: 1 }));
  let count = 0;
  while (stack.length && count < 10000) {
    const { child, depth } = stack.pop()!;
    count += 1;
    if (depth < 32 && 'children' in child) {
      const children = (child as BaseNode & ChildrenMixin).children;
      for (let i = 0; i < children.length && stack.length < 10000; i++) stack.push({ child: children[i]!, depth: depth + 1 });
    }
  }
  return count;
}

type SelectionSummary = Extract<HostToUi,{type:'selection'}>['summary'];
function getSelectionSummary(): SelectionSummary {
  const selected = figma.currentPage.selection[0];
  if (!selected || !('width' in selected) || !('height' in selected)) return null;
  const nodes: Array<{id:string;name:string;type:string;x:number;y:number;width:number;height:number;text?:string;fill?:string;hasImageFill?:boolean;imageScaleMode?:'FILL'|'FIT'|'CROP'|'TILE';imageTransform?:Transform;imageScalingFactor?:number}> = [];
  const collect = (node: SceneNode, depth: number) => {
    if (nodes.length >= 100 || depth > 5) return;
    const logicalId = logicalIds.get(node.id) || node.id;
    {
      const item: {id:string;name:string;type:string;x:number;y:number;width:number;height:number;text?:string;fill?:string;hasImageFill?:boolean;imageScaleMode?:'FILL'|'FIT'|'CROP'|'TILE';imageTransform?:Transform;imageScalingFactor?:number} = { id: logicalId, name: node.name, type: node.type, x: Math.round(node.x), y: Math.round(node.y), width: Math.round(node.width), height: Math.round(node.height) };
      if (node.type === 'TEXT') item.text = node.characters.slice(0, 500);
      if('fills' in node&&Array.isArray(node.fills)){const image=node.fills.find(fill=>fill.type==='IMAGE'&&fill.visible!==false);item.hasImageFill=Boolean(image);if(image?.type==='IMAGE'){item.imageScaleMode=image.scaleMode;if(image.scaleMode==='CROP'&&image.imageTransform)item.imageTransform=image.imageTransform;if(image.scaleMode==='TILE'&&image.scalingFactor!==undefined)item.imageScalingFactor=image.scalingFactor;}}
      if ('fills' in node && Array.isArray(node.fills) && node.fills[0]?.type === 'SOLID') {
        const c = node.fills[0].color; item.fill = `#${[c.r,c.g,c.b].map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('')}`;
      }
      nodes.push(item);
    }
    if ('children' in node) for (const child of node.children) collect(child, depth + 1);
  };
  collect(selected, 0);
  return { name: selected.name, type: selected.type, width: Math.round(selected.width), height: Math.round(selected.height), layerCount: 'children' in selected ? countLayers(selected as BaseNode & ChildrenMixin) : 0, nodes };
}
function inspectSelec…4429 tokens truncated…if(node.type==='RECTANGLE'&&(paintItem.opacity??1)===1){
            const encoded=await toStackItem(paintItem);if(encoded.type!=='image')throw new Error('Internal image paint conversion failed.');imageData={mimeType:encoded.mimeType,data:encoded.data,scaleMode:encoded.scaleMode??'FIT',...(encoded.imageTransform?{imageTransform:encoded.imageTransform}:{}),...(encoded.scalingFactor!==undefined?{scalingFactor:encoded.scalingFactor}:{})};
          }else paints=[await toStackItem(paintItem)];
        }
        else if(paintItem)throw new Error(`Layer "${node.name}" uses unsupported ${paintItem.type.toLowerCase()} paint.`);
      }
    }
    let shadow:ShadowSpec|undefined;let shadows:ShadowSpec[]|undefined;let designEffects:EffectSpec[]|undefined;
    if('effects' in node){
      const visibleEffects=node.effects.filter(effect=>effect.visible!==false);
      for(const effect of visibleEffects)if(effect.type==='DROP_SHADOW'||effect.type==='INNER_SHADOW')assertPortableBlendMode(node.name,'effect',effect.blendMode??'NORMAL');
      if(visibleEffects.length>4)throw new Error(`Layer "${node.name}" has more than four effects; schema 1.0 limits the stack to four.`);
      const allDropShadows=visibleEffects.every(effect=>effect.type==='DROP_SHADOW');
      if(allDropShadows){const exported=visibleEffects.flatMap(effect=>effect.type==='DROP_SHADOW'?[{color:hexColor(effect.color),opacity:effect.color.a,offsetX:effect.offset.x,offsetY:effect.offset.y,blur:effect.radius,...(effect.spread!==undefined?{spread:effect.spread}:{})}]:[]);if(exported.length===1)shadow=exported[0];else if(exported.length>1)shadows=exported;}
      else designEffects=visibleEffects.map(effect=>{
        if(effect.type==='DROP_SHADOW'||effect.type==='INNER_SHADOW')return {type:effect.type==='INNER_SHADOW'?'inner-shadow':'drop-shadow',color:hexColor(effect.color),opacity:effect.color.a,offsetX:effect.offset.x,offsetY:effect.offset.y,blur:effect.radius,...(effect.spread!==undefined?{spread:effect.spread}:{})};
        if(effect.type==='LAYER_BLUR'){if(effect.blurType==='PROGRESSIVE')return {type:'progressive-layer-blur',startRadius:effect.startRadius,endRadius:effect.radius,startOffset:{x:effect.startOffset.x,y:effect.startOffset.y},endOffset:{x:effect.endOffset.x,y:effect.endOffset.y}};return {type:'layer-blur',blur:effect.radius};}
        if(effect.type==='BACKGROUND_BLUR'){if(effect.blurType==='PROGRESSIVE')return {type:'progressive-background-blur',startRadius:effect.startRadius,endRadius:effect.radius,startOffset:{x:effect.startOffset.x,y:effect.startOffset.y},endOffset:{x:effect.endOffset.x,y:effect.endOffset.y}};return {type:'background-blur',blur:effect.radius};}
        throw new Error(`Layer "${node.name}" has an unsupported effect type that cannot be exported losslessly.`);
      });
    }
    const constraints='constraints' in node?node.constraints:undefined;
    const fillToken=await readColorToken(node);
    const base = { id, name: node.name.slice(0,160), x: Math.round(supported.x), y: Math.round(supported.y), width: Math.max(.01,Math.round(supported.width*100)/100), height: Math.max(.01,Math.round(supported.height*100)/100), opacity: supported.opacity, ...(supported.rotation!==0?{rotation:supported.rotation}:{}), ...(fill?{fill}:{}),...(gradient?{gradient}:{}),...(paints?{paints}:{}),...(shadow?{shadow}:{}),...(shadows?{shadows}:{}),...(designEffects?.length?{effects:designEffects}:{}),...(constraints?{constraints}:{}),...(fillToken?{fillToken}:{}) };
    if(imageData)return {...base,type:'image',...imageData};
    if (node.type === 'TEXT') {
      const font = node.fontName === figma.mixed ? undefined : node.fontName;
      const lineHeight = typeof node.lineHeight === 'object' && node.lineHeight.unit === 'PIXELS' ? node.lineHeight.value : undefined;
      const rawStyle=node.characters.length?node.getRangeTextStyleId(0,node.characters.length):null;let textStyleToken:string|undefined;
      if(typeof rawStyle==='string'&&rawStyle!==''){const style=await figma.getStyleByIdAsync(rawStyle);if(style?.type==='TEXT'){textStyleToken=style.name.startsWith('AI Designer · ')?style.name.slice(style.name.lastIndexOf(' / ')+3):style.name;exportedTypography.set(textStyleToken,{name:textStyleToken,fontFamily:style.fontName.family,fontSize:style.fontSize,fontWeight:fontStyleToWeight(style.fontName.style),...(typeof style.lineHeight==='object'&&style.lineHeight.unit==='PIXELS'?{lineHeight:style.lineHeight.value}:{}),...(typeof style.paragraphSpacing==='number'?{paragraphSpacing:style.paragraphSpacing}:{}),...(style.letterSpacing?{letterSpacing:{unit:style.letterSpacing.unit,value:style.letterSpacing.value}}:{}),...(style.textDecoration!=='NONE'?{textDecoration:style.textDecoration}:{}),...(style.textCase!=='ORIGINAL'?{textCase:style.textCase}:{})});}}
      if(node.letterSpacing===figma.mixed||node.textDecoration===figma.mixed||node.textCase===figma.mixed||node.paragraphSpacing===figma.mixed)throw new Error(`Text layer "${node.name}" has mixed character styling that selected export cannot preserve in schema 1.0.`);
      return { ...base, type:'text', text:node.characters.slice(0,20_000), ...(font?{fontFamily:font.family,fontWeight:fontStyleToWeight(font.style)}:{}), ...(typeof node.fontSize==='number'?{fontSize:node.fontSize}:{}), ...(lineHeight!==undefined?{lineHeight}:{}), ...(typeof node.paragraphSpacing==='number'?{paragraphSpacing:node.paragraphSpacing}:{}), textAlignVertical:node.textAlignVertical, textAutoResize:node.textAutoResize, ...(node.letterSpacing?{letterSpacing:{unit:node.letterSpacing.unit,value:node.letterSpacing.value}}:{}), ...(node.textDecoration!=='NONE'?{textDecoration:node.textDecoration}:{}), ...(node.textCase!=='ORIGINAL'?{textCase:node.textCase}:{}), ...(fill?{color:fill}:{}), ...(textStyleToken?{textStyleToken}:{}), align:node.textAlignHorizontal };
    }
    if(node.type==='VECTOR'){
      const path=node.vectorPaths[0]?.data;if(!path)throw new Error(`Vector "${node.name}" has no editable path.`);return {...base,type:'vector',path};
    }
    if(node.type==='INSTANCE'){
      const component=await node.getMainComponentAsync();if(!component)throw new Error(`Instance "${node.name}" has no accessible main component and cannot be round-tripped.`);const componentRef=logicalIds.get(component.id)||`figma-${component.id}`;
      if(!definedComponents.has(componentRef)){if(internalComponents.has(componentRef))throw new Error(`Instance "${node.name}" appears before its component in the selected tree; reorder the component before the instance before exporting.`);detachedComponents.push(await convert(component,depth+1));}
      return {...base,type:'instance',componentRef};
    }
    if (node.type === 'RECTANGLE' || node.type === 'ELLIPSE') {
    const cornerStyle = node.type === 'RECTANGLE' ? exportCornerStyle(node) : {};
      const visibleStrokes=node.strokes.filter(item=>item.visible!==false&&(item.opacity??1)>0);
      if(visibleStrokes.length>1)throw new Error(`Layer "${node.name}" uses multiple strokes which schema 1.0 cannot preserve.`);
      const stroke=visibleStrokes[0];
      if(stroke&& (stroke.type!=='SOLID'||stroke.blendMode!=='NORMAL'))throw new Error(`Layer "${node.name}" uses a non-solid or blended stroke unsupported by portable export.`);
      return { ...base, type:node.type === 'RECTANGLE'?'rectangle':'ellipse', ...cornerStyle, ...(stroke?.type==='SOLID'?{stroke:hexColor(stroke.color),...(stroke.opacity!==undefined&&stroke.opacity!==1?{strokeOpacity:stroke.opacity}:{})}:{}), ...(stroke&&typeof node.strokeWeight==='number'?{strokeWidth:node.strokeWeight}:{}), ...(stroke?{strokeAlign:node.strokeAlign}:{}) };
    }
    if (node.type === 'LINE') {
      const visibleStrokes = node.strokes.filter((item) => item.visible !== false && (item.opacity ?? 1) > 0);
      assertSinglePortableStroke(node.name,visibleStrokes.length);
      const stroke = visibleStrokes[0];
      if (stroke && stroke.type !== 'SOLID') throw new Error(`Layer "${node.name}" uses an unsupported line stroke.`);
      if(stroke?.type==='SOLID')assertPortableBlendMode(node.name,'line stroke',stroke.blendMode??'NORMAL');
      const color = stroke?.type === 'SOLID' ? hexColor(stroke.color) : undefined;
      const strokeOpacity=stroke?.type==='SOLID'?stroke.opacity:undefined;
      return { ...base, type:'line', ...(color?{stroke:color}:{}), ...(strokeOpacity!==undefined&&strokeOpacity!==1?{strokeOpacity}:{}), ...(typeof node.strokeWeight==='number'?{strokeWidth:node.strokeWeight}:{}) };
    }
    if (node.type === 'FRAME' || node.type === 'GROUP' || node.type==='COMPONENT') {
      if(node.type==='COMPONENT')definedComponents.add(id);
      const children = await Promise.all(node.children.map((child) => convert(child, depth + 1)));
      if (node.type === 'FRAME' || node.type==='COMPONENT') {
        const frame = node;
        if(node.type==='FRAME'&&frame.layoutMode !== 'NONE' && [frame.paddingRight,frame.paddingBottom,frame.paddingLeft].some((value)=>value!==frame.paddingTop)) throw new Error(`Auto Layout frame "${node.name}" uses asymmetric padding which cannot be exported losslessly.`);
        const semanticMode=fromFigmaLayoutMode(frame.layoutMode);
        const semanticAlignment=fromFigmaPrimaryAxisAlignment(frame.primaryAxisAlignItems);
        if(semanticMode===undefined)throw new Error(`Frame "${node.name}" uses a Figma layout mode unknown to schema 1.0.`);
        if (frame.layoutMode !== 'NONE' && semanticAlignment===undefined) throw new Error(`Auto Layout frame "${node.name}" uses an alignment that schema 1.0 cannot preserve yet.`);
        const layout = frame.layoutMode === 'NONE' ? undefined : { mode:semanticMode==='horizontal'?'horizontal' as const:'vertical' as const, gap:frame.itemSpacing, padding:frame.paddingTop, alignment:semanticAlignment??'MIN', primaryAxisSizing:frame.primaryAxisSizingMode, counterAxisSizing:frame.counterAxisSizingMode };
        const cornerStyle=exportCornerStyle(frame);
        const layoutGrids=node.type==='FRAME'?frame.layoutGrids.map(grid=>grid.pattern==='GRID'?{pattern:'GRID' as const,sectionSize:grid.sectionSize,...(grid.visible!==undefined?{visible:grid.visible}:{})}:{pattern:grid.pattern,...(grid.sectionSize!==undefined?{sectionSize:grid.sectionSize}:{}),gutterSize:grid.gutterSize,count:grid.count,...(grid.offset!==undefined?{offset:grid.offset}:{}),...(grid.alignment?{alignment:grid.alignment}:{}),...(grid.visible!==undefined?{visible:grid.visible}:{})}):undefined;
        const frameBase={...base,...(layoutGrids?.length?{layoutGrids}:{}),...cornerStyle,...(frame.clipsContent?{clipsContent:true}:{})};
        if(node.type==='COMPONENT')return {...frameBase,type:'component',children,...(layout?{layout}:{})};
        return { ...frameBase, type:'frame', children, ...(layout?{layout}:{}) };
      }
      return { ...base, type:'group', children };
    }
    throw new Error(`Layer "${node.name}" (${node.type}) cannot be represented in schema 1.0. Export a frame containing only supported native layers.`);
  };
  const colors=[...exportedColors.values()];const typography=[...exportedTypography.values()];
  const root=await convert(selected,1);
  const spec: DesignSpec = { schemaVersion:'1.0', name:selected.name.slice(0,160), ...(colors.length||typography.length?{designSystem:{name:'Exported',...(colors.length?{colors}:{}),...(typography.length?{typography}:{})}}:{}), pages:[{ id:`export-page-${selected.id}`, name:figma.currentPage.name.slice(0,160), children:[...detachedComponents,root] }] };
  const result = validateDesignSpec(spec);
  if (!result.valid) throw new Error(`Selection export failed validation: ${result.issues.map((issue)=>`${issue.path}: ${issue.message}`).join('; ')}`);
  return spec;
}

function fontStyleToWeight(style:string):number{return /bold/i.test(style)?700:/semi.?bold/i.test(style)?600:/medium/i.test(style)?500:400;}

function bridgeStatus(status:Extract<HostToUi,{type:'agent-status'}>['status'],details:Partial<Extract<HostToUi,{type:'agent-status'}>>={}):void{
  figma.ui.postMessage({type:'agent-status',status,...(bridgeSessionId?{sessionId:bridgeSessionId}:{}),...details});
}
function bridgeOperationLabel(operation:BridgeOperation):string{
  if(operation.type==='inspect-selection')return 'Inspecting selection';
  if(operation.type==='render-spec')return `Inserting ${operation.spec.name}`;
  if(operation.type==='apply-patch')return `Applying ${operation.patch.operations.length} reviewed edit(s)`;
  if(operation.type==='insert-svg')return `Importing SVG ${operation.name}`;
  if(operation.type==='insert-image')return `Importing image ${operation.name}`;
  if(operation.type==='begin-image-transfer')return `Starting image transfer ${operation.name}`;
  if(operation.type==='image-transfer-chunk')return `Receiving image chunk ${operation.index+1}`;
  if(operation.type==='finish-image-transfer')return 'Verifying and inserting transferred image';
  if(operation.type==='capture-selection')return 'Capturing selected frame for visual review';
  return 'Exporting selected design';
}
function cleanupImageTransfers():void{const now=Date.now();for(const[id,transfer]of pendingImageTransfers)if(now-transfer.updatedAt>120_000)pendingImageTransfers.delete(id);}
function beginImageTransfer(operation:Extract<BridgeOperation,{type:'begin-image-transfer'}>):void{
  cleanupImageTransfers();
  if(pendingImageTransfers.size>=2)throw new Error('IMAGE_TRANSFER_BUSY: At most two image transfers can be active.');
  if(!/^[a-f0-9-]{36}$/i.test(operation.transferId)||!Number.isSafeInteger(operation.totalBytes)||operation.totalBytes<10||operation.totalBytes>MAX_RASTER_BYTES||!Number.isSafeInteger(operation.chunkCount)||operation.chunkCount!==Math.ceil(operation.totalBytes/MCP_ASSET_CHUNK_BYTES)||!/^[a-f0-9]{64}$/i.test(operation.sha256))throw new Error('IMAGE_TRANSFER_INVALID: Image transfer metadata is invalid or exceeds the 5 MB limit.');
  if(pendingImageTransfers.has(operation.transferId))throw new Error('IMAGE_TRANSFER_DUPLICATE: This transfer has already started.');
  pendingImageTransfers.set(operation.transferId,{name:operation.name,mimeType:operation.mimeType,totalBytes:operation.totalBytes,sha256:operation.sha256,chunkCount:operation.chunkCount,bytes:new Uint8Array(operation.totalBytes),receivedBytes:0,updatedAt:Date.now()});
}
function appendImageTransferChunk(operation:Extract<BridgeOperation,{type:'image-transfer-chunk'}>):void{
  cleanupImageTransfers();const transfer=pendingImageTransfers.get(operation.transferId);if(!transfer)throw new Error('IMAGE_TRANSFER_NOT_FOUND: Start the image transfer again.');
  if(!Number.isSafeInteger(operation.index)||operation.index<0||operation.index>=transfer.chunkCount||!Array.isArray(operation.bytes))throw new Error('IMAGE_TRANSFER_INVALID: Image chunk index or bytes are invalid.');
  const offset=operation.index*MCP_ASSET_CHUNK_BYTES;const expected=Math.min(MCP_ASSET_CHUNK_BYTES,transfer.totalBytes-offset);
  if(operation.bytes.length!==expected||operation.bytes.some(value=>!Number.isInteger(value)||value<0||value>255)||transfer.receivedBytes+operation.bytes.length>transfer.totalBytes)throw new Error('IMAGE_TRANSFER_INVALID: Image chunk size or byte values are invalid.');
  transfer.bytes.set(operation.bytes,offset);transfer.receivedBytes+=operation.bytes.length;transfer.updatedAt=Date.now();
}
async function finishImageTransfer(operation:Extract<BridgeOperation,{type:'finish-image-transfer'}>):Promise<unknown>{
  cleanupImageTransfers();const transfer=pendingImageTransfers.get(operation.transferId);if(!transfer)throw new Error('IMAGE_TRANSFER_NOT_FOUND: Start the image transfer again.');pendingImageTransfers.delete(operation.transferId);
  if(transfer.receivedBytes!==transfer.totalBytes)throw new Error('IMAGE_TRANSFER_INCOMPLETE: Some image chunks are missing.');
  if(sha256(transfer.bytes)!==transfer.sha256)throw new Error('IMAGE_TRANSFER_CHECKSUM_FAILED: Reassemble the file and retry its transfer.');
  validateRasterAsset(transfer.bytes,transfer.mimeType);const asset=await insertRaster(transfer.name,transfer.mimeType,Array.from(transfer.bytes));
  figma.ui.postMessage({type:'asset-result',ok:true,message:'Chunked MCP image was checksum-verified, inserted and read back as a native Figma image fill.',...asset});return{...asset,sha256:transfer.sha256};
}
async function executeBridgeJob(job:BridgeJob):Promise<void>{
  const operation=job.operation;const label=bridgeOperationLabel(operation);const startedAt=Date.now();
  const operator=figma.currentUser?.name??'Figma user';
  bridgeStatus('working',{jobId:job.jobId,agentLabel:job.agentLabel,operation:label});
  figma.ui.postMessage({type:'agent-event',id:`${job.jobId}-started`,jobId:job.jobId,agentLabel:job.agentLabel,operation:label,status:'started',timestamp:startedAt,message:'Plugin accepted the queued operation.'});
  figma.notify(`${operator} · Working in this file: ${label}`);
  try{
    let result:unknown;
    if(operation.type==='inspect-selection')result={summary:getSelectionSummary()};
    else if(operation.type==='render-spec')result={created:await renderSpec(operation.spec,'Inter'),message:'Editable Figma layers were inserted.'};
    else if(operation.type==='capture-selection')result=await captureSelectionPreview();
    else if(operation.type==='apply-patch'){await applyPatch(operation.patch);result={message:'Patch applied to selected layers.',undoCount:patchCheckpoints.length};}
    else if(operation.type==='insert-svg'){const asset=await insertSvg(operation.name,operation.svg);result=asset;figma.ui.postMessage({type:'asset-result',ok:true,message:'MCP supplied SVG imported and read back as editable vector geometry.',...asset});}
    else if(operation.type==='insert-image'){const asset=await insertRaster(operation.name,operation.mimeType,operation.bytes);result=asset;figma.ui.postMessage({type:'asset-result',ok:true,message:'MCP supplied image imported and read back as a native image fill.',...asset});}
    else if(operation.type==='begin-image-transfer'){beginImageTransfer(operation);result={transferId:operation.transferId,started:true};}
    else if(operation.type==='image-transfer-chunk'){appendImageTransferChunk(operation);result={transferId:operation.transferId,index:operation.index,received:true};}
    else if(operation.type==='finish-image-transfer')result=await finishImageTransfer(operation);
    else result={spec:await exportSelectedDesign()};
    figma.ui.postMessage({type:'bridge-job-result',jobId:job.jobId,ok:true,result});
    figma.ui.postMessage({type:'agent-event',id:`${job.jobId}-completed`,jobId:job.jobId,agentLabel:job.agentLabel,operation:label,status:'completed',timestamp:Date.now(),message:`Operation completed in ${Date.now()-startedAt} ms.`});
    figma.notify(`${operator} · Done: ${label}`);
    bridgeStatus('connected');
  }catch(error){
    const message=error instanceof Error?error.message:'Plugin operation failed.';
    figma.ui.postMessage({type:'bridge-job-result',jobId:job.jobId,ok:false,error:{code:message.startsWith('RENDER_CANCELLED:')?'RENDER_CANCELLED':'PLUGIN_OPERATION_FAILED',message}});
    figma.ui.postMessage({type:'agent-event',id:`${job.jobId}-failed`,jobId:job.jobId,agentLabel:job.agentLabel,operation:label,status:'failed',timestamp:Date.now(),message});
    figma.notify(`${operator} · Failed: ${message.slice(0,140)}`);
    bridgeStatus('connected');
  }
}
function configureBridge(endpoint:string,token:string,sessionId:string):void{
  if(!token){bridgeSessionId='';bridgeStatus('disconnected',{message:'Claude disconnected.'});return;}
  try{
    if(!/^http:\/\/(?:localhost|127\.0\.0\.1):8788\/?$/.test(endpoint))throw new Error('Use the local bridge endpoint http://localhost:8788.');
    if(!/^[a-f0-9]{64}$/i.test(token))throw new Error('The local pairing details are invalid. Select Connect Claude again.');
    if(!/^[a-zA-Z0-9:_-]{8,128}$/.test(sessionId))throw new Error('The local bridge session is invalid. Select Connect Claude again.');
    bridgeSessionId=sessionId;
    bridgeStatus('connecting',{message:'Connecting to the local agent bridge…'});
  }catch(error){bridgeStatus('disconnected',{message:error instanceof Error?error.message:'Bridge is not configured.'});}
}

function sendCurrentUser():void{
  const user=figma.currentUser;
  figma.ui.postMessage({type:'current-user',name:user?.name??'Figma user',photoUrl:user?.photoUrl??null,signedIn:Boolean(user&&user.name!=='Anonymous')});
}

figma.on('selectionchange', inspectSelection);
figma.ui.onmessage = async (message: UiToHost) => {
  try {
    if (message.type === 'resize-ui') {
      const width = Math.max(360, Math.min(760, Math.round(message.width)));
      const height = Math.max(520, Math.min(1000, Math.round(message.height)));
      figma.ui.resize(width, height);
      return;
    }
    if(message.type==='ui-ready'){sendCurrentUser();inspectSelection();return;}
    if(message.type==='configure-bridge'){configureBridge(message.endpoint,message.token,message.sessionId);return;}
    if(message.type==='hide-ui'){figma.ui.hide();figma.notify('Claude is connected. Figma work will continue in the background. Run AI Designer No Figma again to reopen its panel.');return;}
    if(message.type==='bridge-job'){await executeBridgeJob(message.job);return;}
    if (message.type === 'cancel-render') { cancelActiveRender?.(); return; }
    if (message.type === 'inspect-selection') inspectSelection();
    if (message.type === 'render') {
      try {
        const created = await renderSpec(message.spec, message.fontFallback || 'Inter');
        figma.ui.postMessage({ type: 'render-result', ok: true, message: 'Editable Figma nodes created.', created });
      } catch (error) {
        const messageText = error instanceof Error ? error.message : 'Render failed.';
        if (messageText.startsWith('RENDER_CANCELLED:')) figma.ui.postMessage({ type: 'render-result', ok: false, message: 'Render cancelled; newly created page was removed.' });
        else throw error;
      }
    }
    if (message.type === 'export-selection') {
      const spec = await exportSelectedDesign();
      figma.ui.postMessage({ type:'export-result', ok:true, message:'Selected design exported as a validated specification.', spec });
    }
    if (message.type === 'apply-patch') {
      await applyPatch(message.patch);
      figma.ui.postMessage({ type: 'patch-result', ok: true, message: 'Patch applied to the selected frame.', undoCount: patchCheckpoints.length });
    }
    if (message.type === 'undo-patch') undoPatch();
    if (message.type === 'apply-color-selection') {
      applyColorToSelection(message.color);
      figma.ui.postMessage({ type: 'patch-result', ok: true, message: 'Color applied to the selected layers.' });
    }
    if(message.type==='import-svg'){
      const result=await insertSvg(message.name,message.svg);
      figma.ui.postMessage({type:'asset-result',ok:true,message:'Sanitized SVG imported and read back as editable Figma vector layers.',...result});
    }
    if(message.type==='import-image'){
      const result=await insertRaster(message.name,message.mimeType,message.bytes);
      figma.ui.postMessage({type:'asset-result',ok:true,message:'Image imported and read back as a native Figma image fill.',...result});
    }
    if(message.type==='select-node'){
      const node=await figma.getNodeByIdAsync(message.nodeId);
      if(!node||node.type==='DOCUMENT'||node.type==='PAGE')throw new Error('This asset node is no longer available in the open document.');
      if(node.parent?.type==='PAGE'&&node.parent!==figma.currentPage)await figma.setCurrentPageAsync(node.parent);
      figma.currentPage.selection=[node];figma.viewport.scrollAndZoomIntoView([node]);
    }
  } catch (error) {
    figma.ui.postMessage({ type: 'error', code: 'PLUGIN_OPERATION_FAILED', message: error instanceof Error ? error.message : 'Plugin operation failed.' });
  }
};

figma.on('run',()=>{figma.ui.show();sendCurrentUser();inspectSelection();});
sendCurrentUser();
