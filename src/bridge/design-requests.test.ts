import { describe, it, expect } from 'vitest';
import { JobBroker } from './broker';
describe('design requests from the plugin to the paired agent',()=>{
  it('queues briefs for a connected session and hands them over once',()=>{
    const broker=new JobBroker();broker.connect('figma-session-1','0.2.0');
    broker.addRequest('figma-session-1','generate','Pricing card');broker.addRequest('figma-session-1','edit','Make the button blue');
    expect(broker.pendingRequestCount()).toBe(2);
    expect(broker.takeRequests().map(r=>[r.kind,r.prompt])).toEqual([['generate','Pricing card'],['edit','Make the button blue']]);
    expect(broker.takeRequests()).toEqual([]);
  });
  it('rejects requests from unknown sessions and keeps only the newest 20',()=>{
    const broker=new JobBroker();expect(()=>broker.addRequest('nope','generate','x')).toThrow(/Reconnect/);
    broker.connect('figma-session-1','0.2.0');for(let i=0;i<25;i++)broker.addRequest('figma-session-1','generate',`brief ${i}`);
    const taken=broker.takeRequests();expect(taken).toHaveLength(20);expect(taken[0]!.prompt).toBe('brief 5');
  });
});
