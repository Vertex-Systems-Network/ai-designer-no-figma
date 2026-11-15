import { describe, it, expect } from 'vitest';
import { agentBrand } from './agent-brand';
describe('agent brand', () => {
  it('recognises common AI clients and falls back to the label', () => {
    expect(agentBrand('ChatGPT').name).toBe('ChatGPT');
    expect(agentBrand('claude-ai').name).toBe('Claude');
    expect(agentBrand('Cursor').name).toBe('Cursor');
    expect(agentBrand('my-bot')).toMatchObject({ name: 'my-bot', initial: 'M' });
    expect(agentBrand(undefined).name).toBe('AI agent');
  });
});
