import type { DesignSpec } from './spec';
import type { AssetSummary, StoredAsset } from './asset-library';
import type { BridgeJob } from './bridge-contract';

export type HostToUi =
  | { type: 'selection'; summary: { name: string; type: string; width: number; height: number; layerCount: number; nodes: Array<{id:string;name:string;type:string;x:number;y:number;width:number;height:number;text?:string;fill?:string;hasImageFill?:boolean;imageScaleMode?:'FILL'|'FIT'|'CROP'|'TILE';imageTransform?:[[number,number,number],[number,number,number]];imageScalingFactor?:number}> } | null }
  | { type: 'render-result'; ok: boolean; message: string; created?: number }
  | { type: 'export-result'; ok: boolean; message: string; spec?: DesignSpec }
  | { type: 'patch-result'; ok: boolean; message: string; undoCount?: number }
  | { type:'asset-result'; ok:boolean; message:string; name?:string; kind?:'svg'|'image'; width?:number; height?:number; elements?:number; mimeType?:string; bytes?:number; nodeId?:string }
  | { type:'asset-library-response';requestId:string;operation:'list'|'read'|'save'|'delete'|'clear';ok:boolean;assets?:AssetSummary[];asset?:StoredAsset|AssetSummary;duplicate?:boolean;message?:string }
  | { type: 'agent-status'; status:'disconnected'|'connecting'|'connected'|'working'|'error'; sessionId?:string; jobId?:string; agentLabel?:string; operation?:string; message?:string }
  | { type: 'agent-event'; id:string; jobId:string; agentLabel:string; operation:string; status:'started'|'completed'|'failed'; timestamp:number; message:string }
  | { type: 'current-user'; name:string; photoUrl:string|null; signedIn:boolean }
  | { type: 'bridge-job-result'; jobId:string; ok:boolean; result?:unknown; error?:{code:string;message:string} }
  | { type: 'error'; code: string; message: string };

export type UiToHost =
  | { type: 'resize-ui'; width: number; height: number }
  | { type: 'ui-ready' }
  | { type: 'inspect-selection' }
  | { type: 'export-selection' }
  | { type: 'configure-bridge'; endpoint:string; token:string; sessionId:string }
  | { type: 'bridge-job'; job:BridgeJob }
  | { type: 'hide-ui' }
  | { type: 'render'; spec: DesignSpec; fontFallback?: string }
  | { type: 'cancel-render' }
  | { type: 'apply-patch'; patch: EditPatch }
  | { type: 'undo-patch' }
  | { type: 'apply-color-selection'; color: string }
  | { type:'import-svg'; name:string; svg:string }
  | { type:'import-image'; name:string; mimeType:string; bytes:number[] }
  | { type:'asset-library-request';requestId:string;operation:'list'|'read'|'save'|'delete'|'clear';sha?:string;asset?:Omit<StoredAsset,'sha256'> }
  | { type:'select-node'; nodeId:string };

export type EditPatch = {
  operations: Array<
    | { op: 'set-text'; targetId: string; value: string }
    | { op: 'set-fill'; targetId: string; value: string }
    | { op: 'rename'; targetId: string; value: string }
    | { op: 'set-bounds'; targetId: string; value: { x:number; y:number; width:number; height:number } }
    | { op: 'set-auto-layout'; targetId: string; value: { mode:'NONE'|'HORIZONTAL'|'VERTICAL'; gap:number; padding:number; alignment:'MIN'|'CENTER'|'MAX'|'SPACE_BETWEEN' } }
    | { op: 'swap-component'; targetId: string; value: string }
    | { op: 'replace-image'; targetId: string; value: { mimeType:'image/png'|'image/jpeg'; data:string } }
    | { op: 'set-image-crop'; targetId:string; value:{scaleMode:'FILL'|'FIT'|'CROP'|'TILE';imageTransform?:[[number,number,number],[number,number,number]];scalingFactor?:number} }
  >;
};
