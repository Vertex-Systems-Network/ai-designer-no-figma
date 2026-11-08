import { describe, expect, it } from 'vitest';
import { parseEditPatch } from './edit-patch';

describe('parseEditPatch', () => {
  it('accepts bounded layout edits for a selected target', () => {
    const result = parseEditPatch(JSON.stringify({operations:[{op:'set-bounds',targetId:'frame-1',value:{x:-24,y:40,width:720,height:480}}]}),new Set(['frame-1']));
    expect(result.valid).toBe(true);
  });
  it('rejects bounds with missing fields, invalid dimensions, or extra properties', () => {
    for (const value of [{x:0,y:0,width:0,height:100},{x:0,y:0,width:100},{x:0,y:0,width:100,height:100,rotation:45}]) {
      expect(parseEditPatch(JSON.stringify({operations:[{op:'set-bounds',targetId:'frame-1',value}]})).valid).toBe(false);
    }
  });
  it('rejects layout edits targeting an ID outside the current selection', () => {
    const result = parseEditPatch(JSON.stringify({operations:[{op:'set-bounds',targetId:'other',value:{x:0,y:0,width:100,height:100}}]}),new Set(['frame-1']));
    expect(result).toMatchObject({valid:false,message:'operations[0].targetId is not present in the current selection.'});
  });
});
