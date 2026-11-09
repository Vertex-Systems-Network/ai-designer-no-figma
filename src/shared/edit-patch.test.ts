import { describe, expect, it } from 'vitest';
import { parseEditPatch } from './edit-patch';

describe('parseEditPatch', () => {
  it('accepts a bounded PNG image replacement and rejects invalid or oversized image bytes',()=>{
    const data='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==';
    const op={op:'replace-image',targetId:'image-1',value:{mimeType:'image/png',data}};
    expect(parseEditPatch(JSON.stringify({operations:[op]}),new Set(['image-1'])).valid).toBe(true);
    expect(parseEditPatch(JSON.stringify({operations:[op]}),new Set(['other']))).toMatchObject({valid:false,message:'operations[0].targetId is not present in the current selection.'});
    for(const value of [{mimeType:'image/jpeg',data},{mimeType:'image/png',data:'not-base64'},{mimeType:'image/png',data:'A'.repeat(180_000)}])
      expect(parseEditPatch(JSON.stringify({operations:[{...op,value}]})).valid).toBe(false);
  });
  it('accepts safe image scale modes and a bounded invertible crop transform',()=>{
    const ids=new Set(['image-1']);
    for(const value of [{scaleMode:'FILL'},{scaleMode:'FIT'},{scaleMode:'CROP',imageTransform:[[1,0,0],[0,1,0]]}])
      expect(parseEditPatch(JSON.stringify({operations:[{op:'set-image-crop',targetId:'image-1',value}]}),ids).valid).toBe(true);
  });
  it('rejects singular, oversized, malformed, and unsupported image crop transforms',()=>{
    const values=[{scaleMode:'CROP',imageTransform:[[1,0,0],[0,0,0]]},{scaleMode:'CROP',imageTransform:[[11,0,0],[0,1,0]]},{scaleMode:'CROP',imageTransform:[[1,0],[0,1]]},{scaleMode:'CROP',imageTransform:[[1,0,0],[0,1,0]],extra:true},{scaleMode:'TILE'}];
    for(const value of values)expect(parseEditPatch(JSON.stringify({operations:[{op:'set-image-crop',targetId:'image-1',value}]})).valid).toBe(false);
  });
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
  it('accepts bounded Auto Layout settings and rejects unsafe or malformed values',()=>{
    const valid={op:'set-auto-layout',targetId:'frame-1',value:{mode:'VERTICAL',gap:16,padding:24,alignment:'MIN'}};
    expect(parseEditPatch(JSON.stringify({operations:[valid]}),new Set(['frame-1'])).valid).toBe(true);
    for(const value of [{mode:'WRAP',gap:0,padding:0,alignment:'MIN'},{mode:'HORIZONTAL',gap:-1,padding:0,alignment:'MIN'},{mode:'HORIZONTAL',gap:0,padding:0,alignment:'UNKNOWN'},{mode:'NONE',gap:0,padding:0,alignment:'MIN',extra:true}])
      expect(parseEditPatch(JSON.stringify({operations:[{...valid,value}]})).valid).toBe(false);
  });
  it('rejects Auto Layout edits targeting an ID outside the current selection',()=>{
    const result=parseEditPatch(JSON.stringify({operations:[{op:'set-auto-layout',targetId:'other',value:{mode:'VERTICAL',gap:16,padding:16,alignment:'MIN'}}]}),new Set(['frame-1']));
    expect(result).toMatchObject({valid:false,message:'operations[0].targetId is not present in the current selection.'});
  });
  it('accepts instance replacement only when both instance and component IDs are in the selected tree',()=>{
    const operation={op:'swap-component',targetId:'instance-1',value:'component-1'};
    expect(parseEditPatch(JSON.stringify({operations:[operation]}),new Set(['instance-1','component-1'])).valid).toBe(true);
    expect(parseEditPatch(JSON.stringify({operations:[operation]}),new Set(['instance-1']))).toMatchObject({valid:false,message:'operations[0].value is not present in the current selection.'});
    for(const value of ['',{},'x'.repeat(201)])expect(parseEditPatch(JSON.stringify({operations:[{...operation,value}]})).valid).toBe(false);
  });
});
