import { buildDesignPrompt, type DesignPromptSettings } from '../shared/prompts';
import { auditDesignQuality, parseDesignSpec, type DesignQualityFinding } from '../shared/spec';

/**
 * Provider-independent design loop used when the plugin talks to a model directly
 * (MCP clients run their own loop with the bridge tools):
 *   plan → build → validate (repair) → review (improve) → result
 * Every step is real model output checked by the same schema validator and
 * quality audit the plugin uses; nothing is simulated.
 */
export type Complete = (request: { system?: string; prompt: string }) => Promise<string>;
export type AgentEvent =
  | { type: 'stage'; stage: 'plan' | 'build' | 'validate' | 'repair' | 'review' | 'improve' | 'done'; message: string }
  | { type: 'plan'; plan: DesignPlanSummary }
  | { type: 'result'; json: string; findings: DesignQualityFinding[]; rounds: number };
export type DesignPlanSummary = {
  product?: string; audience?: string; visualDirection?: string;
  palette?: Record<string, string>; typography?: Record<string, unknown>; spacing?: number[];
  screens?: Array<{ name: string; purpose?: string; sections?: string[] }>; components?: string[];
};
export type AgentOptions = { maxRepairs?: number; review?: boolean };

const PLAN_SYSTEM = `You are a senior product designer. Before any layout is drawn, write a concise design plan as one JSON object only:
{"product":string,"audience":string,"visualDirection":string,"palette":{"primary":"#RRGGBB","surface":"#RRGGBB","text":"#RRGGBB","muted":"#RRGGBB","accent":"#RRGGBB"},"typography":{"family":string,"scale":[number]},"spacing":[number],"screens":[{"name":string,"purpose":string,"sections":[string]}],"components":[string]}
Rules: choose colors with WCAG AA text contrast; use a 4 or 8 px spacing scale; plan real product content (no lorem ipsum); prefer restraint over decoration (no gratuitous gradients or glassmorphism); list reusable components that appear more than once. Plan only the screens the brief needs (usually one).`;

export function extractJson(text: string): string {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = trimmed.indexOf('{'); const end = trimmed.lastIndexOf('}');
  return start >= 0 && end > start ? trimmed.slice(start, end + 1) : trimmed;
}

function parsePlan(text: string): DesignPlanSummary | undefined {
  try {
    const value = JSON.parse(extractJson(text)) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const plan = value as DesignPlanSummary;
    if (plan.screens && !Array.isArray(plan.screens)) return undefined;
    return plan;
  } catch { return undefined; }
}

const issueList = (issues: Array<{ path: string; message: string }>) => issues.slice(0, 25).map((i) => `- ${i.path}: ${i.message}`).join('\n');

export async function* runDesignAgent(brief: string, settings: DesignPromptSettings, complete: Complete, options: AgentOptions = {}): AsyncGenerator<AgentEvent> {
  const maxRepairs = options.maxRepairs ?? 2;

  yield { type: 'stage', stage: 'plan', message: 'Planning product, screens, palette, type and components…' };
  const plan = parsePlan(await complete({ system: PLAN_SYSTEM, prompt: `Brief: ${brief}\nCategory: ${settings.category}\nPlatform: ${settings.platform}\nCanvas: ${settings.canvasSize}\nStyle: ${settings.style}\nBrand color: ${settings.brandColor}\nDensity: ${settings.density}\nTypography: ${settings.typography}\nComplexity: ${settings.complexity}` }));
  if (plan) yield { type: 'plan', plan };
  else yield { type: 'stage', stage: 'plan', message: 'Model did not return a usable plan; building from the brief alone.' };

  yield { type: 'stage', stage: 'build', message: 'Building the editable Figma layer specification…' };
  const planned = plan ? `${brief}\n\nFollow this approved design plan exactly (palette, type scale, spacing, sections, reusable components):\n${JSON.stringify(plan)}` : brief;
  const basePrompt = buildDesignPrompt(planned, settings);
  let text = extractJson(await complete({ prompt: basePrompt }));

  yield { type: 'stage', stage: 'validate', message: 'Validating against design schema 1.0…' };
  let result = parseDesignSpec(text);
  let rounds = 0;
  while (!result.valid && rounds < maxRepairs) {
    rounds++;
    yield { type: 'stage', stage: 'repair', message: `Fixing ${result.issues.length} schema issue(s), attempt ${rounds}/${maxRepairs}…` };
    text = extractJson(await complete({ prompt: `${basePrompt}\n\nYour previous JSON failed validation:\n${issueList(result.issues)}\n\nPrevious JSON:\n${text.slice(0, 200_000)}\n\nReturn the complete corrected JSON object only. Keep everything that was valid.` }));
    result = parseDesignSpec(text);
  }
  if (!result.valid || !result.value) throw new Error(`The model could not produce a valid design after ${rounds} repair attempt(s):\n${issueList(result.issues)}`);

  let findings = auditDesignQuality(result.value);
  const warnings = findings.filter((f) => f.severity === 'warning');
  if (options.review !== false && warnings.length) {
    yield { type: 'stage', stage: 'review', message: `Design review found ${warnings.length} problem(s): ${warnings.slice(0, 3).map((w) => w.message).join('; ')}` };
    yield { type: 'stage', stage: 'improve', message: 'Improving the design to fix review findings…' };
    const improvedText = extractJson(await complete({ prompt: `${basePrompt}\n\nA design review of your JSON found these problems:\n${issueList(warnings)}\n\nCurrent JSON:\n${text.slice(0, 200_000)}\n\nFix every listed problem without removing content or changing the plan. Return the complete JSON object only.` }));
    const improved = parseDesignSpec(improvedText);
    // Keep the improvement only if it is still valid and genuinely has fewer problems.
    if (improved.valid && improved.value) {
      const next = auditDesignQuality(improved.value);
      if (next.filter((f) => f.severity === 'warning').length < warnings.length) { text = improvedText; findings = next; rounds++; }
      else yield { type: 'stage', stage: 'review', message: 'Improvement attempt did not reduce problems; keeping the validated version.' };
    } else yield { type: 'stage', stage: 'review', message: 'Improvement attempt broke the schema; keeping the validated version.' };
  } else yield { type: 'stage', stage: 'review', message: findings.length ? `Review passed with ${findings.length} suggestion(s).` : 'Review passed with no findings.' };

  yield { type: 'stage', stage: 'done', message: 'Design is ready to insert into Figma.' };
  yield { type: 'result', json: text, findings, rounds };
}
