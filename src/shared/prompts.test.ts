import { describe, expect, it } from 'vitest';
import { parseEditPatch } from './edit-patch';
import { buildDesignPrompt, buildDesignSystemPrompt, buildPatchPrompt } from './prompts';

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

  it('adds category-specific structure rather than reusing one generic screen recipe',()=>{
    const settings={category:'WordPress Admin',platform:'Desktop',canvasSize:'1440x900',style:'Professional',brandColor:'#087A55',density:'Balanced',typography:'System UI',complexity:'Standard'};
    const prompt=buildDesignPrompt('Create a field builder',settings);
    expect(prompt).toContain('WordPress admin conventions');
    expect(prompt).toContain('repeatable fields');
    expect(buildDesignPrompt('A phone app',{...settings,category:'Mobile Application'})).toContain('reachable actions');
  });

  it('builds an edit prompt with only the supplied selection context', () => {
    const prompt = buildPatchPrompt({
      name: 'Hero', type: 'FRAME', width: 1440, height: 900, layerCount: 1,
      nodes: [{ id: 'node-1', name: 'Headline', type: 'TEXT', x: 24, y: 32, width: 600, height: 72, text: 'Hello' }],
    }, 'Improve heading contrast');
    expect(prompt).toContain('Improve heading contrast');
    expect(prompt).toContain('node-1');
    expect(prompt).toContain('Return an empty operations array');
    expect(prompt).toContain('swap-component');
    expect(prompt).toContain('existing COMPONENT');
  });

  it('includes color, typography and spacing tokens in the AI design handoff',()=>{
    const prompt=buildDesignSystemPrompt({
      colors:[{name:'Brand primary',color:'#006039'}],
      typography:[{name:'Body',fontFamily:'Inter',fontSize:14,fontWeight:400,lineHeight:20}],
      spacing:[{name:'Space 16',value:16}],
    });
    expect(prompt).toContain('Brand primary');
    expect(prompt).toContain('"fontSize": 14');
    expect(prompt).toContain('"value": 16');
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
