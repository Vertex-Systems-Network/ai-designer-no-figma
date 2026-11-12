import { describe,it,expect } from 'vitest';
import type { BridgeJob } from './bridge-contract';
import { prepareVisualRepair,verifyVisualRepair } from './visual-repair';
const id=(suffix:string)=>`00000000-0000-4000-8000-00000000000${suffix}`;
const job=(kind:'capture-selection'|'inspect-selection'|'apply-patch',time:number,result:unknown,sessionId='session-1'):BridgeJob=>({jobId:id(String(time)),operationId:id(String(time)),sessionId,agentLabel:'Test',operation:kind==='apply-patch'?{type:kind,patch:{operations:[{op:'set-bounds',targetId:'title',value:{x:20,y:20,width:100,height:40}}]}}:{type:kind},status:'completed',createdAt:time-1,updatedAt:time,result});
const capture=(time:number,data='QUJDREVGR0hJSktMTU5PUA==')=>job('capture-selection',time,{kind:'visual-preview',mimeType:'image/jpeg',base64:data,width:500,height:250,nodeName:'Hero'});
const inspect=job('inspect-selection',2,{summary:{name:'Hero',width:500,height:250,nodes:[{id:'title',x:10,y:20,width:100,height:40}]}});
const patch=JSON.stringify({operations:[{op:'set-bounds',targetId:'title',value:{x:20,y:20,width:100,height:40}}]});
describe('visual repair evidence',()=>{
 it('binds one measured patch to same-frame capture and selection',()=>expect(prepareVisualRepair(capture(1),inspect,patch,'title','Title is too close to the left edge.')).toMatchObject({valid:true,targetId:'title',observedBounds:{x:10},visualVerification:'PENDING_RECAPTURE'}));
 it('rejects unrelated selection, wrong target and no-op patch',()=>{
  expect(prepareVisualRepair(capture(3),inspect,patch,'title','Title is too close to the left edge.').valid).toBe(false);
  expect(prepareVisualRepair(capture(1),inspect,patch,'other','Title is too close to the left edge.').valid).toBe(false);
  const same=JSON.stringify({operations:[{op:'set-bounds',targetId:'title',value:{x:10,y:20,width:100,height:40}}]});
  expect(prepareVisualRepair(capture(1),inspect,same,'title','Title is too close to the left edge.').valid).toBe(false);
 });
 it('records changed screenshot hashes without claiming visual repair',()=>{
  expect(verifyVisualRepair(capture(1),job('apply-patch',3,{}),capture(4,'R0hJSktMTU5PUFFSU1RVVg=='))).toMatchObject({valid:true,changed:true,visualVerification:'REQUIRES_HUMAN_OR_VISION_REVIEW'});
  expect(verifyVisualRepair(capture(1),job('apply-patch',3,{}),capture(4))).toMatchObject({valid:true,changed:false});
  expect(verifyVisualRepair(capture(1),job('apply-patch',3,{},'other'),capture(4)).valid).toBe(false);
 });
});
