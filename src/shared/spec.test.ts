import { describe, expect, it } from 'vitest';
import { auditDesignQuality, parseDesignSpec, validateDesignSpec, type DesignSpec } from './spec';
import { utf8ByteLength } from './utf8';

const valid: DesignSpec = {
  schemaVersion: '1.0', name: 'Sample', pages: [{ id: 'page-1', name: 'Home', children: [
    { type: 'frame', id: 'frame-1', name: 'Hero', width: 1200, height: 700, children: [
      { type: 'text', id: 'title-1', name: 'Heading', width: 500, height: 60, text: 'Hello', fontSize: 32, color: '#111111' },
    ] },
  ] }],
};

describe('design specification validation', () => {
  it('audits readable contrast, semantic names, typography and repeated layout without blocking import', () => {
    const audited = structuredClone(valid);
    const frame = audited.pages[0]!.children[0]!;
    if (frame.type !== 'frame') throw new Error('fixture frame expected');
    frame.fill = '#FFFFFF';
    frame.children = [
      { type: 'text', id: 't1', name: 'Text 1', width: 200, height: 24, text: 'Low contrast', color: '#AAAAAA', fontSize: 14 },
      { type: 'text', id: 't2', name: 'Text', width: 200, height: 24, text: 'Also low contrast', fill: '#AAAAAA', fontSize: 14 },
      { type: 'rectangle', id: 'r1', name: 'Rectangle 1', width: 40, height: 20 },
      { type: 'rectangle', id: 'r2', name: 'Rectangle 2', width: 40, height: 20 },
    ];
    const findings = auditDesignQuality(audited);
    expect(findings.some((finding) => finding.message.includes('contrast'))).toBe(true);
    expect(findings.some((finding) => finding.message.includes('Auto Layout'))).toBe(true);
    expect(findings.some((finding) => finding.message.includes('semantic layer name'))).toBe(true);
    expect(validateDesignSpec(audited).valid).toBe(true);
  });
  it('counts UTF-8 bytes without TextEncoder, including multibyte and surrogate-pair characters', () => {
    expect(utf8ByteLength('ASCII')).toBe(5);
    expect(utf8ByteLength('é漢😀')).toBe(9);
    expect(utf8ByteLength('\ud800')).toBe(3);
  });
  it('accepts a well-formed editable design tree', () => expect(validateDesignSpec(valid).valid).toBe(true));
  it('accepts gradients, shadows, editable vectors, and instances of earlier components', () => {
    const advanced: DesignSpec = { schemaVersion: '1.0', name: 'Advanced', pages: [{ id: 'p-advanced', name: 'Components', children: [
      { type: 'component', id: 'button-component', name: 'Primary button', width: 120, height: 40, fill: '#087A55', children: [
        { type: 'text', id: 'button-label', name: 'Button label', width: 100, height: 24, text: 'Continue', fontSize: 14, color: '#FFFFFF' },
      ] },
      { type: 'instance', id: 'button-instance', name: 'Continue button', width: 120, height: 40, componentRef: 'button-component' },
      { type: 'rectangle', id: 'gradient-card', name: 'Gradient card', width: 240, height: 120, gradient: { direction: 'horizontal', stops: [{ position: 0, color: '#087A55' }, { position: 1, color: '#54B99A' }] }, shadow: { color: '#000000', opacity: 0.16, offsetX: 0, offsetY: 4, blur: 12 } },
      { type: 'vector', id: 'check-icon', name: 'Check icon', width: 24, height: 24, path: 'M2 12 L9 19 L22 4 Z', fill: '#FFFFFF' },
    ] }] };
    expect(validateDesignSpec(advanced).valid).toBe(true);
  });
  it('rejects unknown component references and unsafe vector path content', () => {
    const bad = structuredClone(valid);
    bad.pages[0]!.children = [
      { type: 'instance', id: 'orphan-instance', name: 'Orphan', width: 20, height: 20, componentRef: 'missing-component' },
      { type: 'vector', id: 'unsafe-vector', name: 'Unsafe vector', width: 20, height: 20, path: 'M0 0; alert(1)' },
    ];
    const result = validateDesignSpec(bad);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.path.endsWith('componentRef'))).toBe(true);
    expect(result.issues.some((issue) => issue.path.endsWith('.path'))).toBe(true);
  });
  it('rejects gradients with unordered stops', () => {
    const bad = structuredClone(valid);
    const frame = bad.pages[0]!.children[0]!;
    if (frame.type !== 'frame') throw new Error('fixture frame expected');
    frame.gradient = { direction: 'vertical', stops: [{ position: 0.8, color: '#FFFFFF' }, { position: 0.2, color: '#000000' }] };
    expect(validateDesignSpec(bad).issues.some((issue) => issue.path.endsWith('gradient.stops'))).toBe(true);
  });
  it('reports invalid JSON syntax', () => expect(parseDesignSpec('{broken').issues[0]?.message).toMatch(/syntax/i));
  it('accepts a JSON code block pasted from an external AI chat', () => {
    expect(parseDesignSpec(`\`\`\`json\n${JSON.stringify(valid)}\n\`\`\``).valid).toBe(true);
  });
  it('rejects unsupported node types', () => {
    const result = validateDesignSpec({ ...valid, pages: [{ ...valid.pages[0]!, children: [{ ...valid.pages[0]!.children[0]!, type: 'script' }] }] });
    expect(result.valid).toBe(false);
  });
  it('rejects duplicate IDs across pages and nodes', () => {
    const duplicate = structuredClone(valid); duplicate.pages[0]!.children[0]!.id = 'page-1';
    expect(validateDesignSpec(duplicate).issues.some((issue) => issue.message.includes('Duplicate'))).toBe(true);
  });
  it('rejects oversized documents before parsing', () => expect(parseDesignSpec(' '.repeat(512001)).valid).toBe(false));
  it('rejects deeply nested documents safely', () => {
    let child: DesignSpec['pages'][number]['children'][number] = { type: 'rectangle', id: 'leaf', name: 'Leaf', width: 1, height: 1 };
    for (let i = 0; i < 18; i++) child = { type: 'group', id: `g${i}`, name: 'Group', width: 10, height: 10, children: [child] };
    const result = validateDesignSpec({ ...valid, pages: [{ id: 'p', name: 'P', children: [child] }] });
    expect(result.issues.some((issue) => issue.message.includes('depth'))).toBe(true);
  });
  it('rejects circular and non-JSON input safely', () => {
    const circular: Record<string, unknown> = {}; circular.self = circular;
    expect(validateDesignSpec(circular).issues[0]?.message).toMatch(/circular/i);
    expect(validateDesignSpec(undefined).valid).toBe(false);
  });
});
