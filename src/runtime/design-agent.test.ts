import { describe, expect, it } from 'vitest';
import { extractJson, runDesignAgent, type AgentEvent, type Complete } from './design-agent';

const settings = { category: 'Dashboard', platform: 'Desktop', canvasSize: '1440x900', style: 'Minimal', brandColor: '#0D8A60', density: 'Balanced', typography: 'Inter', complexity: 'Standard' };
const spec = (color: string) => JSON.stringify({ schemaVersion: '1.0', name: 'Analytics', pages: [{ id: 'p', name: 'Home', children: [{ type: 'frame', id: 'f', name: 'Dashboard', width: 1440, height: 900, fill: '#FFFFFF', children: [{ type: 'text', id: 't', name: 'Page title', width: 400, height: 40, text: 'Revenue', fontSize: 28, color }] }] }] });
const plan = JSON.stringify({ product: 'Analytics', visualDirection: 'calm', screens: [{ name: 'Overview' }], palette: { primary: '#0D8A60' } });

async function run(answers: string[]) {
  const prompts: string[] = []; const events: AgentEvent[] = [];
  const complete: Complete = async ({ prompt }) => { prompts.push(prompt); const next = answers.shift(); if (next === undefined) throw new Error('unexpected call'); return next; };
  for await (const event of runDesignAgent('Premium analytics dashboard', settings, complete)) events.push(event);
  return { prompts, events, result: events.find((e) => e.type === 'result') as Extract<AgentEvent, { type: 'result' }> | undefined };
}

describe('provider-independent design agent loop', () => {
  it('plans first, then builds with the plan and validates', async () => {
    const { prompts, events, result } = await run([plan, spec('#111111')]);
    expect(events.find((e) => e.type === 'plan')).toBeTruthy();
    expect(prompts[1]).toContain('approved design plan');
    expect(JSON.parse(result!.json).name).toBe('Analytics');
    expect(result!.rounds).toBe(0);
  });
  it('repairs schema errors using the validator issues', async () => {
    const { prompts, result } = await run([plan, '{"schemaVersion":"1.0"}', spec('#111111')]);
    expect(prompts[2]).toContain('failed validation');
    expect(result!.rounds).toBe(1);
  });
  it('fails honestly when repairs are exhausted', async () => {
    await expect(run([plan, '{}', '{}', '{}'])).rejects.toThrow(/could not produce a valid design/);
  });
  it('runs a review round for low-contrast text and keeps it only when problems drop', async () => {
    const { prompts, result } = await run([plan, spec('#FAFAFA'), spec('#111111')]);
    expect(prompts[2]).toContain('design review');
    expect(JSON.parse(result!.json).pages[0].children[0].children[0].color).toBe('#111111');
  });
  it('continues without a plan when the model returns prose', async () => {
    const { events, result } = await run(['Sure! Here is my plan…', spec('#111111')]);
    expect(events.some((e) => e.type === 'stage' && e.message.includes('without') || e.type === 'stage' && e.message.includes('brief alone'))).toBe(true);
    expect(result).toBeTruthy();
  });
  it('extracts JSON from fenced or chatty output', () => {
    expect(extractJson('Here:\n```json\n{"a":1}\n```')).toBe('{"a":1}');
  });
});
