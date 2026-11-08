import Ajv from 'ajv';
import designSpecSchema from '../../schema/design-spec-1.0.schema.json' with { type: 'json' };
import { utf8ByteLength } from './utf8';

export type LayoutSpec = {
  mode: 'none' | 'horizontal' | 'vertical';
  gap?: number;
  padding?: number;
  alignment?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
  primaryAxisSizing?: 'AUTO' | 'FIXED';
  counterAxisSizing?: 'AUTO' | 'FIXED';
};

type BaseNode = {
  id: string;
  name: string;
  x?: number;
  y?: number;
  width: number;
  height: number;
  fill?: string;
  radius?: number;
  opacity?: number;
};
export type TextNodeSpec = BaseNode & {
  type: 'text';
  text: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  lineHeight?: number;
  color?: string;
  align?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
};
export type ContainerNodeSpec = BaseNode & {
  type: 'frame' | 'group';
  children: DesignNodeSpec[];
  layout?: LayoutSpec;
};
export type ShapeNodeSpec = BaseNode & { type: 'rectangle' | 'ellipse' };
export type LineNodeSpec = BaseNode & { type: 'line'; stroke?: string; strokeWidth?: number };
export type DesignNodeSpec = TextNodeSpec | ContainerNodeSpec | ShapeNodeSpec | LineNodeSpec;
export type PageSpec = { id: string; name: string; children: DesignNodeSpec[] };
export type DesignSpec = { schemaVersion: '1.0'; name: string; pages: PageSpec[] };

export const MAX_SPEC_BYTES = 512_000;
export const MAX_NODES = 2_000;
export const MAX_DEPTH = 16;

const ajv = new Ajv({ allErrors: true, strict: false });
const validateSchema = ajv.compile(designSpecSchema);

export type ValidationIssue = { path: string; message: string };
export type ValidationResult = { valid: boolean; issues: ValidationIssue[]; value?: DesignSpec };
export type DesignQualityFinding = { path: string; severity: 'warning' | 'suggestion'; message: string };
const supportedNodeTypes = ['frame', 'group', 'text', 'rectangle', 'ellipse', 'line'] as const;

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
  const issues: ValidationIssue[] = [];
  let nodes = 0;
  const addId = (id: string, path: string) => {
    if (seen.has(id)) issues.push({ path, message: `Duplicate logical id: ${id}` });
    seen.add(id);
  };
  const allowed: Record<DesignNodeSpec['type'], string[]> = {
    frame: ['type','id','name','x','y','width','height','fill','radius','opacity','children','layout'],
    group: ['type','id','name','x','y','width','height','fill','radius','opacity','children','layout'],
    text: ['type','id','name','x','y','width','height','fill','radius','opacity','text','fontFamily','fontSize','fontWeight','lineHeight','color','align'],
    rectangle: ['type','id','name','x','y','width','height','fill','radius','opacity'],
    ellipse: ['type','id','name','x','y','width','height','fill','radius','opacity'],
    line: ['type','id','name','x','y','width','height','fill','radius','opacity','stroke','strokeWidth'],
  };
  const visit = (node: DesignNodeSpec, path: string, depth: number) => {
    nodes += 1;
    if (nodes > MAX_NODES) { issues.push({ path, message: `Document exceeds ${MAX_NODES} nodes.` }); return; }
    if (depth > MAX_DEPTH) { issues.push({ path, message: `Layer depth exceeds ${MAX_DEPTH}.` }); return; }
    addId(node.id, `${path}.id`);
    for (const key of Object.keys(node)) if (!allowed[node.type].includes(key)) issues.push({ path: `${path}.${key}`, message: 'Unsupported property.' });
    if (node.type === 'frame' || node.type === 'group') node.children.forEach((child, index) => visit(child, `${path}.children[${index}]`, depth + 1));
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
    if ((node.type === 'frame' || node.type === 'group') && node.children.length >= 3 && (!node.layout || node.layout.mode === 'none')) {
      findings.push({ path: `${path}.layout`, severity: 'suggestion', message: 'This container has several children but no Auto Layout; consider using a consistent gap and padding.' });
    }
    if (node.type === 'frame' || node.type === 'group') node.children.forEach((child, index) => visit(child, `${path}.children[${index}]`, background));
  };
  spec.pages.forEach((page, p) => page.children.forEach((node, n) => visit(node, `pages[${p}].children[${n}]`)));
  return findings;
}
