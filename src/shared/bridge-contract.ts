import type { EditPatch } from './protocol';
import type { DesignSpec } from './spec';
import type { ComponentFamily } from './component-family';

export type BridgeOperation =
  | { type: 'inspect-selection' }
  | { type: 'inspect-design-system' }
  | { type: 'render-component-family'; family: ComponentFamily }
  | { type: 'export-component-family' }
  | { type: 'render-spec'; spec: DesignSpec }
  | { type: 'apply-patch'; patch: EditPatch }
  | { type: 'export-selection' }
  | { type: 'capture-selection' }
  | { type:'insert-svg'; name:string; svg:string }
  | { type:'insert-image'; name:string; mimeType:string; bytes:number[] }
  | {type:'begin-image-transfer';transferId:string;name:string;mimeType:'image/png'|'image/jpeg'|'image/gif';totalBytes:number;sha256:string;chunkCount:number}
  | {type:'image-transfer-chunk';transferId:string;index:number;bytes:number[]}
  | {type:'finish-image-transfer';transferId:string};

export type BridgeJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type BridgeError = { code: string; message: string };
export type BridgeJob = {
  jobId: string;
  operationId: string;
  sessionId: string;
  agentLabel: string;
  operation: BridgeOperation;
  status: BridgeJobStatus;
  createdAt: number;
  updatedAt: number;
  result?: unknown;
  error?: BridgeError;
  /** Set when an AI client asked to stop a job the plugin is already running. */
  cancelRequested?: boolean;
};
export type BridgeSession = { sessionId: string; pluginVersion: string; connectedAt: number; lastSeenAt: number };
