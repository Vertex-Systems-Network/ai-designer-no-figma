/** A recognisable badge (name, initial, colour) for the AI client doing the work. */
export type AgentBrand = { name: string; initial: string; color: string };
const BRANDS: [RegExp, AgentBrand][] = [
  [/chat\s*gpt|openai|codex/i, { name: 'ChatGPT', initial: 'G', color: '#10a37f' }],
  [/claude|anthropic/i, { name: 'Claude', initial: 'C', color: '#d97757' }],
  [/cursor/i, { name: 'Cursor', initial: 'Cu', color: '#1f1f1f' }],
  [/gemini|google/i, { name: 'Gemini', initial: 'Ge', color: '#4285f4' }],
  [/copilot|vs\s*code/i, { name: 'Copilot', initial: 'Co', color: '#6e40c9' }],
  [/windsurf|codeium/i, { name: 'Windsurf', initial: 'W', color: '#0b8a7b' }],
  [/ollama/i, { name: 'Ollama', initial: 'O', color: '#333333' }],
];
export function agentBrand(label?: string): AgentBrand {
  const text = label?.trim() || 'AI agent';
  for (const [pattern, brand] of BRANDS) if (pattern.test(text)) return brand;
  return { name: text, initial: text.replace(/[^a-z0-9]/gi, '').slice(0, 1).toUpperCase() || 'A', color: '#5b5bd6' };
}
