import { createHash } from 'node:crypto';
import type { BridgeJob } from './bridge-contract';
import { parseEditPatch } from './edit-patch';
import type { VisualPreview } from '../mcp/visual-preview';

type Selection={name:string;width:number;height:number;nodes:Array<{id:string;x:number;y:number;width:number;height:number}>};
const failure=(message:string)=>({valid:false as const,message});
const preview=(job:BridgeJob):VisualPreview|undefined=>{
  const result=job.result as Partial<VisualPreview>|undefined;
  return job.status==='completed'&&job.operation.type==='capture-selection'&&result?.kind==='visual-preview'&&result.mimeType==='image/jpeg'&&typeof result.base64==='string'&&result.base64.length>=16&&/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(result.base64)?result as VisualPreview:undefined;
};
const selection=(job:BridgeJob):Selection|undefined=>{
  const data=job.result as {summary?:Selection}|undefined;
  return job.status==='completed'&&job.operation.type==='inspect-selection'&&data?.summary&&Array.isArray(data.summary.nodes)?data.summary:undefined;
};
const digest=(base64:string)=>createHash('sha256').update(Buffer.from(base64,'base64')).digest('hex');
/** A prepared repair is bound to observed jobs; the agent still has to inspect the image. */
export function prepareVisualRepair(capture:BridgeJob,inspection:BridgeJob,json:string,targetId:string,observation:string){
  const image=preview(capture),selected=selection(inspection);
  if(!image||!selected)return failure('Completed capture and selection jobs are required.');
  if(capture.sessionId!==inspection.sessionId||capture.updatedAt>inspection.updatedAt||image.nodeName!==selected.name)return failure('Capture and selection do not describe the same ordered session/frame.');
  if(typeof observation!=='string'||observation.trim().length<12||observation.length>500)return failure('Describe the visible defect in 12–500 characters.');
  const target=selected.nodes.find(node=>node.id===targetId);
  if(!target)return failure('Target is absent from the observed selection.');
  const patch=parseEditPatch(json,new Set(selected.nodes.map(node=>node.id)));
  if(!patch.valid)return failure(patch.message);
  if(patch.value.operations.length!==1||patch.value.operations[0]?.targetId!==targetId)return failure('Use exactly one operation on the measured target.');
  const op=patch.value.operations[0];
  if(op.op==='set-bounds'&&['x','y','width','height'].every(key=>target[key as keyof typeof target]===op.value[key as keyof typeof op.value]))return failure('Bounds repair does not change the target.');
  return{valid:true as const,captureJobId:capture.jobId,inspectionJobId:inspection.jobId,sessionId:capture.sessionId,frame:image.nodeName,targetId,observedBounds:{x:target.x,y:target.y,width:target.width,height:target.height},observation:observation.trim(),beforeSha256:digest(image.base64),patch:patch.value,visualVerification:'PENDING_RECAPTURE'};
}

export function verifyVisualRepair(before:BridgeJob,patch:BridgeJob,after:BridgeJob){
  const first=preview(before),last=preview(after);
  if(!first||!last||patch.operation.type!=='apply-patch'||patch.status!=='completed')return failure('Completed before, patch, and after jobs are required.');
  if(new Set([before.sessionId,patch.sessionId,after.sessionId]).size!==1||!(before.updatedAt<patch.updatedAt&&patch.updatedAt<after.updatedAt)||first.nodeName!==last.nodeName)return failure('Jobs must be ordered on the same Figma session and frame.');
  const beforeSha256=digest(first.base64),afterSha256=digest(last.base64);
  return{valid:true as const,beforeSha256,afterSha256,changed:beforeSha256!==afterSha256,visualVerification:'REQUIRES_HUMAN_OR_VISION_REVIEW'};
}
