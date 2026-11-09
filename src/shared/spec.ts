import Ajv from 'ajv';
import designSpecSchema from '../../schema/design-spec-1.0.schema.json' with { type: 'json' };
import { utf8ByteLength } from './utf8';
import { decodeBase64 } from './base64';
import { validateRasterAsset } from './assets';

export type LayoutSpec = {
  mode: 'none' | 'horizontal' | 'vertical';
  gap?: number;
  padding?: number;
  alignment?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
  primaryAxisSizing?: 'AUTO' | 'FIXED';
  counterAxisSizing?: 'AUTO' | 'FIXED';
};
export type GradientSpec = { direction: 'horizontal' | 'vertical'; transform?: [[number,number,number],[number,number,number]]; stops: Array<{ position: number; color: string; opacity?: number }> };
export type RadialGradientSpec = { transform: [[number,number,number],[number,number,number]]; stops: Array<{ position: number; color: string; opacity?: number }> };
export type PaintStackItemSpec = { type: 'solid'; color: string; opacity?: number } | { type: 'linear-gradient'; gradient: GradientSpec; opacity?: number } | { type:'radial-gradient'; gradient:RadialGradientSpec; opacity?:number } | { type:'angular-gradient'; gradient:RadialGradientSpec; opacity?:number } | { type:'diamond-gradient'; gradient:RadialGradientSpec; opacity?:number } | { type:'image'; mimeType:'image/png'|'image/jpeg'; data:string; scaleMode?:'FIT'|'FILL'|'CROP'|'TILE'; imageTransform?:[[number,number,number],[number,number,number]]; scalingFactor?:number; opacity?:number };
export type CornerRadiiSpec = { topLeft:number; topRight:number; bottomRight:number; bottomLeft:number };
export type ShadowSpec = { color: string; opacity: number; offsetX: number; offsetY: number; blur: number; spread?: number };
export type EffectSpec = { type: 'drop-shadow'|'inner-shadow'; color: string; opacity: number; offsetX: number; offsetY: number; blur: number; spread?: number } | { type: 'layer-blur'|'background-blur'; blur: number } | { type:'progressive-layer-blur'; startRadius:number; endRadius:number; startOffset:{x:number;y:number}; endOffset:{x:number;y:number} } | { type:'progressive-background-blur'; startRadius:number; endRadius:number; startOffset:{x:number;y:number}; endOffset:{x:number;y:number} };
export type ConstraintsSpec = { horizontal: 'MIN'|'CENTER'|'MAX'|'STRETCH'|'SCALE'; vertical: 'MIN'|'CENTER'|'MAX'|'STRETCH'|'SCALE' };
export type GridSpec = { pattern: 'GRID'; sectionSize: number; visible?: boolean } | { pattern: 'COLUMNS'|'ROWS'; sectionSize?: number; gutterSize: number; count: number; offset?: number; alignment?: 'MIN'|'CENTER'|'MAX'|'STRETCH'; visible?: boolean };
export type ColorTokenSpec = { name: string; color: string };
export type TextStyleTokenSpec = { name: string; fontFamily: string; fontSize: number; fontWeight: number; lineHeight?: number; paragraphSpacing?: number; letterSpacing?: LetterSpacingSpec; textDecoration?: 'NONE'|'UNDERLINE'|'STRIKETHROUGH'; textCase?: 'ORIGINAL'|'UPPER'|'LOWER'|'TITLE'|'SMALL_CAPS'|'SMALL_CAPS_FORCED' };

type BaseNode = {
  id: string;
  name: string;
  x?: number;
  y?: number;
  rotation?:number;
  width: number;
  height: number;
  fill?: string;
  radius?: number;
  opacity?: number;
  gradient?: GradientSpec;
  paints?: PaintStackItemSpec[];
  shadow?: ShadowSpec;
  shadows?: ShadowSpec[];
  effects?: EffectSpec[];
  constraints?: ConstraintsSpec;
  fillToken?: string;
};
export type LetterSpacingSpec = { unit: 'PIXELS'|'PERCENT'; value: number };
export type TextNodeSpec = BaseNode & {
  type: 'text';
  text: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  lineHeight?: number;
  letterSpacing?: LetterSpacingSpec;
  paragraphSpacing?: number;
  textAlignVertical?: 'TOP'|'CENTER'|'BOTTOM';
  textAutoResize?: 'NONE'|'WIDTH_AND_HEIGHT'|'HEIGHT'|'TRUNCATE';
  textDecoration?: 'NONE'|'UNDERLINE'|'STRIKETHROUGH';
  textCase?: 'ORIGINAL'|'UPPER'|'LOWER'|'TITLE'|'SMALL_CAPS'|'SMALL_CAPS_FORCED';
  color?: string;
  align?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
  textStyleToken?: string;
};
export type ContainerNodeSpec = (BaseNode & { type: 'frame'; children: DesignNodeSpec[]; layout?: LayoutSpec; layoutGrids?: GridSpec[]; clipsContent?:boolean; cornerRadii?:CornerRadiiSpec; cornerSmoothing?:number }) | (BaseNode & { type: 'group'; children: DesignNodeSpec[]; layout?: LayoutSpec });
export type ComponentNodeSpec = BaseNode & { type: 'component'; children: DesignNodeSpec[]; layout?: LayoutSpec; layoutGrids?: GridSpec[]; clipsContent?:boolean; cornerRadii?:CornerRadiiSpec; cornerSmoothing?:number };
export type InstanceNodeSpec = BaseNode & { type: 'instance'; componentRef: string };
export type VectorNodeSpec = BaseNode & { type: 'vector'; path: string };
export type ImageNodeSpec = BaseNode & { type: 'image'; mimeType: 'image/png'|'image/jpeg'; data: string; scaleMode?: 'FIT'|'FILL'|'CROP'|'TILE'; imageTransform?:[[number,number,number],[number,number,number]]; scalingFactor?:number };
export type ShapeNodeSpec = BaseNode & ({ type:'rectangle'; cornerRadii?:CornerRadiiSpec; cornerSmoothing?:number; stroke?:string; strokeOpacity?:number; strokeWidth?:number; strokeAlign?:'INSIDE'|'CENTER'|'OUTSIDE' }|{type:'ellipse';stroke?:string;strokeOpacity?:number;strokeWidth?:number;strokeAlign?:'INSIDE'|'CENTER'|'OUTSIDE'});
export type LineNodeSpec = BaseNode & { type: 'line'; stroke?: string; strokeOpacity?:number; strokeWidth?: number };
export type DesignNodeSpec = TextNodeSpec | ContainerNodeSpec | ComponentNodeSpec | InstanceNodeSpec | VectorNodeSpec | ImageNodeSpec | ShapeNodeSpec | LineNodeSpec;
export type DesignSystemSpec = { name?: string; colors?: ColorTokenSpec[]; typography?: TextStyleTokenSpec[] };
export type PageSpec = { id: string; name: string; children: DesignNodeSpec[] };
export type DesignSpec = { schemaVersion: '1.0'; name: string; pages: PageSpec[]; designSystem?: DesignSystemSpec };

export const MAX_SPEC_BYTES = 512_000;
export const MAX_EMBEDDED_IMAGE_BYTES = 256 * 1024;
export const MAX_NODES = 2_000;
export const MAX_DEPTH = 16;

const ajv = new Ajv({ allErrors: true, strict: false });
const validateSchema = ajv.compile(designSpecSchema);

export type ValidationIssue = { path: string; message: string };
export type ValidationResult = { valid: boolean; issues: ValidationIssue[]; value?: DesignSpec };
export type DesignQualityFinding = { path: string; severity: 'warning' | 'suggestion'; message: string };
const supportedNodeTypes = ['frame', 'group', 'component', 'instance', 'vector', 'image', 'text', 'rectangle', 'ellipse', 'line'] as const;

function valueAtInstancePath(input: unknown, instancePath: string): unknown {
  return instancePath.split('/').slice(1).reduce<unknown>((value, segment) => {
    if (!value || typeof value !== 'object') return undefined;
    const key = segment.replace(/~1/g, '/').replace(/~0/g, '~');
    return (value as Record<string, unknown>)[key];
  }, input);
}

export function validateDesignSpec(input: unknown, rawBytes?: number): ValidationResult {
  let serialized: string | undefined;
  if (rawBytes === undefined) {
    try { serialized = JSON.stringify(input); }
    catch { return { valid: false, issues: [{ path: '$', message: 'Specification must not contain circular references.' }] }; }
    if (serialized === undefined) return { valid: false, issues: [{ path: '$', message: 'Specification must be a JSON-compatible object.' }] };
  }
  const size = rawBytes ?? utf8ByteLength(serialized!);
  if (size > MAX_SPEC_BYTES) return { valid: false, issues: [{ path: '$', message: `Specification exceeds ${MAX_SPEC_BYTES} bytes.` }] };
  if (!validateSchema(input)) {
    const errors = validateSchema.errors ?? [];
    const unsupportedTypes = new Map<string, string>();
    for (const error of errors) {
      if (error.keyword !== 'oneOf') continue;
      const candidate = valueAtInstancePath(input, error.instancePath);
      if (!candidate || typeof candidate !== 'object' || !('type' in candidate)) continue;
      const type = (candidate as {type?:unknown}).type;
      if (typeof type === 'string' && !supportedNodeTypes.includes(type as typeof supportedNodeTypes[number])) {
        unsupportedTypes.set(error.instancePath, `Unsupported layer type "${type}". Use one of: ${supportedNodeTypes.join(', ')}.`);
      }
    }
    const issues: ValidationIssue[] = [...unsupportedTypes].map(([path,message]) => ({path:path||'$',message}));
    for (const error of errors) {
      if ([...unsupportedTypes.keys()].some((path) => error.instancePath === path || error.instancePath.startsWith(`${path}/`))) continue;
      issues.push({ path: error.instancePath || '$', message: error.message ?? 'Invalid value' });
    }
    return { valid: false, issues };
  }
  const spec = input as DesignSpec;
  const seen = new Set<string>();
  const componentIds = new Set<string>();
  const issues: ValidationIssue[] = [];
  let nodes = 0;
  const addId = (id: string, path: string) => {
    if (seen.has(id)) issues.push({ path, message: `Duplicate logical id: ${id}` });
    seen.add(id);
  };
  const allowed: Record<DesignNodeSpec['type'], string[]> = {
    frame: ['type','id','name','x','y','width','height','rotation','fill','radius','opacity','gradient','paints','shadow','shadows','effects','children','layout','layoutGrids','clipsContent','cornerRadii','cornerSmoothing','constraints','fillToken'],
    group: ['type','id','name','x','y','width','height','rotation','fill','radius','opacity','gradient','paints','shadow','shadows','effects','children','layout','constraints','fillToken'],
    component: ['type','id','name','x','y','width','height','rotation','fill','radius','opacity','gradient','paints','shadow','shadows','effects','children','layout','layoutGrids','clipsContent','cornerRadii','cornerSmoothing','constraints','fillToken'],
    instance: ['type','id','name','x','y','width','height','rotation','opacity','componentRef','constraints'],
    vector: ['type','id','name','x','y','width','height','rotation','fill','opacity','shadow','shadows','effects','paints','path','constraints'],
    image: ['type','id','name','x','y','width','height','rotation','opacity','mimeType','data','scaleMode','imageTransform','scalingFactor','constraints'],
    text: ['type','id','name','x','y','width','height','rotation','fill','radius','opacity','gradient','paints','shadow','shadows','effects','text','fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','paragraphSpacing','textAlignVertical','textAutoResize','textDecoration','textCase','color','align','textStyleToken','constraints','fillToken'],
    rectangle: ['type','id','name','x','y','width','height','rotation','fill','radius','cornerRadii','cornerSmoothing','opacity','gradient','paints','shadow','shadows','effects','constraints','fillToken','stroke','strokeOpacity','strokeWidth','strokeAlign'],
    ellipse: ['type','id','name','x','y','width','height','rotation','fill','radius','opacity','gradient','paints','shadow','shadows','effects','constraints','fillToken','stroke','strokeOpacity','strokeWidth','strokeAlign'],
    line: ['type','id','name','x','y','width','height','rotation','fill','radius','opacity','stroke','strokeOpacity','strokeWidth','constraints'],
  };
  const colors = new Set((spec.designSystem?.colors ?? []).map((token) => token.name));
  const typography = new Set((spec.designSystem?.typography ?? []).map((token) => token.name));
  const visit = (node: DesignNodeSpec, path: string, depth: number) => {
    nodes += 1;
    if (nodes > MAX_NODES) { issues.push({ path, message: `Document exceeds ${MAX_NODES} nodes.` }); return; }
    if (depth > MAX_DEPTH) { issues.push({ path, message: `Layer depth exceeds ${MAX_DEPTH}.` }); return; }
    addId(node.id, `${path}.id`);
    for (const key of Object.keys(node)) if (!allowed[node.type].includes(key)) issues.push({ path: `${path}.${key}`, message: 'Unsupported property.' });
    if(node.rotation!==undefined&&(!Number.isFinite(node.rotation)||node.rotation < -180||node.rotation > 180))issues.push({path:`${path}.rotation`,message:'Rotation must be between -180 and 180 degrees.'});
    if(node.radius!==undefined&&'cornerRadii' in node&&node.cornerRadii!==undefined)issues.push({path:`${path}.cornerRadii`,message:'Use radius or cornerRadii, not both.'});
    if('cornerRadii' in node&&node.cornerRadii&&Object.entries(node.cornerRadii).some(([,value])=>!Number.isFinite(value)||value<0||value>10000))issues.push({path:`${path}.cornerRadii`,message:'Corner radii must be between 0 and 10,000.'});
    if('cornerSmoothing' in node&&node.cornerSmoothing!==undefined&&(!Number.isFinite(node.cornerSmoothing)||node.cornerSmoothing<0||node.cornerSmoothing>1))issues.push({path:`${path}.cornerSmoothing`,message:'Corner smoothing must be between 0 and 1.'});
    if ((node.type==='rectangle'||node.type==='ellipse'||node.type==='line') && node.strokeOpacity!==undefined && !node.stroke) issues.push({path:`${path}.strokeOpacity`,message:'strokeOpacity requires a stroke color.'});
    if (node.fillToken && !colors.has(node.fillToken)) issues.push({ path: `${path}.fillToken`, message: `Unknown color token: ${node.fillToken}` });
    if (node.paints && (node.fill !== undefined || node.gradient !== undefined)) issues.push({ path: `${path}.paints`, message: 'Use either paints or the legacy fill/gradient fields, not both.' });
    if (node.shadows && node.shadow !== undefined) issues.push({ path: `${path}.shadows`, message: 'Use either shadows or the legacy shadow field, not both.' });
    if (node.effects && (node.shadow !== undefined || node.shadows !== undefined)) issues.push({ path: `${path}.effects`, message: 'Use either effects or the legacy shadow/shadows fields, not both.' });
    if (node.type === 'text' && node.textStyleToken && !typography.has(node.textStyleToken)) issues.push({ path: `${path}.textStyleToken`, message: `Unknown text style token: ${node.textStyleToken}` });
    if(node.type==='group'&&'layoutGrids' in node)issues.push({path:`${path}.layoutGrids`,message:'Layout grids can only be attached to frames or components.'});
    if (node.type === 'image') {
      try {
        const bytes = decodeBase64(node.data, MAX_EMBEDDED_IMAGE_BYTES);
        const image = validateRasterAsset(bytes, node.mimeType);
        if (image.mimeType !== node.mimeType) issues.push({ path: `${path}.mimeType`, message: 'Image MIME type does not match its data.' });
      } catch (error) { issues.push({ path: `${path}.data`, message: error instanceof Error ? error.message : 'Invalid embedded image.' }); }
    }
    if (node.type === 'frame' || node.type === 'group' || node.type === 'component') node.children.forEach((child, index) => visit(child, `${path}.children[${index}]`, depth + 1));
    if (node.type === 'component') componentIds.add(node.id);
    if (node.type === 'instance' && !componentIds.has(node.componentRef)) issues.push({ path: `${path}.componentRef`, message: `Component reference "${node.componentRef}" must point to a component declared earlier in the document.` });
    if (node.type === 'vector' && (!node.path.trim() || node.path.length > 8192 || !/^[\sMmLlHhVvCcSsQqTtAaZz0-9.,+\-]+$/.test(node.path) || !/[Mm]/.test(node.path))) issues.push({ path: `${path}.path`, message: 'Vector path must be a bounded SVG path using standard path commands and numbers only.' });
    if (node.gradient && (node.gradient.stops.length < 2 || node.gradient.stops.some((stop, index) => index > 0 && stop.position < node.gradient!.stops[index - 1]!.position))) issues.push({ path: `${path}.gradient.stops`, message: 'Gradient needs at least two stops ordered by position.' });
    const validStops=(stops:Array<{position:number}>):boolean=>stops.length>=2&&!stops.some((stop,index)=>index>0&&stop.position<stops[index-1]!.position);
    const validTransform=(matrix:[[number,number,number],[number,number,number]]):boolean=>Math.abs(matrix[0][0]*matrix[1][1]-matrix[0][1]*matrix[1][0])>1e-6;
    if(node.type==='image'&&node.imageTransform&&((node.scaleMode??'FIT')!=='CROP'||!validTransform(node.imageTransform)))issues.push({path:`${path}.imageTransform`,message:'Image transform is allowed only for CROP mode and must be invertible.'});
    if(node.type==='image'&&node.scalingFactor!==undefined&&((node.scaleMode??'FIT')!=='TILE'||!Number.isFinite(node.scalingFactor)||node.scalingFactor<=0||node.scalingFactor>10))issues.push({path:`${path}.scalingFactor`,message:'Image scalingFactor must be greater than 0 and at most 10, and is allowed only for TILE mode.'});
    if(node.gradient?.transform&&!validTransform(node.gradient.transform))issues.push({path:`${path}.gradient.transform`,message:'Gradient transform must be invertible.'});
    node.paints?.forEach((item,index)=>{
      if(item.type==='linear-gradient'&&(!validStops(item.gradient.stops)||(item.gradient.transform&&!validTransform(item.gradient.transform))))issues.push({path:`${path}.paints[${index}].gradient`,message:'Linear gradient needs ordered stops and an invertible optional transform.'});
      if((item.type==='radial-gradient'||item.type==='angular-gradient'||item.type==='diamond-gradient')&&(!validStops(item.gradient.stops)||!validTransform(item.gradient.transform)))issues.push({path:`${path}.paints[${index}].gradient`,message:'Transformed gradient needs ordered stops and an invertible transform.'});
    });
    node.paints?.forEach((item,index)=>{if(item.type!=='image')return;if(item.imageTransform&&((item.scaleMode??'FIT')!=='CROP'||!validTransform(item.imageTransform)))issues.push({path:`${path}.paints[${index}].imageTransform`,message:'Image transform is allowed only for CROP mode and must be invertible.'});if(item.scalingFactor!==undefined&&((item.scaleMode??'FIT')!=='TILE'||!Number.isFinite(item.scalingFactor)||item.scalingFactor<=0||item.scalingFactor>10))issues.push({path:`${path}.paints[${index}].scalingFactor`,message:'Image scalingFactor must be greater than 0 and at most 10, and is allowed only for TILE mode.'});try{const bytes=decodeBase64(item.data,MAX_EMBEDDED_IMAGE_BYTES);const image=validateRasterAsset(bytes,item.mimeType);if(image.mimeType!==item.mimeType)issues.push({path:`${path}.paints[${index}].mimeType`,message:'Image MIME type does not match its data.'});}catch(error){issues.push({path:`${path}.paints[${index}].data`,message:error instanceof Error?error.message:'Invalid embedded image paint.'});}});
  };
  spec.pages.forEach((page, p) => {
    addId(page.id, `pages[${p}].id`);
    page.children.forEach((node, n) => visit(node, `pages[${p}].children[${n}]`, 1));
  });
  return issues.length ? { valid: false, issues } : { valid: true, issues: [], value: spec };
}

export function parseDesignSpec(json: string): ValidationResult {
  if (utf8ByteLength(json) > MAX_SPEC_BYTES) return { valid: false, issues: [{ path: '$', message: `JSON exceeds ${MAX_SPEC_BYTES} bytes.` }] };
  const source = json.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return validateDesignSpec(JSON.parse(source), utf8ByteLength(source)); }
  catch { return { valid: false, issues: [{ path: '$', message: 'Invalid JSON syntax. Check commas, quotes, and braces.' }] }; }
}

/** Deterministic, advisory checks for common visual-quality problems. Never blocks import. */
export function auditDesignQuality(spec: DesignSpec): DesignQualityFinding[] {
  const findings: DesignQualityFinding[] = [];
  const genericName = /^(frame|group|rectangle|ellipse|text|layer|container)(\s*\d+)?$/i;
  const luminance = (hex: string): number => {
    const channels = hex.slice(1).match(/.{2}/g)!.map((part) => parseInt(part, 16) / 255)
      .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
  };
  const visit = (node: DesignNodeSpec, path: string, inheritedFill?: string) => {
    const background = node.type === 'text' ? inheritedFill : (node.fill ?? inheritedFill);
    if (genericName.test(node.name.trim())) findings.push({ path: `${path}.name`, severity: 'suggestion', message: 'Use a semantic layer name so the design is easier to edit in Figma.' });
    if (node.type === 'text') {
      if (!node.fontSize) findings.push({ path: `${path}.fontSize`, severity: 'suggestion', message: 'Set an explicit font size to preserve a consistent type hierarchy.' });
      const foreground = node.color ?? node.fill;
      if (foreground && background && /^#[\da-f]{6}$/i.test(foreground) && /^#[\da-f]{6}$/i.test(background)) {
        const a = luminance(foreground); const b = luminance(background); const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        if (ratio < 4.5) findings.push({ path: `${path}.color`, severity: 'warning', message: `Text contrast is approximately ${ratio.toFixed(1)}:1 against its nearest solid fill; check readability (WCAG AA normal-text target: 4.5:1).` });
      }
    }
    if ((node.type === 'frame' || node.type === 'group' || node.type === 'component') && node.children.length >= 3 && (!node.layout || node.layout.mode === 'none')) {
      findings.push({ path: `${path}.layout`, severity: 'suggestion', message: 'This container has several children but no Auto Layout; consider using a consistent gap and padding.' });
    }
    if (node.type === 'frame' || node.type === 'group' || node.type === 'component') node.children.forEach((child, index) => visit(child, `${path}.children[${index}]`, background));
  };
  spec.pages.forEach((page, p) => page.children.forEach((node, n) => visit(node, `pages[${p}].children[${n}]`)));
  return findings;
}
