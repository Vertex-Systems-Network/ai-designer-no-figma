import { describe, it, expect } from 'vitest';
import { parseWithMigration, angleTransform, linearTransform, normalizeColor } from './spec-migrations';
import { validateDesignSpec } from './spec';

const wrap = (node: Record<string, unknown>) => JSON.stringify({ schemaVersion: '1.0', name: 'T', pages: [{ id: 'p', name: 'P', children: [{ type: 'frame', id: 'f', name: 'F', width: 400, height: 400, children: [node] }] }] });
const first = (value: unknown) => (value as { pages: Array<{ children: Array<{ children: Array<Record<string, unknown>> }> }> }).pages[0]!.children[0]!.children[0]!;

describe('schema aliases from other tools (Penpot, Figma API, CSS)', () => {
  it('accepts gradient angle, start/end and offset stops', async () => {
    const angle = await parseWithMigration(wrap({ type: 'rectangle', id: 'r', name: 'R', width: 10, height: 10, paints: [{ type: 'linear-gradient', gradient: { angle: 180, stops: [{ offset: 0, color: '#000000' }, { offset: 1, color: '#ffffff80' }] } }] }));
    expect(angle.result.valid).toBe(true);
    const paint = (first(angle.result.value).paints as Array<{ gradient: { transform: number[][]; stops: Array<{ opacity?: number }> } }>)[0]!;
    expect(paint.gradient.transform).toEqual(angleTransform(180));
    expect(paint.gradient.stops[1]!.opacity).toBeCloseTo(0.502, 2);
    const handles = await parseWithMigration(wrap({ type: 'rectangle', id: 'r', name: 'R', width: 10, height: 10, fills: [{ type: 'linear', stops: [{ position: 0, color: '#000000' }, { position: 1, color: '#FFFFFF' }], start: { x: 0, y: 0 }, end: { x: 1, y: 1 } }] }));
    expect(handles.result.valid).toBe(true);
  });
  it('builds Figma gradient transforms that map start→(0,0.5) and end→(1,0.5)', () => {
    expect(linearTransform({ x: 0, y: 0.5 }, { x: 1, y: 0.5 })).toEqual([[1, 0, 0], [0, 1, 0]]);
    const m = angleTransform(180); const apply = (x: number, y: number) => [m[0]![0]! * x + m[0]![1]! * y + m[0]![2]!, m[1]![0]! * x + m[1]![1]! * y + m[1]![2]!];
    expect(apply(0.5, 0)).toEqual([0, 0.5]); expect(apply(0.5, 1)).toEqual([1, 0.5]);
  });
  it('maps text alignment, font weight names, letter spacing and line height objects', async () => {
    const out = await parseWithMigration(wrap({ type: 'text', id: 't', name: 'T', width: 100, height: 20, text: 'Hi', textAlign: 'center', fontWeight: 'ExtraBold', letterSpacing: 0.5, lineHeight: { unit: 'PERCENT', value: 150 }, fontSize: 20 }));
    expect(out.result.valid).toBe(true);
    expect(first(out.result.value)).toMatchObject({ align: 'CENTER', fontWeight: 800, fontStyle: 'ExtraBold', letterSpacing: { unit: 'PIXELS', value: 0.5 }, lineHeight: 30 });
  });
  it('maps per-corner radius arrays, objects and Figma-style fields to cornerRadii', async () => {
    for (const radius of [{ radius: [12, 12, 0, 0] }, { radius: { topLeft: 12, topRight: 12, bottomRight: 0, bottomLeft: 0 } }, { topLeftRadius: 12, topRightRadius: 12 }]) {
      const out = await parseWithMigration(wrap({ type: 'rectangle', id: 'r', name: 'R', width: 10, height: 10, fill: '#000000', ...radius }));
      expect(out.result.valid).toBe(true);
      expect(first(out.result.value).cornerRadii).toEqual({ topLeft: 12, topRight: 12, bottomRight: 0, bottomLeft: 0 });
    }
  });
  it('normalizes rgba and short hex colours', () => {
    expect(normalizeColor('rgba(255, 0, 0, 0.5)')).toEqual({ color: '#FF0000', opacity: 0.5 });
    expect(normalizeColor('#0f0')).toEqual({ color: '#00FF00' });
  });
  it('points paint errors at the missing field instead of "Unsupported layer type"', () => {
    const spec = JSON.parse(wrap({ type: 'rectangle', id: 'r', name: 'R', width: 10, height: 10, paints: [{ type: 'linear-gradient', gradient: { direction: 'horizontal', stops: [{ position: 0 }] } }] }));
    const issues = validateDesignSpec(spec).issues;
    expect(issues.some((issue) => issue.message.includes('Unsupported layer type'))).toBe(false);
    expect(issues.some((issue) => issue.path.endsWith('gradient.stops[0].color') && issue.message === 'missing required property')).toBe(true);
  });
  it('accepts an uploaded image by assetRef and rejects an image without a source', () => {
    const ok = JSON.parse(wrap({ type: 'image', id: 'i', name: 'I', width: 10, height: 10, assetRef: 'a'.repeat(64) }));
    expect(validateDesignSpec(ok).valid).toBe(true);
    const missing = JSON.parse(wrap({ type: 'image', id: 'i', name: 'I', width: 10, height: 10 }));
    expect(validateDesignSpec(missing).issues[0]!.message).toMatch(/assetRef/);
  });
});
