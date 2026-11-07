import type { EditPatch } from './protocol';

export type PatchValidation = { valid: true; value: EditPatch } | { valid: false; message: string };

export function parseEditPatch(json: string, allowedIds?: ReadonlySet<string>): PatchValidation {
  if (new TextEncoder().encode(json).byteLength > 262_144) return { valid: false, message: 'Patch JSON exceeds the 256 KB limit.' };
  const source = json.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let parsed: unknown;
  try { parsed = JSON.parse(source); }
  catch { return { valid: false, message: 'Invalid patch JSON. Check commas, quotes, and braces.' }; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.keys(parsed).some((key) => key !== 'operations')) {
    return { valid: false, message: 'Patch must be an object containing only an operations array.' };
  }
  const operations = (parsed as { operations?: unknown }).operations;
  if (!Array.isArray(operations) || operations.length > 100) return { valid: false, message: 'Patch must contain an operations array with at most 100 entries.' };
  for (const [index, item] of operations.entries()) {
    const path = `operations[${index}]`;
    if (!item || typeof item !== 'object' || Array.isArray(item)) return { valid: false, message: `${path} must be an object.` };
    const op = item as Record<string, unknown>;
    const allowedKeys = ['op', 'targetId', 'value'];
    if (Object.keys(op).some((key) => !allowedKeys.includes(key)) || Object.keys(op).length !== 3) return { valid: false, message: `${path} must contain only op, targetId, and value.` };
    if (!['set-text', 'set-fill', 'rename'].includes(String(op.op))) return { valid: false, message: `${path}.op is unsupported.` };
    if (typeof op.targetId !== 'string' || !op.targetId || op.targetId.length > 200) return { valid: false, message: `${path}.targetId must be a non-empty string.` };
    if (allowedIds && !allowedIds.has(op.targetId)) return { valid: false, message: `${path}.targetId is not present in the current selection.` };
    if (typeof op.value !== 'string' || op.value.length > 20_000) return { valid: false, message: `${path}.value must be a string no longer than 20,000 characters.` };
    if (op.op === 'set-fill' && !/^#[0-9a-f]{6}$/i.test(op.value)) return { valid: false, message: `${path}.value must be a six-digit hex color for set-fill.` };
  }
  return { valid: true, value: parsed as EditPatch };
}
