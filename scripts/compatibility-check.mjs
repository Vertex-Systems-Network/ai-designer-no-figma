import { readFile, writeFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile('manifest.json','utf8'));
const packageJson = JSON.parse(await readFile('package.json','utf8'));
const lock = JSON.parse(await readFile('package-lock.json','utf8'));
const typings = lock.packages?.['node_modules/@figma/plugin-typings']?.version ?? 'not found in lockfile';
const date = new Date().toISOString().slice(0,10);
const report = `# Compatibility check — ${date}\n\n- Manifest Plugin API declaration: \`${manifest.api}\`.\n- Locked \`@figma/plugin-typings\` version: \`${typings}\`.\n- Package Node engine requirement: \`${packageJson.engines?.node ?? 'not declared (README says Node 20+)'}\`.\n- Capability evidence: TypeScript compile against installed typings; schema Auto Layout mode/alignment mappings are isolated in src/plugin/compatibility.ts and tested in src/plugin/compatibility.test.ts.\n- Adapter coverage: schema layout mode and primary-axis alignment round-trip only; other Figma API mappings remain in the renderer.\n- Live Figma capability check: NOT performed by this script.\n- Official changelog review: NOT performed by this script; no changelog finding is inferred.\n\nThis is a local metadata/typing comparison, not a live compatibility certification. Review official Figma Plugin API release notes before changing mappings.\n`;
await writeFile('docs/COMPATIBILITY-REPORT.md',report);
console.log(report);
