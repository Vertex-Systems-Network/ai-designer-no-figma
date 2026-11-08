import { describe, expect, it } from 'vitest';
import { BridgeFault, JobBroker } from './broker';

describe('local Figma job broker',()=>{
  it('requires an active target session and supports idempotent enqueue',()=>{
    const broker=new JobBroker();
    expect(()=>broker.enqueue({type:'inspect-selection'})).toThrowError(BridgeFault);
    broker.connect('figma-session-1','0.2.0');
    const first=broker.enqueue({type:'inspect-selection'},{operationId:'stable-op-1'});
    const duplicate=broker.enqueue({type:'inspect-selection'},{operationId:'stable-op-1'});
    expect(duplicate.jobId).toBe(first.jobId);
    expect(broker.takeNext('figma-session-1')).toMatchObject({jobId:first.jobId,status:'running'});
  });

  it('correlates results to their assigned session and retains truthful results',()=>{
    const broker=new JobBroker();broker.connect('figma-session-1','0.2.0');broker.connect('figma-session-2','0.2.0');
    const job=broker.enqueue({type:'inspect-selection'},{sessionId:'figma-session-1'});
    expect(broker.takeNext('figma-session-2')).toBeNull();
    broker.takeNext('figma-session-1');
    expect(()=>broker.complete('figma-session-2',job.jobId,true,{nodes:0})).toThrowError(/different plugin session/);
    expect(broker.complete('figma-session-1',job.jobId,true,{nodes:4})).toMatchObject({status:'completed',result:{nodes:4}});
    expect(broker.getJob(job.jobId).result).toEqual({nodes:4});
  });

  it('cancels queued work but rejects cancellation of active Figma work',()=>{
    const broker=new JobBroker();broker.connect('figma-session-1','0.2.0');
    const queued=broker.enqueue({type:'inspect-selection'});
    expect(broker.cancel(queued.jobId).status).toBe('cancelled');
    const active=broker.enqueue({type:'inspect-selection'});broker.takeNext('figma-session-1');
    expect(()=>broker.cancel(active.jobId)).toThrowError(/not interruptible yet/);
  });

  it('expires disconnected sessions and bounds active work',()=>{
    let now=10_000;const broker=new JobBroker({now:()=>now,sessionTtlMs:100,maxJobs:1});
    broker.connect('figma-session-1','0.2.0');broker.enqueue({type:'inspect-selection'});
    expect(()=>broker.enqueue({type:'inspect-selection'})).toThrowError(/queue is limited/);
    now+=101;
    expect(broker.getSessions()).toEqual([]);
    expect(()=>broker.enqueue({type:'inspect-selection'})).toThrowError(/No paired Figma/);
  });
});
