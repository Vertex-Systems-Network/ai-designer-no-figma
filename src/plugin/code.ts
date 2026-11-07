import { validateDesignSpec, type DesignNodeSpec, type DesignSpec } from '../shared/spec';
import type { EditPatch, UiToHost } from '../shared/protocol';

figma.showUI(__html__, { width: 440, height: 720, themeColors: true });
let cancelActiveRender: (() => void) | undefined;

function rgb(hex: string): RGB {
  const value = hex.replace('#', '');
  return { r: parseInt(value.slice(0, 2), 16) / 255, g: parseInt(value.slice(2, 4), 16) / 255, b: parseInt(value.slice(4, 6), 16) / 255 };
}
function paint(hex: string): SolidPaint { return { type: 'SOLID', color: rgb(hex) }; }

type RenderControl = { cancelled: boolean; nodes: number };
async function renderNode(spec: DesignNodeSpec, parent: BaseNode & ChildrenMixin, control: RenderControl, fontFallback: string): Promise<SceneNode> {
  control.nodes += 1;
  if (control.nodes % 32 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
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
  node.setPluginData('ai-designer-id', spec.id);
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
  figma.currentPage = createdPages[0]!;
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

function inspectSelection(): void {
  const selected = figma.currentPage.selection[0];
  if (!selected || !('width' in selected) || !('height' in selected)) {
    figma.ui.postMessage({ type: 'selection', summary: null });
    return;
  }
  const nodes: Array<{id:string;name:string;type:string;text?:string;fill?:string}> = [];
  const collect = (node: SceneNode, depth: number) => {
    if (nodes.length >= 100 || depth > 5) return;
    const logicalId = node.getPluginData('ai-designer-id') || node.id;
    {
      const item: {id:string;name:string;type:string;text?:string;fill?:string} = { id: logicalId, name: node.name, type: node.type };
      if (node.type === 'TEXT') item.text = node.characters.slice(0, 500);
      if ('fills' in node && Array.isArray(node.fills) && node.fills[0]?.type === 'SOLID') {
        const c = node.fills[0].color; item.fill = `#${[c.r,c.g,c.b].map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('')}`;
      }
      nodes.push(item);
    }
    if ('children' in node) for (const child of node.children) collect(child, depth + 1);
  };
  collect(selected, 0);
  figma.ui.postMessage({ type: 'selection', summary: { name: selected.name, type: selected.type, width: Math.round(selected.width), height: Math.round(selected.height), layerCount: 'children' in selected ? countLayers(selected as BaseNode & ChildrenMixin) : 0, nodes } });
}

async function applyPatch(patch: EditPatch): Promise<void> {
  const targets = new Map<string, SceneNode>();
  const visit = (node: SceneNode) => {
    const id = node.getPluginData('ai-designer-id') || node.id;
    targets.set(id, node);
    if ('children' in node) for (const child of node.children) visit(child);
  };
  for (const node of figma.currentPage.selection) visit(node);
  const resolved = patch.operations.map((operation) => {
    const target = targets.get(operation.targetId);
    if (!target) throw new Error(`Patch target not found in the current selection: ${operation.targetId}`);
    if (operation.op === 'rename') return { operation, target };
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
  const snapshots = resolved.map(({target}) => ({target, name: target.name, fills: 'fills' in target ? target.fills as readonly Paint[] | PluginAPI['mixed'] : undefined, text: target.type === 'TEXT' ? (target as TextNode).characters : undefined}));
  try {
    for (const {operation,target} of resolved) {
      if (operation.op === 'rename') target.name = operation.value;
      else if (operation.op === 'set-fill' && 'fills' in target) target.fills = [paint(operation.value)];
      else if (operation.op === 'set-text' && target.type === 'TEXT') (target as TextNode).characters = operation.value;
    }
  } catch (error) {
    for (const snapshot of snapshots) {
      snapshot.target.name = snapshot.name;
      if (snapshot.fills !== undefined && 'fills' in snapshot.target) snapshot.target.fills = snapshot.fills as typeof snapshot.target.fills;
      if (snapshot.text !== undefined && snapshot.target.type === 'TEXT') (snapshot.target as TextNode).characters = snapshot.text;
    }
    throw error;
  }
}

function applyColorToSelection(color: string): void {
  const matches = figma.currentPage.selection.filter((node) => 'fills' in node && Array.isArray(node.fills));
  if (!matches.length) throw new Error('Select at least one shape or frame with a solid fill.');
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error('Color must be a six-digit hex value.');
  for (const node of matches) if ('fills' in node) node.fills = [paint(color)];
}

figma.on('selectionchange', inspectSelection);
figma.ui.onmessage = async (message: UiToHost) => {
  try {
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
    if (message.type === 'apply-patch') {
      await applyPatch(message.patch);
      figma.ui.postMessage({ type: 'patch-result', ok: true, message: 'Patch applied to the selected frame.' });
    }
    if (message.type === 'apply-color-selection') {
      applyColorToSelection(message.color);
      figma.ui.postMessage({ type: 'patch-result', ok: true, message: 'Color applied to the selected layers.' });
    }
  } catch (error) {
    figma.ui.postMessage({ type: 'error', code: 'PLUGIN_OPERATION_FAILED', message: error instanceof Error ? error.message : 'Plugin operation failed.' });
  }
};

figma.on('run', inspectSelection);
