/**
 * Convert any SVG path string into the subset Figma's vectorPaths accepts:
 * absolute M, L, C, Q and Z. Handles relative commands, H/V, S/T and arcs (A, converted to cubics).
 */
const fmt = (n: number) => String(Math.round(n * 1000) / 1000 || 0);

function arcToCubics(x1: number, y1: number, rx: number, ry: number, phi: number, large: boolean, sweep: boolean, x2: number, y2: number): number[][] {
  if (rx === 0 || ry === 0) return [[x1, y1, x2, y2, x2, y2]];
  const sin = Math.sin(phi * Math.PI / 180), cos = Math.cos(phi * Math.PI / 180);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy, y1p = -sin * dx + cos * dy;
  rx = Math.abs(rx); ry = Math.abs(ry);
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) { rx *= Math.sqrt(lambda); ry *= Math.sqrt(lambda); }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const coef = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / (rx * rx * y1p * y1p + ry * ry * x1p * x1p)));
  const cxp = coef * (rx * y1p) / ry, cyp = coef * -(ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2, cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const angle = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI; else if (sweep && dt < 0) dt += 2 * Math.PI;
  const segments = Math.ceil(Math.abs(dt) / (Math.PI / 2)); const step = dt / segments; const k = 4 / 3 * Math.tan(step / 4);
  const point = (t: number) => [cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin, cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos] as const;
  const deriv = (t: number) => [-rx * Math.sin(t) * cos - ry * Math.cos(t) * sin, -rx * Math.sin(t) * sin + ry * Math.cos(t) * cos] as const;
  const out: number[][] = [];
  for (let i = 0; i < segments; i++) {
    const a = t1 + i * step, b = a + step; const [ax, ay] = point(a), [bx, by] = point(b), [dax, day] = deriv(a), [dbx, dby] = deriv(b);
    out.push([ax + k * dax, ay + k * day, bx - k * dbx, by - k * dby, bx, by]);
  }
  return out;
}

export function toFigmaPath(input: string): string {
  const tokens = input.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) ?? [];
  const out: string[] = []; let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, lcx = 0, lcy = 0, lqx = 0, lqy = 0, prev = '';
  const num = () => { const t = tokens[i++]; if (t === undefined || /[a-zA-Z]/.test(t)) throw new Error(`Invalid SVG path near "${cmd}".`); return Number(t); };
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i]!)) cmd = tokens[i++]!;
    else if (!cmd) throw new Error('Invalid SVG path: it must start with a command.');
    const rel = cmd === cmd.toLowerCase() && cmd !== 'z' ? 1 : 0; const C = cmd.toUpperCase(); const ox = rel ? x : 0, oy = rel ? y : 0;
    switch (C) {
      case 'M': x = ox + num(); y = oy + num(); sx = x; sy = y; out.push(`M ${fmt(x)} ${fmt(y)}`); cmd = rel ? 'l' : 'L'; break;
      case 'L': x = ox + num(); y = oy + num(); out.push(`L ${fmt(x)} ${fmt(y)}`); break;
      case 'H': x = ox + num(); out.push(`L ${fmt(x)} ${fmt(y)}`); break;
      case 'V': y = (rel ? y : 0) + num(); out.push(`L ${fmt(x)} ${fmt(y)}`); break;
      case 'C': { const a = [ox + num(), oy + num(), ox + num(), oy + num(), ox + num(), oy + num()]; [lcx, lcy, x, y] = [a[2]!, a[3]!, a[4]!, a[5]!]; out.push(`C ${a.map(fmt).join(' ')}`); break; }
      case 'S': { const r = /[CS]/.test(prev) ? [2 * x - lcx, 2 * y - lcy] : [x, y]; const a = [ox + num(), oy + num(), ox + num(), oy + num()]; out.push(`C ${[...r, ...a].map(fmt).join(' ')}`); [lcx, lcy, x, y] = a as [number, number, number, number]; break; }
      case 'Q': { const a = [ox + num(), oy + num(), ox + num(), oy + num()]; [lqx, lqy, x, y] = a as [number, number, number, number]; out.push(`Q ${a.map(fmt).join(' ')}`); break; }
      case 'T': { const [qx, qy] = /[QT]/.test(prev) ? [2 * x - lqx, 2 * y - lqy] : [x, y]; x = ox + num(); y = oy + num(); [lqx, lqy] = [qx, qy]; out.push(`Q ${[qx, qy, x, y].map(fmt).join(' ')}`); break; }
      case 'A': { const rx = num(), ry = num(), rot = num(), large = num() !== 0, sweep = num() !== 0; const ex = ox + num(), ey = oy + num(); for (const c of arcToCubics(x, y, rx, ry, rot, large, sweep, ex, ey)) out.push(`C ${c.map(fmt).join(' ')}`); x = ex; y = ey; break; }
      case 'Z': out.push('Z'); x = sx; y = sy; break;
      default: throw new Error(`Unsupported SVG path command "${cmd}".`);
    }
    prev = C;
  }
  return out.join(' ');
}
