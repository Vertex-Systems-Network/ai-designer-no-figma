import type { DesignSpec } from './spec';

export type HostToUi =
  | { type: 'selection'; summary: { name: string; type: string; width: number; height: number; layerCount: number; nodes: Array<{id:string;name:string;type:string;x:number;y:number;width:number;height:number;text?:string;fill?:string}> } | null }
  | { type: 'render-result'; ok: boolean; message: string; created?: number }
  | { type: 'export-result'; ok: boolean; message: string; spec?: DesignSpec }
  | { type: 'patch-result'; ok: boolean; message: string; undoCount?: number }
  | { type: 'agent-status'; status:'disconnected'|'connecting'|'connected'|'working'|'error'; sessionId?:string; jobId?:string; agentLabel?:string; operation?:string; message?:string }
  | { type: 'agent-event'; id:string; jobId:string; agentLabel:string; operation:string; status:'started'|'completed'|'failed'; timestamp:number; message:string }
  | { type: 'error'; code: string; message: string };

export type UiToHost =
  | { type: 'resize-ui'; width: number; height: number }
  | { type: 'inspect-selection' }
  | { type: 'export-selection' }
  | { type: 'configure-bridge'; endpoint:string; token:string }
  | { type: 'render'; spec: DesignSpec; fontFallback?: string }
  | { type: 'cancel-render' }
  | { type: 'apply-patch'; patch: EditPatch }
  | { type: 'undo-patch' }
  | { type: 'apply-color-selection'; color: string };

export type EditPatch = {
  operations: Array<
    | { op: 'set-text'; targetId: string; value: string }
    | { op: 'set-fill'; targetId: string; value: string }
    | { op: 'rename'; targetId: string; value: string }
    | { op: 'set-bounds'; targetId: string; value: { x:number; y:number; width:number; height:number } }
  >;
};
