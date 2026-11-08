import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';

const archive = 'artifacts/ai-designer-no-figma-0.1.0.zip';
const [zipBytes, checksums, manifest, buildReport] = await Promise.all([
  readFile(archive), readFile('artifacts/SHA256SUMS.txt','utf8'), readFile('dist/manifest.json','utf8').then(JSON.parse), readFile('artifacts/BUILD-REPORT.json','utf8').then(JSON.parse),
]);
const digest = createHash('sha256').update(zipBytes).digest('hex');
if (!checksums.includes(`${digest}  ai-designer-no-figma-0.1.0.zip`)) throw new Error('Archive SHA-256 does not match SHA256SUMS.txt.');
if (buildReport.sha256 !== digest) throw new Error('Archive SHA-256 does not match BUILD-REPORT.json.');
for (const path of [`dist/${manifest.main}`,`dist/${manifest.ui}`,'dist/runtime.mjs','dist/mcp.mjs']) await access(path);
const listing = execFileSync('unzip',['-Z1',archive],{encoding:'utf8'}).split(/\r?\n/).filter(Boolean);
for (const path of ['dist/manifest.json','dist/plugin.js','dist/ui.html','dist/runtime.mjs','dist/mcp.mjs','AGENTS.md','docs/FEATURE-REGISTRY.json','scripts/repository-audit.mjs','tools/repository-audit/audit.test.ts']) {
  if (!listing.includes(path)) throw new Error(`Release archive is missing ${path}.`);
}
execFileSync('unzip',['-t',archive],{stdio:'ignore'});
console.log(`PASS ZIP integrity and required release contents\nPASS SHA-256 ${digest}\nPASS manifest entry points exist`);
