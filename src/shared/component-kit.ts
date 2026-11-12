import type { DesignNodeSpec, DesignSpec } from './spec';

/**
 * Deterministic reusable component kit (issue #2): builds native Figma components
 * (buttons, input, card, navigation, table row) bound to named color/text tokens from
 * a brand color plus typography and spacing scales. Output is plain schema 1.0, so it
 * passes the same validator and renderer as every other design.
 */
export type KitOptions = {
  name?: string;
  brandColor: string;
  fontFamily?: string;
  /** Type scale in px, smallest first: caption, body, label, title, heading. */
  typeScale?: [number, number, number, number, number];
  /** Spacing scale in px, smallest first (needs at least 4 steps). */
  spacing?: number[];
  radius?: number;
  theme?: 'light' | 'dark';
};

const hex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0').toUpperCase();
const rgb = (color: string) => [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16)) as [number, number, number];
const mix = (a: string, b: string, t: number) => { const x = rgb(a), y = rgb(b); return `#${x.map((v, i) => hex(v + (y[i]! - v) * t)).join('')}`; };
export function luminance(color: string): number {
  const [r, g, b] = rgb(color).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export const contrast = (a: string, b: string) => { const [l1, l2] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number]; return (l1 + 0.05) / (l2 + 0.05); };
/** Darken/lighten the brand until text on it, or it on the surface, meets WCAG AA (4.5:1). */
function accessible(color: string, against: string): string {
  let current = color; const target = luminance(against) > 0.5 ? '#000000' : '#FFFFFF';
  for (let i = 0; i < 20 && contrast(current, against) < 4.5; i++) current = mix(current, target, 0.1);
  return current;
}

export function buildComponentKit(options: KitOptions): DesignSpec {
  if (!/^#[0-9A-Fa-f]{6}$/.test(options.brandColor)) throw new Error('brandColor must be #RRGGBB.');
  const font = options.fontFamily ?? 'Inter';
  const [caption, body, label, title, heading] = options.typeScale ?? [12, 14, 14, 18, 28];
  const space = options.spacing ?? [4, 8, 12, 16, 24, 32];
  if (space.length < 4 || space.some((v) => !(v > 0))) throw new Error('spacing needs at least four positive steps.');
  const [xs, sm, md, lg] = space as [number, number, number, number];
  const radius = options.radius ?? 8;
  const dark = options.theme === 'dark';
  const surface = dark ? '#111418' : '#FFFFFF';
  const canvas = dark ? '#0A0C0F' : '#F6F7F9';
  const text = dark ? '#F2F4F7' : '#14171C';
  const muted = accessible(dark ? '#9BA3AF' : '#5B6472', surface);
  const border = dark ? '#2A3038' : '#D9DEE5';
  const primary = accessible(options.brandColor.toUpperCase(), surface);
  const onPrimary = contrast('#FFFFFF', primary) >= 4.5 ? '#FFFFFF' : '#000000';
  const subtle = mix(primary, surface, 0.88);

  const colors = [
    { name: 'Color/Primary', color: primary }, { name: 'Color/On primary', color: onPrimary },
    { name: 'Color/Surface', color: surface }, { name: 'Color/Canvas', color: canvas },
    { name: 'Color/Text', color: text }, { name: 'Color/Muted', color: muted },
    { name: 'Color/Border', color: border }, { name: 'Color/Primary subtle', color: subtle },
  ];
  const lh = (size: number) => Math.round(size * 1.4);
  const typography = [
    { name: 'Type/Heading', fontFamily: font, fontSize: heading, fontWeight: 700, lineHeight: lh(heading) },
    { name: 'Type/Title', fontFamily: font, fontSize: title, fontWeight: 600, lineHeight: lh(title) },
    { name: 'Type/Label', fontFamily: font, fontSize: label, fontWeight: 600, lineHeight: lh(label) },
    { name: 'Type/Body', fontFamily: font, fontSize: body, fontWeight: 400, lineHeight: lh(body) },
    { name: 'Type/Caption', fontFamily: font, fontSize: caption, fontWeight: 400, lineHeight: lh(caption) },
  ];
  const t = (id: string, name: string, value: string, style: string, color: string, width: number, extra: Record<string, unknown> = {}): DesignNodeSpec =>
    ({ type: 'text', id, name, text: value, textStyleToken: style, fillToken: color, width, height: lh(typography.find((s) => s.name === style)!.fontSize), ...extra }) as DesignNodeSpec;

  const buttonH = lh(label) + md * 2;
  const button = (id: string, name: string, fill: string, ink: string, labelText: string): DesignNodeSpec => ({
    type: 'component', id, name, width: 140, height: buttonH, fillToken: fill, radius,
    layout: { mode: 'horizontal', gap: xs, padding: md, alignment: 'CENTER' },
    children: [t(`${id}-label`, 'Label', labelText, 'Type/Label', ink, 140 - md * 2, { align: 'CENTER' })],
  } as DesignNodeSpec);
  const inputW = 320, inputH = lh(body) + md * 2;
  const components: DesignNodeSpec[] = [
    button('kit-button-primary', 'Button/Primary', 'Color/Primary', 'Color/On primary', 'Continue'),
    button('kit-button-secondary', 'Button/Secondary', 'Color/Primary subtle', 'Color/Primary', 'Cancel'),
    { type: 'component', id: 'kit-input', name: 'Input/Text', width: inputW, height: lh(caption) + xs + inputH, layout: { mode: 'vertical', gap: xs, padding: 0, alignment: 'MIN' }, children: [
      t('kit-input-label', 'Field label', 'Email address', 'Type/Caption', 'Color/Muted', inputW),
      { type: 'frame', id: 'kit-input-field', name: 'Field', width: inputW, height: inputH, fillToken: 'Color/Surface', radius, effects: [{ type: 'inner-shadow', color: border, opacity: 1, offsetX: 0, offsetY: 0, blur: 1 }], layout: { mode: 'horizontal', gap: sm, padding: md, alignment: 'MIN' }, children: [
        t('kit-input-placeholder', 'Placeholder', 'name@company.com', 'Type/Body', 'Color/Muted', inputW - md * 2),
      ] },
    ] } as DesignNodeSpec,
    { type: 'component', id: 'kit-card', name: 'Card/Metric', width: 280, height: lg * 2 + lh(caption) + lh(heading) + lh(caption) + sm * 2, fillToken: 'Color/Surface', radius: radius + 4, effects: [{ type: 'drop-shadow', color: '#000000', opacity: dark ? 0.4 : 0.06, offsetX: 0, offsetY: 2, blur: 8 }], layout: { mode: 'vertical', gap: sm, padding: lg, alignment: 'MIN' }, children: [
      t('kit-card-label', 'Metric label', 'Monthly revenue', 'Type/Caption', 'Color/Muted', 280 - lg * 2),
      t('kit-card-value', 'Metric value', '$48,290', 'Type/Heading', 'Color/Text', 280 - lg * 2),
      t('kit-card-delta', 'Metric change', '+12.4% vs last month', 'Type/Caption', 'Color/Primary', 280 - lg * 2),
    ] } as DesignNodeSpec,
    { type: 'component', id: 'kit-nav', name: 'Navigation/Top bar', width: 1200, height: lh(title) + md * 2, fillToken: 'Color/Surface', layout: { mode: 'horizontal', gap: lg * 2, padding: md, alignment: 'CENTER' }, children: [
      t('kit-nav-brand', 'Product name', options.name ?? 'Product', 'Type/Title', 'Color/Text', 200),
      t('kit-nav-link-1', 'Nav link', 'Overview', 'Type/Label', 'Color/Primary', 100),
      t('kit-nav-link-2', 'Nav link', 'Reports', 'Type/Label', 'Color/Muted', 100),
      t('kit-nav-link-3', 'Nav link', 'Settings', 'Type/Label', 'Color/Muted', 100),
    ] } as DesignNodeSpec,
    { type: 'component', id: 'kit-table-row', name: 'Table/Row', width: 720, height: lh(body) + md * 2, fillToken: 'Color/Surface', layout: { mode: 'horizontal', gap: lg, padding: md, alignment: 'CENTER' }, children: [
      t('kit-row-name', 'Cell name', 'Acme Corporation', 'Type/Body', 'Color/Text', 260),
      t('kit-row-status', 'Cell status', 'Active', 'Type/Label', 'Color/Primary', 120),
      t('kit-row-amount', 'Cell amount', '$12,400', 'Type/Body', 'Color/Text', 140, { align: 'RIGHT' }),
    ] } as DesignNodeSpec,
  ];
  let y = lg * 2;
  const placed = components.map((node) => { const at = { ...node, x: lg * 2, y } as DesignNodeSpec; y += (node as { height: number }).height + lg * 2; return at; });
  const usage: DesignNodeSpec = { type: 'frame', id: 'kit-usage', name: 'Usage example', x: 1300, y: lg * 2, width: 1280, height: 720, fillToken: 'Color/Canvas', radius, layout: { mode: 'vertical', gap: lg, padding: lg * 2, alignment: 'MIN' }, children: [
    { type: 'instance', id: 'kit-usage-nav', name: 'Top bar', componentRef: 'kit-nav', width: 1200, height: (components[4] as { height: number }).height },
    { type: 'instance', id: 'kit-usage-card', name: 'Revenue card', componentRef: 'kit-card', width: 280, height: (components[3] as { height: number }).height },
    { type: 'instance', id: 'kit-usage-row', name: 'Customer row', componentRef: 'kit-table-row', width: 720, height: (components[5] as { height: number }).height },
    { type: 'instance', id: 'kit-usage-button', name: 'Primary action', componentRef: 'kit-button-primary', width: 140, height: buttonH },
  ] } as DesignNodeSpec;
  return {
    schemaVersion: '1.0', name: `${options.name ?? 'Product'} component kit`,
    designSystem: { name: options.name ?? 'Product', colors, typography } as NonNullable<DesignSpec['designSystem']>,
    pages: [{ id: 'kit-page', name: 'Design system', children: [{ type: 'frame', id: 'kit-board', name: 'Components', width: 2640, height: Math.max(y, 800), fillToken: 'Color/Canvas', children: [...placed, usage] } as DesignNodeSpec] }],
  };
}
