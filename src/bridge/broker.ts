import { randomUUID } from 'node:crypto';
import { utf8ByteLength } from '../shared/utf8';
import type { BridgeError, BridgeJob, BridgeOperation, BridgeSession } from '../shared/bridge-contract';

export class BridgeFault extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = 'BridgeFault'; }
}

type BrokerOptions = { now?: () => number; sessionTtlMs?: number; jobTtlMs?: number; maxJobs?: number };
export class JobBroker {
  private readonly sessions = new Map<string, BridgeSession>();
  private readonly jobs = new Map<string, BridgeJob>();
  private readonly operationIds = new Map<string, string>();
  private readonly now: () => number;
  private readonly sessionTtlMs: number;
  private readonly jobTtlMs: number;
  private readonly maxJobs: number;

  constructor(options: BrokerOptions = {}) {
    this.now = options.now ?? Date.now;
    this.sessionTtlMs = options.sessionTtlMs ?? 120_000;
    this.jobTtlMs = options.jobTtlMs ?? 300_000;
    this.maxJobs = options.maxJobs ?? 100;
  }

  connect(sessionId: string, pluginVersion: string): BridgeSession {
    this.validateSessionId(sessionId);
    const now = this.now();
    const previous = this.sessions.get(sessionId);
    const session = { sessionId, pluginVersion: pluginVersion.slice(0,80), connectedAt: previous?.connectedAt ?? now, lastSeenAt: now };
    this.sessions.set(sessionId, session);
    return { ...session };
  }

  heartbeat(sessionId: string): BridgeSession {
    const session = this.requireSession(sessionId);
    session.lastSeenAt = this.now();
    return { ...session };
  }

  disconnect(sessionId: string): void { this.sessions.delete(sessionId); }

  getSessions(): BridgeSession[] {
    this.expire();
    return [...this.sessions.values()].map((session) => ({ ...session })).sort((a,b)=>a.connectedAt-b.connectedAt);
  }

  enqueue(operation: BridgeOperation, options: { sessionId?: string; agentLabel?: string; operationId?: string } = {}): BridgeJob {
    this.expire();
    const sessionId = this.resolveSession(options.sessionId);
    const operationId = options.operationId?.trim() || randomUUID();
    if (operationId.length > 128) throw new BridgeFault('INVALID_OPERATION_ID','Operation ID must be no longer than 128 characters.');
    const priorId = this.operationIds.get(operationId);
    if (priorId) {
      const prior = this.jobs.get(priorId);
      if (prior && prior.sessionId === sessionId && JSON.stringify(prior.operation)===JSON.stringify(operation)) return structuredClone(prior);
      throw new BridgeFault('DUPLICATE_OPERATION_ID','This operation ID was already used by another session.');
    }
    const activeJobs = [...this.jobs.values()].filter((job) => ['queued','running'].includes(job.status)).length;
    if (activeJobs >= this.maxJobs) throw new BridgeFault('QUEUE_FULL',`Bridge queue is limited to ${this.maxJobs} active jobs.`);
    const now = this.now();
    const job: BridgeJob = { jobId: randomUUID(), operationId, sessionId, agentLabel: sanitizeLabel(options.agentLabel), operation: structuredClone(operation), status:'queued', createdAt:now, updatedAt:now };
    this.jobs.set(job.jobId,job); this.operationIds.set(operationId,job.jobId);
    return structuredClone(job);
  }

  takeNext(sessionId: string): BridgeJob | null {
    this.heartbeat(sessionId);
    const job = [...this.jobs.values()].filter((candidate)=>candidate.sessionId===sessionId&&candidate.status==='queued').sort((a,b)=>a.createdAt-b.createdAt)[0];
    if (!job) return null;
    job.status='running'; job.updatedAt=this.now();
    return structuredClone(job);
  }

  complete(sessionId: string, jobId: string, success: boolean, result?: unknown, error?: BridgeError): BridgeJob {
    this.heartbeat(sessionId);
    const job = this.jobs.get(jobId);
    if (!job) throw new BridgeFault('JOB_NOT_FOUND','The requested job does not exist or has expired.');
    if (job.sessionId !== sessionId) throw new BridgeFault('SESSION_MISMATCH','The job belongs to a different plugin session.');
    if (job.status !== 'running') throw new BridgeFault('JOB_NOT_RUNNING',`The job is ${job.status} and cannot accept a result.`);
    if (success && utf8ByteLength(JSON.stringify(result) ?? 'null') > 1_048_576) throw new BridgeFault('RESULT_TOO_LARGE','Plugin result exceeds the 1 MB limit.');
    job.status=success?'completed':'failed'; job.updatedAt=this.now();
    if (success) job.result=structuredClone(result);
    else job.error={ code:sanitizeCode(error?.code), message:(error?.message ?? 'Plugin operation failed.').slice(0,2000) };
    return structuredClone(job);
  }

  cancel(jobId: string): BridgeJob {
    this.expire();
    const job=this.jobs.get(jobId);
    if (!job) throw new BridgeFault('JOB_NOT_FOUND','The requested job does not exist or has expired.');
    if (job.status !== 'queued') throw new BridgeFault('JOB_NOT_CANCELLABLE','Only queued jobs can be cancelled; running Figma operations are not interruptible yet.');
    job.status='cancelled';job.updatedAt=this.now();
    return structuredClone(job);
  }

  getJob(jobId: string): BridgeJob {
    this.expire();
    const job=this.jobs.get(jobId);
    if (!job) throw new BridgeFault('JOB_NOT_FOUND','The requested job does not exist or has expired.');
    return structuredClone(job);
  }

  private resolveSession(requested?: string): string {
    const sessions=this.getSessions();
    if (requested) {
      if (!sessions.some((session)=>session.sessionId===requested)) throw new BridgeFault('SESSION_NOT_CONNECTED','The requested Figma plugin session is not connected.');
      return requested;
    }
    if (sessions.length===0) throw new BridgeFault('FIGMA_DISCONNECTED','No paired Figma plugin session is connected.');
    if (sessions.length>1) throw new BridgeFault('SESSION_REQUIRED','More than one Figma plugin session is active. Provide a sessionId from figma_get_connection_status.');
    return sessions[0]!.sessionId;
  }

  private requireSession(id: string): BridgeSession {
    const session=this.sessions.get(id);
    if (!session || this.now()-session.lastSeenAt>this.sessionTtlMs) { this.sessions.delete(id); throw new BridgeFault('SESSION_NOT_CONNECTED','Figma plugin session is disconnected or expired.'); }
    return session;
  }

  private validateSessionId(id: string): void {
    if (typeof id!=='string'||id.length<8||id.length>128||!/^[a-zA-Z0-9:_-]+$/.test(id)) throw new BridgeFault('INVALID_SESSION_ID','Plugin session ID contains unsupported characters or length.');
  }

  private expire(): void {
    const now=this.now();
    for (const [id,session] of this.sessions) if (now-session.lastSeenAt>this.sessionTtlMs) this.sessions.delete(id);
    for (const [id,job] of this.jobs) if (now-job.updatedAt>this.jobTtlMs) { this.jobs.delete(id); this.operationIds.delete(job.operationId); }
  }
}

function sanitizeLabel(label?: string): string { return (label?.replace(/[\u0000-\u001f\u007f]/g,' ').trim()||'MCP client').slice(0,80); }
function sanitizeCode(code?: string): string { return code&&/^[A-Z0-9_]{1,80}$/.test(code)?code:'PLUGIN_OPERATION_FAILED'; }
