import { MAX_DEPTH, MAX_NODES, validateDesignSpec, type DesignNodeSpec, type DesignSpec } from '../shared/spec';
import type { EditPatch, HostToUi, UiToHost } from '../shared/protocol';
import type { BridgeJob, BridgeOperation } from '../shared/bridge-contract';
import { sanitizeSvg, validateRasterAsset } from '../shared/assets';

figma.showUI(__html__, { width: 440, height: 720, themeColors: true });
let cancelActiveRender: (() => void) | undefined;
// Plugin data APIs require a registered manifest ID. Keep spec IDs in memory
// for this plugin session and fall back to native Figma node IDs otherwise.
const logicalIds = new Map<string, string>();
type PatchSnapshot = { target: SceneNode; name: string; fills: readonly Paint[] | PluginAPI['mixed'] | undefined; text: string | undefined; x: number | undefined; y: number | undefined; width: number | undefined; height: number | undefined };
const patchCheckpoints: PatchSnapshot[][] = [];
let bridgeEndpoint = 'http://localhost:8788';
let bridgeToken = '';
let bridgeSessionId = '';
let bridgeEpoch = 0;
let bridgeRegistered = false;
let bridgeHeartbeatAt = 0;
let bridgeHeartbeatInFlight = false;

function rgb(hex: string): RGB {
  const value = hex.replace('#', '');
  return { r: parseInt(value.slice(0, 2), 16) / 255, g: parseInt(value.slice(2, 4), 16) / 255, b: parseInt(value.slice(4, 6), 16) / 255 };
}
function paint(hex: string): SolidPaint { return { type: 'SOLID', color: rgb(hex) }; }

type RenderControl = { cancelled: boolean; nodes: number };
async function renderNode(spec: DesignNodeSpec, parent: BaseNode & ChildrenMixin, control: RenderControl, fontFallback: string): Promise<SceneNode> {
  control.nodes += 1;
  if (control.nodes % 32 === 0) { await maintainBridgeHeartbeat(); await new Promise((resolve) => setTimeout(resolve, 0)); }
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
    if (spec.color) text.fills = [paint(spec.color)];
    if (spec.lineHeight) text.lineHeight = { value: spec.lineHeight, unit: 'PIXELS' };
    node = text;
  } else if (spec.type === 'rectangle') {
    node = figma.createRectangle();
    if (spec.fill) node.fills = [paint(spec.fill)];
    if (spec.radius !== undefined) node.cornerRadius = spec.radius;
  } else if (spec.type === 'ellipse') {
    node = figma.createEllipse();
    if (spec.fill) node.fills = [paint(spec.fill)];
  } else if (spec.type === 'line') {
    const line = figma.createLine();
    line.strokes = [paint(spec.stroke ?? spec.fill ?? '#333333')];
    line.strokeWeight = spec.strokeWidth ?? 1;
    node = line;
  } else if (spec.type === 'frame') {
    node = figma.createFrame();
    (node as FrameNode).clipsContent = false;
  } else {
    node = figma.createFrame();
    (node as FrameNode).fills = [];
  }
  node.name = spec.name;
  parent.appendChild(node);
  node.resize(spec.width, spec.height);
  node.x = spec.x ?? 0;
  node.y = spec.y ?? 0;
  node.opacity = spec.opacity ?? 1;
  if ((spec.type === 'frame' || spec.type === 'group') && spec.fill) (node as FrameNode).fills = [paint(spec.fill)];
  if ((spec.type === 'frame' || spec.type === 'group') && spec.radius !== undefined) (node as FrameNode).cornerRadius = spec.radius;
  logicalIds.set(node.id, spec.id);
  if ((spec.type === 'frame' || spec.type === 'group') && 'children' in spec) {
    const frame = node as FrameNode;
    const layout = spec.layout;
    if (layout && layout.mode !== 'none') {
      frame.layoutMode = layout.mode === 'horizontal' ? 'HORIZONTAL' : 'VERTICAL';
      frame.itemSpacing = layout.gap ?? 0;
      frame.paddingTop = frame.paddingRight = frame.paddingBottom = frame.paddingLeft = layout.padding ?? 0;
      frame.primaryAxisAlignItems = layout.alignment === 'SPACE_BETWEEN' ? 'SPACE_BETWEEN' : layout.alignment ?? 'MIN';
      frame.primaryAxisSizingMode = layout.primaryAxisSizing ?? 'FIXED';
      frame.counterAxisSizingMode = layout.counterAxisSizing ?? 'FIXED';
    }
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

function insertSvg(name:string,source:string){
  const asset=sanitizeSvg(source);const node=figma.createNodeFromSvg(asset.svg);
  try{node.resize(asset.width,asset.height);placeAssetNode(node,asset.width,asset.height,name);return {kind:'svg' as const,name:node.name,width:asset.width,height:asset.height,elements:asset.elements,nodeId:node.id};}
  catch(error){if(!node.removed)node.remove();throw error;}
}

function insertRaster(name:string,mimeType:string,input:number[]){
  if(!Array.isArray(input)||input.length>5*1024*1024)throw new Error('Image payload exceeds the 5 MB import limit.');
  const bytes=new Uint8Array(input);const info=validateRasterAsset(bytes,mimeType);const image=figma.createImage(bytes);
  const node=figma.createRectangle();
  try{node.resize(info.width,info.height);node.fills=[{type:'IMAGE',imageHash:image.hash,scaleMode:'FIT'}];placeAssetNode(node,info.width,info.height,name);return {kind:'image' as const,name:node.name,width:info.width,height:info.height,mimeType:info.mimeType,bytes:info.size,nodeId:node.id};}
  catch(error){if(!node.removed)node.remove();throw error;}
}

async function renderSpec(spec: DesignSpec, fontFallback: string): Promise<number> {
  const checked = validateDesignSpec(spec);
  if (!checked.valid) throw new Error(`Invalid specification: ${checked.issues.map((i) => `${i.path}: ${i.message}`).join('; ')}`);
  const createdPages: PageNode[] = [];
  const control: RenderControl = { cancelled: false, nodes: 0 };
  cancelActiveRender = () => { control.cancelled = true; };
  try {
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
  return createdPages.reduce((sum, page) => sum + page.children.length, 0);
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
  const nodes: Array<{id:string;name:string;type:string;x:number;y:number;width:number;height:number;text?:string;fill?:string}> = [];
  const collect = (node: SceneNode, depth: number) => {
    if (nodes.length >= 100 || depth > 5) return;
    const logicalId = logicalIds.get(node.id) || node.id;
    {
      const item: {id:string;name:string;type:string;x:number;y:number;width:number;height:number;text?:string;fill?:string} = { id: logicalId, name: node.name, type: node.type, x: Math.round(node.x), y: Math.round(node.y), width: Math.round(node.width), height: Math.round(node.height) };
      if (node.type === 'TEXT') item.text = node.characters.slice(0, 500);
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
function inspectSelection(): void { figma.ui.postMessage({ type:'selection', summary:getSelectionSummary() }); }

async function applyPatch(patch: EditPatch): Promise<void> {
  const targets = new Map<string, SceneNode>();
  const visit = (node: SceneNode) => {
    const id = logicalIds.get(node.id) || node.id;
    targets.set(id, node);
    if ('children' in node) for (const child of node.children) visit(child);
  };
  for (const node of figma.currentPage.selection) visit(node);
  const resolved = patch.operations.map((operation) => {
    const target = targets.get(operation.targetId);
    if (!target) throw new Error(`Patch target not found in the current selection: ${operation.targetId}`);
    if (operation.op === 'rename') return { operation, target };
    if (operation.op === 'set-bounds') {
      if (!('resize' in target) || !('x' in target) || !('y' in target)) throw new Error(`Target ${operation.targetId} does not support position and size edits.`);
      return { operation, target };
    }
    if (operation.op === 'set-fill') {
      if (!('fills' in target)) throw new Error(`Target ${operation.targetId} does not support fill.`);
      if (!/^#[0-9a-f]{6}$/i.test(operation.value)) throw new Error(`Invalid fill color for ${operation.targetId}.`);
      return { operation, target };
    } else if (operation.op === 'set-text') {
      if (target.type !== 'TEXT') throw new Error(`Target ${operation.targetId} is not text.`);
      return { operation, target };
    }
    throw new Error('Unsupported patch operation.');
  });
  for (const item of resolved) if (item.operation.op === 'set-text') {
    const text = item.target as TextNode;
    const font = text.fontName === figma.mixed ? { family: 'Inter', style: 'Regular' } : text.fontName;
    await figma.loadFontAsync(font as FontName);
  }
  const snapshots: PatchSnapshot[] = resolved.map(({target}) => ({target, name: target.name, fills: 'fills' in target ? target.fills as readonly Paint[] | PluginAPI['mixed'] : undefined, text: target.type === 'TEXT' ? (target as TextNode).characters : undefined, x: 'x' in target ? target.x : undefined, y: 'y' in target ? target.y : undefined, width: 'width' in target ? target.width : undefined, height: 'height' in target ? target.height : undefined}));
  try {
    for (const {operation,target} of resolved) {
      if (operation.op === 'rename') target.name = operation.value;
      else if (operation.op === 'set-bounds' && 'resize' in target && 'x' in target && 'y' in target) { target.resize(operation.value.width, operation.value.height); target.x = operation.value.x; target.y = operation.value.y; }
      else if (operation.op === 'set-fill' && 'fills' in target) target.fills = [paint(operation.value)];
      else if (operation.op === 'set-text' && target.type === 'TEXT') (target as TextNode).characters = operation.value;
    }
  } catch (error) {
    restoreSnapshots(snapshots);
    throw error;
  }
  patchCheckpoints.push(snapshots);
  if (patchCheckpoints.length > 20) patchCheckpoints.shift();
}

function restoreSnapshots(snapshots: PatchSnapshot[]): void {
  for (const snapshot of [...snapshots].reverse()) {
    const { target } = snapshot;
    if (target.removed) continue;
    target.name = snapshot.name;
    if (snapshot.fills !== undefined && 'fills' in target) target.fills = snapshot.fills as typeof target.fills;
    if (snapshot.text !== undefined && target.type === 'TEXT') (target as TextNode).characters = snapshot.text;
    if (snapshot.x !== undefined && snapshot.y !== undefined && snapshot.width !== undefined && snapshot.height !== undefined && 'resize' in target && 'x' in target && 'y' in target) { target.resize(snapshot.width, snapshot.height); target.x = snapshot.x; target.y = snapshot.y; }
  }
}

function undoPatch(): void {
  const snapshot = patchCheckpoints.pop();
  if (!snapshot) throw new Error('There is no plugin patch checkpoint to revert in this session.');
  try { restoreSnapshots(snapshot); }
  catch (error) { patchCheckpoints.push(snapshot); throw error; }
  figma.ui.postMessage({ type: 'patch-result', ok: true, message: 'The latest plugin patch was reverted.', undoCount: patchCheckpoints.length });
}

function applyColorToSelection(color: string): void {
  const matches = figma.currentPage.selection.filter((node) => 'fills' in node && Array.isArray(node.fills));
  if (!matches.length) throw new Error('Select at least one shape or frame with a solid fill.');
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error('Color must be a six-digit hex value.');
  for (const node of matches) if ('fills' in node) node.fills = [paint(color)];
}

function solidFillHex(node: SceneNode): string | undefined {
  if (!('fills' in node)) return undefined;
  const fills = node.fills;
  if (fills === figma.mixed) throw new Error(`Layer "${node.name}" has mixed fills that cannot be represented in schema 1.0.`);
  const fill = fills.find((item) => item.visible !== false && (item.opacity ?? 1) > 0);
  if (!fill) return undefined;
  if (fill.type !== 'SOLID') throw new Error(`Layer "${node.name}" uses ${fill.type.toLowerCase()} fill, which schema 1.0 export does not support yet.`);
  if ((fill.opacity ?? 1) !== 1) throw new Error(`Layer "${node.name}" has a translucent fill that schema 1.0 export cannot preserve yet.`);
  const { r, g, b } = fill.color;
  return `#${[r,g,b].map((value) => Math.round(value * 255).toString(16).padStart(2,'0')).join('')}`;
}

function exportSelectedDesign(): DesignSpec {
  if (figma.currentPage.selection.length !== 1) throw new Error('Select exactly one Figma layer or frame to export as a design specification.');
  const selected = figma.currentPage.selection[0]!;
  if (!('width' in selected) || !('height' in selected)) throw new Error('The selected item does not have exportable design dimensions.');
  let count = 0;
  const convert = (node: SceneNode, depth: number): DesignNodeSpec => {
    count += 1;
    if (count > MAX_NODES) throw new Error(`Selected design exceeds the ${MAX_NODES}-layer export limit.`);
    if (depth > MAX_DEPTH) throw new Error(`Selected design exceeds the ${MAX_DEPTH}-level nesting limit.`);
    if (!['TEXT','RECTANGLE','ELLIPSE','LINE','FRAME','GROUP'].includes(node.type)) throw new Error(`Layer "${node.name}" (${node.type}) cannot be represented in schema 1.0. Export a frame containing only supported native layers.`);
    const supported = node as SceneNode & { x:number; y:number; width:number; height:number; opacity:number };
    const fill = solidFillHex(node);
    const base = { id: logicalIds.get(node.id) || `figma-${node.id}`, name: node.name.slice(0,160), x: Math.round(supported.x), y: Math.round(supported.y), width: Math.max(.01,Math.round(supported.width*100)/100), height: Math.max(.01,Math.round(supported.height*100)/100), opacity: supported.opacity, ...(fill?{fill}:{}) };
    if (node.type === 'TEXT') {
      const font = node.fontName === figma.mixed ? undefined : node.fontName;
      const lineHeight = typeof node.lineHeight === 'object' && node.lineHeight.unit === 'PIXELS' ? node.lineHeight.value : undefined;
      const color = solidFillHex(node);
      return { ...base, type:'text', text:node.characters.slice(0,20_000), ...(font?{fontFamily:font.family}:{}), ...(typeof node.fontSize==='number'?{fontSize:node.fontSize}:{}), ...(lineHeight!==undefined?{lineHeight}:{}), ...(color?{color}:{}), align:node.textAlignHorizontal };
    }
    if (node.type === 'RECTANGLE' || node.type === 'ELLIPSE') {
      const radius = node.type === 'RECTANGLE' && typeof node.cornerRadius === 'number' ? node.cornerRadius : undefined;
      return { ...base, type:node.type === 'RECTANGLE'?'rectangle':'ellipse', ...(radius!==undefined?{radius}:{}) };
    }
    if (node.type === 'LINE') {
      const stroke = node.strokes.find((item) => item.visible !== false && (item.opacity ?? 1) > 0);
      if (stroke && stroke.type !== 'SOLID') throw new Error(`Layer "${node.name}" uses an unsupported line stroke.`);
      const color = stroke?.type === 'SOLID' ? `#${[stroke.color.r,stroke.color.g,stroke.color.b].map((value)=>Math.round(value*255).toString(16).padStart(2,'0')).join('')}` : undefined;
      return { ...base, type:'line', ...(color?{stroke:color}:{}), ...(typeof node.strokeWeight==='number'?{strokeWidth:node.strokeWeight}:{}) };
    }
    if (node.type === 'FRAME' || node.type === 'GROUP') {
      const children = node.children.map((child) => convert(child, depth + 1));
      if (node.type === 'FRAME') {
        const frame = node;
        if (frame.layoutMode !== 'NONE' && [frame.paddingRight,frame.paddingBottom,frame.paddingLeft].some((value)=>value!==frame.paddingTop)) throw new Error(`Auto Layout frame "${node.name}" uses asymmetric padding that schema 1.0 cannot preserve yet.`);
        if (frame.layoutMode !== 'NONE' && !['MIN','CENTER','MAX','SPACE_BETWEEN'].includes(frame.primaryAxisAlignItems)) throw new Error(`Auto Layout frame "${node.name}" uses an alignment that schema 1.0 cannot preserve yet.`);
        const layout = frame.layoutMode === 'NONE' ? undefined : { mode:frame.layoutMode==='HORIZONTAL'?'horizontal' as const:'vertical' as const, gap:frame.itemSpacing, padding:frame.paddingTop, alignment:frame.primaryAxisAlignItems as 'MIN'|'CENTER'|'MAX'|'SPACE_BETWEEN', primaryAxisSizing:frame.primaryAxisSizingMode, counterAxisSizing:frame.counterAxisSizingMode };
        const radius = typeof frame.cornerRadius === 'number' ? frame.cornerRadius : undefined;
        return { ...base, type:'frame', children, ...(layout?{layout}:{}), ...(radius!==undefined?{radius}:{}) };
      }
      return { ...base, type:'group', children };
    }
    throw new Error(`Layer "${node.name}" (${node.type}) cannot be represented in schema 1.0. Export a frame containing only supported native layers.`);
  };
  const spec: DesignSpec = { schemaVersion:'1.0', name:selected.name.slice(0,160), pages:[{ id:`export-page-${selected.id}`, name:figma.currentPage.name.slice(0,160), children:[convert(selected,1)] }] };
  const result = validateDesignSpec(spec);
  if (!result.valid) throw new Error(`Selection export failed validation: ${result.issues.map((issue)=>`${issue.path}: ${issue.message}`).join('; ')}`);
  return spec;
}

async function bridgeRequest<T>(path:string,method:'GET'|'POST',body?:unknown):Promise<T>{
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),5000);
  try{
    const response=await fetch(`${bridgeEndpoint}${path}`,{method,headers:{Authorization:`Bearer ${bridgeToken}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal});
    const data=await response.json() as T & {error?:{code?:string;message?:string}};
    if(!response.ok)throw new Error(`${data.error?.code??'BRIDGE_HTTP_ERROR'}: ${data.error?.message??`Bridge returned ${response.status}.`}`);
    return data;
  }finally{clearTimeout(timeout);}
}
async function maintainBridgeHeartbeat():Promise<void>{
  if(!bridgeRegistered||!bridgeToken||bridgeHeartbeatInFlight||Date.now()-bridgeHeartbeatAt<5000)return;
  bridgeHeartbeatInFlight=true;
  try{await bridgeRequest('/bridge/sessions/heartbeat','POST',{sessionId:bridgeSessionId});bridgeHeartbeatAt=Date.now();}
  catch{bridgeRegistered=false;}
  finally{bridgeHeartbeatInFlight=false;}
}
function bridgeStatus(status:Extract<HostToUi,{type:'agent-status'}>['status'],details:Partial<Extract<HostToUi,{type:'agent-status'}>>={}):void{
  figma.ui.postMessage({type:'agent-status',status,...(bridgeSessionId?{sessionId:bridgeSessionId}:{}),...details});
}
function bridgeOperationLabel(operation:BridgeOperation):string{
  if(operation.type==='inspect-selection')return 'Inspecting selection';
  if(operation.type==='render-spec')return `Inserting ${operation.spec.name}`;
  if(operation.type==='apply-patch')return `Applying ${operation.patch.operations.length} reviewed edit(s)`;
  if(operation.type==='insert-svg')return `Importing SVG ${operation.name}`;
  if(operation.type==='insert-image')return `Importing image ${operation.name}`;
  return 'Exporting selected design';
}
async function executeBridgeJob(job:BridgeJob,epoch:number):Promise<void>{
  const operation=job.operation;const label=bridgeOperationLabel(operation);const startedAt=Date.now();
  bridgeStatus('working',{jobId:job.jobId,agentLabel:job.agentLabel,operation:label});
  figma.ui.postMessage({type:'agent-event',id:`${job.jobId}-started`,jobId:job.jobId,agentLabel:job.agentLabel,operation:label,status:'started',timestamp:startedAt,message:'Plugin accepted the queued operation.'});
  try{
    let result:unknown;
    if(operation.type==='inspect-selection')result={summary:getSelectionSummary()};
    else if(operation.type==='render-spec')result={created:await renderSpec(operation.spec,'Inter'),message:'Editable Figma layers were inserted.'};
    else if(operation.type==='apply-patch'){await applyPatch(operation.patch);result={message:'Patch applied to selected layers.',undoCount:patchCheckpoints.length};}
    else if(operation.type==='insert-svg'){const asset=insertSvg(operation.name,operation.svg);result=asset;figma.ui.postMessage({type:'asset-result',ok:true,message:'MCP supplied SVG imported as editable vector geometry.',...asset});}
    else if(operation.type==='insert-image'){const asset=insertRaster(operation.name,operation.mimeType,operation.bytes);result=asset;figma.ui.postMessage({type:'asset-result',ok:true,message:'MCP supplied image imported as native image fill.',...asset});}
    else result={spec:exportSelectedDesign()};
    if(epoch!==bridgeEpoch)return;
    await bridgeRequest(`/bridge/jobs/${job.jobId}/result`,'POST',{sessionId:bridgeSessionId,ok:true,result});
    figma.ui.postMessage({type:'agent-event',id:`${job.jobId}-completed`,jobId:job.jobId,agentLabel:job.agentLabel,operation:label,status:'completed',timestamp:Date.now(),message:`Operation completed in ${Date.now()-startedAt} ms.`});
    bridgeStatus('connected');
  }catch(error){
    if(epoch!==bridgeEpoch)return;
    const message=error instanceof Error?error.message:'Plugin operation failed.';
    try{await bridgeRequest(`/bridge/jobs/${job.jobId}/result`,'POST',{sessionId:bridgeSessionId,ok:false,error:{code:message.startsWith('RENDER_CANCELLED:')?'RENDER_CANCELLED':'PLUGIN_OPERATION_FAILED',message}});}catch{/* A dropped bridge session will show disconnected on the next poll. */}
    figma.ui.postMessage({type:'agent-event',id:`${job.jobId}-failed`,jobId:job.jobId,agentLabel:job.agentLabel,operation:label,status:'failed',timestamp:Date.now(),message});
    bridgeStatus('connected');
  }
}
async function bridgeLoop(epoch:number):Promise<void>{
  while(epoch===bridgeEpoch&&bridgeToken){
    try{
      if(!bridgeRegistered){await bridgeRequest('/bridge/sessions/connect','POST',{sessionId:bridgeSessionId,pluginVersion:'0.2.0'});bridgeRegistered=true;}
      else {await bridgeRequest('/bridge/sessions/heartbeat','POST',{sessionId:bridgeSessionId});bridgeHeartbeatAt=Date.now();}
      bridgeStatus('connected');
      const {job}=await bridgeRequest<{job:BridgeJob|null}>(`/bridge/sessions/${bridgeSessionId}/jobs/next`,'GET');
      if(job)await executeBridgeJob(job,epoch);
      else await new Promise((resolve)=>setTimeout(resolve,900));
    }catch(error){
      if(epoch!==bridgeEpoch)return;
      bridgeRegistered=false;
      bridgeStatus('error',{message:error instanceof Error?error.message:'Local bridge connection failed.'});
      await new Promise((resolve)=>setTimeout(resolve,1800));
    }
  }
}
function configureBridge(endpoint:string,token:string):void{
  bridgeEpoch+=1;bridgeToken='';bridgeRegistered=false;bridgeHeartbeatAt=0;
  try{
    const url=new URL(endpoint);
    if(url.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||url.port!=='8788'||url.pathname!=='/')throw new Error('Use the local bridge endpoint http://localhost:8788.');
    if(!/^[a-f0-9]{64}$/i.test(token))throw new Error('Paste the 64-character pairing token from the local bridge token file.');
    bridgeEndpoint=url.origin;bridgeToken=token;
    if(!bridgeSessionId)bridgeSessionId=`figma-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
    bridgeStatus('connecting',{message:'Connecting to the local agent bridge…'});
    void bridgeLoop(bridgeEpoch);
  }catch(error){bridgeStatus('disconnected',{message:error instanceof Error?error.message:'Bridge is not configured.'});}
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
    if(message.type==='configure-bridge'){configureBridge(message.endpoint,message.token);return;}
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
      const spec = exportSelectedDesign();
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
      const result=insertSvg(message.name,message.svg);
      figma.ui.postMessage({type:'asset-result',ok:true,message:'Sanitized SVG imported as an editable Figma vector frame.',...result});
    }
    if(message.type==='import-image'){
      const result=insertRaster(message.name,message.mimeType,message.bytes);
      figma.ui.postMessage({type:'asset-result',ok:true,message:'Image imported as a native editable Figma image fill.',...result});
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

figma.on('run', inspectSelection);
