import type { EditPatch } from './protocol';
import { utf8ByteLength } from './utf8';

export type PatchValidation = { valid: true; value: EditPatch } | { valid: false; message: string };

export function parseEditPatch(json: string, allowedIds?: ReadonlySet<string>): PatchValidation {
  if (utf8ByteLength(json) > 262_144) return { valid: false, message: 'Patch JSON exceeds the 256 KB limit.' };
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
    if (!['set-text', 'set-fill', 'rename', 'set-bounds', 'set-auto-layout'].includes(String(op.op))) return { valid: false, message: `${path}.op is unsupported.` };
    if (typeof op.targetId !== 'string' || !op.targetId || op.targetId.length > 200) return { valid: false, message: `${path}.targetId must be a non-empty string.` };
    if (allowedIds && !allowedIds.has(op.targetId)) return { valid: false, message: `${path}.targetId is not present in the current selection.` };
    if (op.op === 'set-bounds') {
      if (!op.value || typeof op.value !== 'object' || Array.isArray(op.value)) return { valid: false, message: `${path}.value must contain x, y, width, and height numbers.` };
      const bounds = op.value as Record<string, unknown>;
      if (Object.keys(bounds).length !== 4 || !['x','y','width','height'].every((key) => key in bounds)) return { valid: false, message: `${path}.value must contain only x, y, width, and height.` };
      if (typeof bounds.x !== 'number' || !Number.isFinite(bounds.x) || Math.abs(bounds.x) > 100_000 || typeof bounds.y !== 'number' || !Number.isFinite(bounds.y) || Math.abs(bounds.y) > 100_000 || typeof bounds.width !== 'number' || !Number.isFinite(bounds.width) || bounds.width <= 0 || bounds.width > 100_000 || typeof bounds.height !== 'number' || !Number.isFinite(bounds.height) || bounds.height <= 0 || bounds.height > 100_000) return { valid: false, message: `${path}.value has invalid bounds; x/y must be within ±100,000 and width/height must be 1–100,000.` };
      continue;
    }
    if(op.op==='set-auto-layout'){
      if(!op.value||typeof op.value!=='object'||Array.isArray(op.value))return{valid:false,message:`${path}.value must contain mode, gap, padding, and alignment.`};
      const layout=op.value as Record<string,unknown>;const keys=['mode','gap','padding','alignment'];
      if(Object.keys(layout).length!==keys.length||keys.some(key=>!(key in layout)))return{valid:false,message:`${path}.value must contain only mode, gap, padding, and alignment.`};
      if(!['NONE','HORIZONTAL','VERTICAL'].includes(String(layout.mode)))return{valid:false,message:`${path}.value.mode must be NONE, HORIZONTAL, or VERTICAL.`};
      if(typeof layout.gap!=='number'||!Number.isFinite(layout.gap)||layout.gap<0||layout.gap>1000||typeof layout.padding!=='number'||!Number.isFinite(layout.padding)||layout.padding<0||layout.padding>1000)return{valid:false,message:`${path}.value gap and padding must be between 0 and 1,000.`};
      if(!['MIN','CENTER','MAX','SPACE_BETWEEN'].includes(String(layout.alignment)))return{valid:false,message:`${path}.value.alignment is unsupported.`};
      continue;
    }
    if (typeof op.value !== 'string' || op.value.length > 20_000) return { valid: false, message: `${path}.value must be a string no longer than 20,000 characters.` };
    if (op.op === 'set-fill' && !/^#[0-9a-f]{6}$/i.test(op.value)) return { valid: false, message: `${path}.value must be a six-digit hex color for set-fill.` };
  }
  return { valid: true, value: parsed as EditPatch };
}
