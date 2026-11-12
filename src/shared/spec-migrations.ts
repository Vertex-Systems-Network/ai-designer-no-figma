/**
 * Versioned migration interface for design specifications (issue #5).
 * Each migration upgrades one source version to the next and reports what it changed,
 * so callers can show the user exactly which edits were made before validation.
 * Strict validation (parseDesignSpec) is unchanged; migrations run only on input that
 * failed it, and the result must still pass validation.
 */
export type MigrationReport = { from: string; to: string; applied: string[] };
type Migration = { from: string; to: string; migrate: (input: Record<string, unknown>, note: (change: string) => void) => Record<string, unknown> };

export const CURRENT_SCHEMA_VERSION = '1.0';
const CONTAINERS = new Set(['frame', 'group', 'component']);
const TYPE_ALIASES: Record<string, string> = { rect: 'rectangle', 'component-instance': 'instance', svg: 'vector', textbox: 'text' };

/** "0" = unversioned or loosely written schema (common in model output) → 1.0. */
const legacyToV1: Migration = {
  from: '0', to: '1.0',
  migrate(input, note) {
    const out: Record<string, unknown> = { ...input, schemaVersion: '1.0' };
    if (typeof out.name !== 'string' || !out.name.trim()) { out.name = 'Untitled design'; note('added missing document name'); }
    let pages = out.pages;
    if (!Array.isArray(pages) && Array.isArray(out.children)) { pages = [{ id: 'page-1', name: 'Page 1', children: out.children }]; delete out.children; note('wrapped top-level children in a page'); }
    if (Array.isArray(pages)) out.pages = pages.map((page, index) => {
      if (!page || typeof page !== 'object') return page;
      const p = { ...(page as Record<string, unknown>) };
      if (typeof p.id !== 'string') { p.id = `page-${index + 1}`; note(`pages[${index}]: added id`); }
      if (typeof p.name !== 'string') { p.name = `Page ${index + 1}`; note(`pages[${index}]: added name`); }
      if (Array.isArray(p.children)) p.children = p.children.map((child, i) => migrateNode(child, `pages[${index}].children[${i}]`, note));
      return p;
    });
    return out;
  },
};

function migrateNode(value: unknown, path: string, note: (change: string) => void): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const node = { ...(value as Record<string, unknown>) };
  if (typeof node.type === 'string') {
    const lower = node.type.toLowerCase();
    const type = TYPE_ALIASES[lower] ?? lower;
    if (type !== node.type) { note(`${path}: type "${String(node.type)}" → "${type}"`); node.type = type; }
  }
  if (node.type === 'text' && node.text === undefined && typeof node.characters === 'string') { node.text = node.characters; delete node.characters; note(`${path}: characters → text`); }
  if (node.layout === undefined && node.autoLayout && typeof node.autoLayout === 'object') {
    const layout = { ...(node.autoLayout as Record<string, unknown>) };
    if (typeof layout.mode === 'string') layout.mode = layout.mode.toLowerCase();
    if (typeof layout.direction === 'string' && layout.mode === undefined) { layout.mode = layout.direction.toLowerCase(); delete layout.direction; }
    node.layout = layout; delete node.autoLayout; note(`${path}: autoLayout → layout`);
  } else if (node.layout && typeof node.layout === 'object' && typeof (node.layout as { mode?: unknown }).mode === 'string') {
    const mode = (node.layout as { mode: string }).mode;
    if (mode !== mode.toLowerCase()) { node.layout = { ...(node.layout as object), mode: mode.toLowerCase() }; note(`${path}: layout.mode lower-cased`); }
  }
  if (typeof node.type === 'string' && CONTAINERS.has(node.type) && !Array.isArray(node.children)) { node.children = []; note(`${path}: added empty children`); }
  if (Array.isArray(node.children)) node.children = node.children.map((child, i) => migrateNode(child, `${path}.children[${i}]`, note));
  return node;
}

const MIGRATIONS: Migration[] = [legacyToV1];

/** Detect the source version: '1.0' when declared exactly, otherwise the legacy '0' track. */
export function detectVersion(input: unknown): string {
  const version = input && typeof input === 'object' ? (input as { schemaVersion?: unknown }).schemaVersion : undefined;
  if (version === CURRENT_SCHEMA_VERSION) return CURRENT_SCHEMA_VERSION;
  if (version === undefined || version === 1 || version === '1' || version === 0 || version === '0') return '0';
  return String(version);
}

export function migrateDesignSpec(input: unknown): { value: unknown; report: MigrationReport } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Design specification must be a JSON object.');
  const from = detectVersion(input);
  const applied: string[] = [];
  const note = (change: string) => { if (applied.length < 200) applied.push(change); };
  let current = input as Record<string, unknown>; let version = from;
  if (version === CURRENT_SCHEMA_VERSION) current = legacyToV1.migrate(current, note); // normalise loose 1.0 output too
  while (version !== CURRENT_SCHEMA_VERSION) {
    const step = MIGRATIONS.find((m) => m.from === version);
    if (!step) throw new Error(`No migration from schemaVersion "${version}" to ${CURRENT_SCHEMA_VERSION}. Supported: unversioned/1/1.0.`);
    current = step.migrate(current, note); version = step.to;
    if (from !== CURRENT_SCHEMA_VERSION) note(`schemaVersion ${from === '0' ? 'missing/legacy' : from} → ${step.to}`);
  }
  return { value: current, report: { from, to: CURRENT_SCHEMA_VERSION, applied } };
}

/** Strict parse first; only if that fails, migrate and validate again. The returned report lists every change. */
export async function parseWithMigration(json: string): Promise<{ result: import('./spec').ValidationResult; report?: MigrationReport }> {
  const { parseDesignSpec, validateDesignSpec } = await import('./spec');
  const strict = parseDesignSpec(json);
  if (strict.valid) return { result: strict };
  let raw: unknown;
  try { raw = JSON.parse(json.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')); } catch { return { result: strict }; }
  try {
    const { value, report } = migrateDesignSpec(raw);
    const migrated = validateDesignSpec(value);
    return migrated.valid ? { result: migrated, report } : { result: strict };
  } catch { return { result: strict }; }
}
