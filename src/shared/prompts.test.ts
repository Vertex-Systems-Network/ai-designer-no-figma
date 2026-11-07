import { describe, expect, it } from 'vitest';
import { parseEditPatch } from './edit-patch';
import { buildDesignPrompt, buildPatchPrompt } from './prompts';

describe('provider-neutral AI handoff prompts', () => {
  it('builds a self-contained design prompt for any external assistant', () => {
    const prompt = buildDesignPrompt('A product dashboard', {
      category: 'Dashboard', platform: 'Desktop', canvasSize: '1440x900', style: 'Editorial',
      brandColor: '#006039', density: 'Balanced', typography: 'System UI', complexity: 'Standard',
    });
    expect(prompt).toContain('Return one valid JSON object only');
    expect(prompt).toContain('A product dashboard');
    expect(prompt).toContain('"brandColor": "#006039"');
    expect(prompt).toContain('native editable layers');
    expect(prompt).not.toContain('Ollama');
  });

  it('builds an edit prompt with only the supplied selection context', () => {
    const prompt = buildPatchPrompt({
      name: 'Hero', type: 'FRAME', width: 1440, height: 900, layerCount: 1,
      nodes: [{ id: 'node-1', name: 'Headline', type: 'TEXT', text: 'Hello' }],
    }, 'Improve heading contrast');
    expect(prompt).toContain('Improve heading contrast');
    expect(prompt).toContain('node-1');
    expect(prompt).toContain('Return an empty operations array');
  });
});

describe('external edit patch validation', () => {
  it('accepts a fenced JSON patch for IDs in the current selection', () => {
    const result = parseEditPatch('```json\n{"operations":[{"op":"set-text","targetId":"node-1","value":"Updated"}]}\n```', new Set(['node-1']));
    expect(result.valid).toBe(true);
  });

  it('rejects unknown target IDs, executable fields, invalid colors, and oversized operation lists', () => {
    expect(parseEditPatch('{"operations":[{"op":"rename","targetId":"other","value":"x"}]}', new Set(['node-1'])).valid).toBe(false);
    expect(parseEditPatch('{"operations":[{"op":"rename","targetId":"node-1","value":"x","code":"run()"}]}').valid).toBe(false);
    expect(parseEditPatch('{"operations":[{"op":"set-fill","targetId":"node-1","value":"red"}]}').valid).toBe(false);
    expect(parseEditPatch(JSON.stringify({ operations: Array.from({ length: 101 }, () => ({ op:'rename',targetId:'x',value:'x' })) })).valid).toBe(false);
  });
});
