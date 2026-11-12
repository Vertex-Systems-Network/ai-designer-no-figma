import { describe, it, expect } from 'vitest';
import { agentName } from './server';
describe('agent names shown in Figma',()=>{
  it('maps common MCP client names and keeps unknown ones',()=>{
    expect(agentName('claude-ai')).toBe('Claude');
    expect(agentName('claude-code')).toBe('Claude Code');
    expect(agentName('openai-mcp')).toBe('ChatGPT');
    expect(agentName('Cursor')).toBe('Cursor');
    expect(agentName('my-agent')).toBe('my-agent');
    expect(agentName(undefined)).toBeUndefined();
  });
});
