// Performance fixtures for the non-Figma pipeline (issue #7): validation, quality audit,
// migration and patch parsing for component, screen, multi-screen, edit and large-import cases.
// Figma-side rendering time needs live Figma and is not measured here.
// Run: npm run bench   (add --json for machine-readable output)
import { performance } from 'node:perf_hooks';
import { cpus, platform, release } from 'node:os';
import { buildComponentKit } from '../../src/shared/component-kit';
import { auditDesignQuality, parseDesignSpec, MAX_NODES } from '../../src/shared/spec';
import { parseWithMigration } from '../../src/shared/spec-migrations';
import { parseEditPatch } from '../../src/shared/edit-patch';

type Fixture = { name: string; json: string; nodes: number; run: (json: string) => unknown | Promise<unknown> };

function screen(index: number, rows: number): Record<string, unknown> {
  const children = Array.from({ length: rows }, (_, r) => ({ type: 'frame', id: `s${index}-row-${r}`, name: `Row ${r + 1}`, y: 80 + r * 44, width: 1200, height: 40, fill: '#FFFFFF', layout: { mode: 'horizontal', gap: 16, padding: 8, alignment: 'CENTER' }, children: [
    { type: 'text', id: `s${index}-row-${r}-name`, name: 'Customer name', width: 400, height: 22, text: `Customer ${r + 1}`, fontSize: 14, color: '#14171C' },
    { type: 'text', id: `s${index}-row-${r}-value`, name: 'Amount', width: 200, height: 22, text: `$${(r + 1) * 120}`, fontSize: 14, color: '#14171C' },
  ] }));
  return { type: 'frame', id: `screen-${index}`, name: `Screen ${index + 1}`, x: index * 1500, width: 1440, height: 80 + rows * 44, fill: '#F6F7F9', children };
}
const doc = (screens: Record<string, unknown>[]) => JSON.stringify({ schemaVersion: '1.0', name: 'Benchmark', pages: [{ id: 'p', name: 'Benchmark', children: screens }] });
const count = (json: string) => (json.match(/"id":/g) ?? []).length - 1;
const validateAndAudit = (json: string) => { const r = parseDesignSpec(json); if (!r.valid || !r.value) throw new Error(JSON.stringify(r.issues.slice(0, 3))); return auditDesignQuality(r.value); };

const kit = JSON.stringify(buildComponentKit({ brandColor: '#0D8A60' }));
const single = doc([screen(0, 60)]);
const multi = doc(Array.from({ length: 5 }, (_, i) => screen(i, 60)));
const rowsForLimit = Math.floor((MAX_NODES - 2) / 3) - 1;
const large = doc([screen(0, rowsForLimit)]);
const legacy = single.replace('"schemaVersion":"1.0",', '').replaceAll('"type":"frame"', '"type":"FRAME"');
const patch = JSON.stringify({ operations: Array.from({ length: 50 }, (_, i) => ({ op: 'set-text', targetId: `s0-row-${i}-name`, value: `Updated ${i}` })) });
const patchIds = new Set(Array.from({ length: 60 }, (_, i) => `s0-row-${i}-name`));

const fixtures: Fixture[] = [
  { name: 'Component kit (validate + audit)', json: kit, nodes: count(kit), run: validateAndAudit },
  { name: 'Single screen (validate + audit)', json: single, nodes: count(single), run: validateAndAudit },
  { name: 'Five screens (validate + audit)', json: multi, nodes: count(multi), run: validateAndAudit },
  { name: `Large import near ${MAX_NODES}-node limit`, json: large, nodes: count(large), run: validateAndAudit },
  { name: 'Legacy model output (migrate + validate)', json: legacy, nodes: count(legacy), run: async (json) => { const r = await parseWithMigration(json); if (!r.result.valid) throw new Error('migration failed'); } },
  { name: 'Edit patch, 50 operations', json: patch, nodes: 50, run: (json) => { const r = parseEditPatch(json, patchIds); if (!r.valid) throw new Error('patch invalid'); } },
];

const iterations = 30;
const results: Array<{ name: string; nodes: number; kib: number; medianMs: number; p95Ms: number }> = [];
for (const fixture of fixtures) {
  for (let i = 0; i < 3; i++) await fixture.run(fixture.json); // warm-up
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) { const start = performance.now(); await fixture.run(fixture.json); times.push(performance.now() - start); }
  times.sort((a, b) => a - b);
  results.push({ name: fixture.name, nodes: fixture.nodes, kib: Math.round(Buffer.byteLength(fixture.json) / 102.4) / 10, medianMs: +times[Math.floor(iterations / 2)]!.toFixed(2), p95Ms: +times[Math.floor(iterations * 0.95)]!.toFixed(2) });
}
const environment = `${platform()} ${release()}, ${cpus()[0]?.model ?? 'unknown CPU'}, Node ${process.version}`;
if (process.argv.includes('--json')) console.log(JSON.stringify({ environment, iterations, results }, null, 2));
else {
  console.log(`Environment: ${environment}; ${iterations} runs each\n`);
  console.log('| Fixture | Nodes | Size (KiB) | Median (ms) | p95 (ms) |\n|---|---:|---:|---:|---:|');
  for (const r of results) console.log(`| ${r.name} | ${r.nodes} | ${r.kib} | ${r.medianMs} | ${r.p95Ms} |`);
}
