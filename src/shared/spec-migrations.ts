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
  normalizeAliases(node, path, note);
  if (typeof node.type === 'string' && CONTAINERS.has(node.type) && !Array.isArray(node.children)) { node.children = []; note(`${path}: added empty children`); }
  if (Array.isArray(node.children)) node.children = node.children.map((child, i) => migrateNode(child, `${path}.children[${i}]`, note));
  return node;
}

type Note = (change: string) => void;
type Matrix = [[number, number, number], [number, number, number]];
const ALIGN: Record<string, string> = { left: 'LEFT', center: 'CENTER', centre: 'CENTER', right: 'RIGHT', justify: 'JUSTIFIED', justified: 'JUSTIFIED', start: 'LEFT', end: 'RIGHT' };
const WEIGHTS: Record<string, number> = { thin: 100, hairline: 100, extralight: 200, ultralight: 200, light: 300, regular: 400, normal: 400, book: 400, medium: 500, semibold: 600, demibold: 600, bold: 700, extrabold: 800, ultrabold: 800, black: 900, heavy: 900 };
const round = (value: number) => (Math.round(value * 1e6) / 1e6) || 0; // || 0 drops -0

/** "#RRGGBBAA", "#RGB" or "rgb(a)(…)" → "#RRGGBB" plus an opacity; returns undefined when not a colour. */
export function normalizeColor(value: unknown): { color: string; opacity?: number } | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  let match = /^#([0-9a-f]{3})$/i.exec(text);
  if (match) return { color: `#${match[1]!.split('').map((c) => c + c).join('').toUpperCase()}` };
  match = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(text);
  if (match) return { color: `#${match[1]!.toUpperCase()}`, ...(match[2] ? { opacity: round(parseInt(match[2], 16) / 255) } : {}) };
  match = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/i.exec(text);
  if (match) {
    const hex = [match[1], match[2], match[3]].map((part) => Math.max(0, Math.min(255, Math.round(Number(part)))).toString(16).padStart(2, '0')).join('').toUpperCase();
    const alpha = match[4] === undefined ? undefined : match[4].endsWith('%') ? Number(match[4].slice(0, -1)) / 100 : Number(match[4]);
    return { color: `#${hex}`, ...(alpha !== undefined && alpha < 1 ? { opacity: round(alpha) } : {}) };
  }
  return undefined;
}

/** Figma gradientTransform for a linear gradient running from `start` to `end` (both in 0–1 node coordinates). */
export function linearTransform(start: { x: number; y: number }, end: { x: number; y: number }): Matrix {
  const dx = end.x - start.x, dy = end.y - start.y;
  if (dx * dx + dy * dy < 1e-9) return [[1, 0, 0], [0, 1, 0]];
  // Figma gradient space runs along x from (0,0.5) to (1,0.5). Map gradient → node space, then invert.
  const a = dx, b = -dy, c = start.x + 0.5 * dy, d = dy, e = dx, f = start.y - 0.5 * dx; const det = a * e - b * d;
  return [[round(e / det), round(-b / det), round((b * f - c * e) / det)], [round(-d / det), round(a / det), round((c * d - a * f) / det)]];
}
/** CSS-style angle in degrees: 0 = bottom→top, 90 = left→right, 180 = top→bottom. */
export function angleTransform(degrees: number): Matrix {
  const rad = (degrees * Math.PI) / 180; const vx = Math.sin(rad) / 2, vy = -Math.cos(rad) / 2;
  return linearTransform({ x: 0.5 - vx, y: 0.5 - vy }, { x: 0.5 + vx, y: 0.5 + vy });
}

function normalizeStops(stops: unknown, path: string, note: Note): unknown {
  if (!Array.isArray(stops)) return stops;
  const out = stops.map((stop, index) => {
    if (!stop || typeof stop !== 'object') return stop;
    const s = { ...(stop as Record<string, unknown>) };
    if (s.position === undefined && typeof s.offset === 'number') { s.position = s.offset; delete s.offset; note(`${path}[${index}]: offset → position`); }
    if (typeof s.position === 'number' && s.position > 1 && s.position <= 100) { s.position = s.position / 100; note(`${path}[${index}]: position percent → 0–1`); }
    const color = normalizeColor(s.color);
    if (color && color.color !== s.color) { s.color = color.color; if (color.opacity !== undefined && s.opacity === undefined) s.opacity = color.opacity; note(`${path}[${index}]: colour normalised`); }
    return s;
  });
  return out.every((s) => s && typeof (s as { position?: unknown }).position === 'number') ? [...out].sort((a, b) => (a as { position: number }).position - (b as { position: number }).position) : out;
}

/** Accept the gradient shapes AI tools and Penpot use: angle, start/end, handles, or stops at the paint's top level. */
function normalizeGradient(paint: Record<string, unknown>, path: string, note: Note): void {
  const g: Record<string, unknown> = paint.gradient && typeof paint.gradient === 'object' ? { ...(paint.gradient as Record<string, unknown>) } : {};
  for (const key of ['stops', 'angle', 'start', 'end', 'handles', 'transform', 'direction']) if (paint[key] !== undefined && g[key] === undefined) { g[key] = paint[key]; delete paint[key]; note(`${path}: ${key} moved into gradient`); }
  if (g.stops !== undefined) g.stops = normalizeStops(g.stops, `${path}.gradient.stops`, note);
  if (paint.type === 'linear-gradient' && g.transform === undefined) {
    const point = (value: unknown) => value && typeof value === 'object' && typeof (value as { x?: unknown }).x === 'number' && typeof (value as { y?: unknown }).y === 'number' ? value as { x: number; y: number } : undefined;
    const handles = Array.isArray(g.handles) ? g.handles.map(point) : [];
    const start = point(g.start) ?? handles[0], end = point(g.end) ?? handles[1];
    if (typeof g.angle === 'number') { g.transform = angleTransform(g.angle); note(`${path}: angle ${g.angle}° → transform`); }
    else if (start && end) { g.transform = linearTransform(start, end); note(`${path}: start/end → transform`); }
  }
  for (const key of ['angle', 'start', 'end', 'handles']) delete g[key];
  if (paint.type === 'linear-gradient' && g.direction === undefined) g.direction = 'horizontal';
  if (typeof g.direction === 'string') g.direction = g.direction.toLowerCase();
  paint.gradient = g;
}

const PAINT_ALIASES: Record<string, string> = { linear: 'linear-gradient', 'gradient-linear': 'linear-gradient', linear_gradient: 'linear-gradient', radial: 'radial-gradient', 'gradient-radial': 'radial-gradient', angular: 'angular-gradient', diamond: 'diamond-gradient', color: 'solid', fill: 'solid' };
function normalizePaint(value: unknown, path: string, note: Note): unknown {
  if (!value || typeof value !== 'object') return value;
  const paint = { ...(value as Record<string, unknown>) };
  if (typeof paint.type === 'string') { const t = paint.type.toLowerCase(); const mapped = PAINT_ALIASES[t] ?? t; if (mapped !== paint.type) { note(`${path}: paint type "${paint.type}" → "${mapped}"`); paint.type = mapped; } }
  if (paint.type === 'solid') { const c = normalizeColor(paint.color); if (c && c.color !== paint.color) { paint.color = c.color; if (c.opacity !== undefined && paint.opacity === undefined) paint.opacity = c.opacity; note(`${path}: colour normalised`); } }
  if (typeof paint.type === 'string' && paint.type.endsWith('-gradient')) normalizeGradient(paint, path, note);
  if (paint.type === 'image' && typeof paint.scaleMode === 'string') paint.scaleMode = paint.scaleMode.toUpperCase();
  return paint;
}

/** Common property spellings from other tools (Figma API, Penpot, CSS) mapped to schema 1.0. */
function normalizeAliases(node: Record<string, unknown>, path: string, note: Note): void {
  if (node.paints === undefined && Array.isArray(node.fills)) { node.paints = node.fills; delete node.fills; note(`${path}: fills → paints`); }
  if (Array.isArray(node.paints)) node.paints = node.paints.map((paint, index) => normalizePaint(paint, `${path}.paints[${index}]`, note));
  for (const key of ['fill', 'color', 'stroke']) { const c = normalizeColor(node[key]); if (c && c.color !== node[key]) { node[key] = c.color; note(`${path}: ${key} colour normalised`); if (c.opacity !== undefined && key === 'stroke' && node.strokeOpacity === undefined) node.strokeOpacity = c.opacity; } }
  // corner radius
  if (node.radius === undefined && typeof node.cornerRadius === 'number') { node.radius = node.cornerRadius; delete node.cornerRadius; note(`${path}: cornerRadius → radius`); }
  const corners = ['topLeftRadius', 'topRightRadius', 'bottomRightRadius', 'bottomLeftRadius'];
  let radii: number[] | undefined;
  if (Array.isArray(node.radius) && node.radius.length === 4 && node.radius.every((v) => typeof v === 'number')) radii = node.radius as number[];
  else if (node.radius && typeof node.radius === 'object' && !Array.isArray(node.radius)) { const r = node.radius as Record<string, number>; radii = [r.topLeft ?? 0, r.topRight ?? 0, r.bottomRight ?? 0, r.bottomLeft ?? 0]; }
  else if (corners.some((key) => typeof node[key] === 'number')) radii = corners.map((key) => (node[key] as number) ?? 0);
  if (radii) {
    for (const key of corners) delete node[key];
    if (node.type === 'ellipse' || node.type === 'text' || node.type === 'line') { delete node.radius; note(`${path}: per-corner radius ignored for ${String(node.type)}`); }
    else if (radii.every((v) => v === radii![0])) { node.radius = radii[0]; note(`${path}: equal corner radii → radius`); }
    else { delete node.radius; node.cornerRadii = { topLeft: radii[0], topRight: radii[1], bottomRight: radii[2], bottomLeft: radii[3] }; note(`${path}: per-corner radius → cornerRadii`); }
  }
  if (node.type === 'text') {
    for (const key of ['textAlign', 'textAlignHorizontal', 'horizontalAlign']) if (node[key] !== undefined) { if (node.align === undefined) node.align = node[key]; delete node[key]; note(`${path}: ${key} → align`); }
    if (typeof node.align === 'string') node.align = ALIGN[node.align.toLowerCase()] ?? node.align.toUpperCase();
    if (typeof node.textAlignVertical === 'string') node.textAlignVertical = node.textAlignVertical.toUpperCase() === 'MIDDLE' ? 'CENTER' : node.textAlignVertical.toUpperCase();
    if (typeof node.textAutoResize === 'string') node.textAutoResize = node.textAutoResize.toUpperCase().replace(/-/g, '_');
    if (typeof node.fontWeight === 'string') { const w = WEIGHTS[node.fontWeight.toLowerCase().replace(/[\s_-]/g, '')] ?? Number(node.fontWeight); if (Number.isFinite(w)) { if (node.fontStyle === undefined && Number.isNaN(Number(node.fontWeight))) node.fontStyle = node.fontWeight; node.fontWeight = w; note(`${path}: fontWeight → ${w}`); } }
    if (typeof node.letterSpacing === 'number') { node.letterSpacing = { unit: 'PIXELS', value: node.letterSpacing }; note(`${path}: letterSpacing number → {unit:PIXELS}`); }
    if (node.lineHeight && typeof node.lineHeight === 'object') {
      const lh = node.lineHeight as { value?: number; unit?: string };
      if (lh.unit === 'AUTO') delete node.lineHeight;
      else if (typeof lh.value === 'number') node.lineHeight = lh.unit === 'PERCENT' ? round((lh.value / 100) * ((node.fontSize as number) ?? 16)) : lh.value;
      note(`${path}: lineHeight object → px`);
    }
    if (node.text === undefined && typeof node.content === 'string') { node.text = node.content; delete node.content; note(`${path}: content → text`); }
  }
  if (node.type === 'image' && typeof node.scaleMode === 'string') node.scaleMode = node.scaleMode.toUpperCase();
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
    return migrated.valid ? { result: migrated, report } : { result: migrated.issues.length ? migrated : strict, report };
  } catch { return { result: strict }; }
}
