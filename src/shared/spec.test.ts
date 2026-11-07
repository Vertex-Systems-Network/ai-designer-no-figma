import { describe, expect, it } from 'vitest';
import { parseDesignSpec, validateDesignSpec, type DesignSpec } from './spec';

const valid: DesignSpec = {
  schemaVersion: '1.0', name: 'Sample', pages: [{ id: 'page-1', name: 'Home', children: [
    { type: 'frame', id: 'frame-1', name: 'Hero', width: 1200, height: 700, children: [
      { type: 'text', id: 'title-1', name: 'Heading', width: 500, height: 60, text: 'Hello', fontSize: 32, color: '#111111' },
    ] },
  ] }],
};

describe('design specification validation', () => {
  it('accepts a well-formed editable design tree', () => expect(validateDesignSpec(valid).valid).toBe(true));
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
