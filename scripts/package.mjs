import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, cp, mkdir, mkdtemp, readFile, readdir, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';

await stat('dist/plugin.js');
await stat('dist/ui.html');
await stat('dist/runtime.mjs');
await stat('dist/mcp.mjs');
const artifactDir = 'artifacts';
await mkdir(artifactDir, { recursive: true });
const archive = resolve(artifactDir, 'ai-designer-no-figma-0.1.0.zip');
const stage = await mkdtemp(join(tmpdir(), 'ai-designer-package-'));
const paths = [
  'dist/manifest.json','dist/plugin.js','dist/ui.html','dist/runtime.mjs','dist/mcp.mjs','dist/schema/design-spec-1.0.schema.json',
  'src','schema','scripts','docs','tools','AGENTS.md','CLAUDE.md','GEMINI.md','.cursor','.github','README.md','manifest.json','package.json','package-lock.json','tsconfig.json',
  'vite.config.ts','vitest.config.ts','vitest.integration.config.ts','eslint.config.js','.gitignore','.env.example',
];
for (const path of paths) {
  try { await access(path); } catch { continue; }
  const destination = join(stage, path);
  await mkdir(dirname(destination), { recursive: true });
  await cp(path, destination, { recursive: true, force: true });
}
async function collect(dir) {
  const entries = (await readdir(dir, { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name));
  const files = [];
  for (const entry of entries) {
    const child = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await collect(child));
    else if (entry.isFile()) files.push(relative(stage, child).split(sep).join('/'));
  }
  return files;
}
const stagedFiles = (await collect(stage)).sort();
const fixedDate = new Date('1980-01-01T00:00:00.000Z');
async function normalize(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const child = join(dir, entry.name);
    if (entry.isDirectory()) await normalize(child);
    await utimes(child, fixedDate, fixedDate);
  }
}
await normalize(stage);
await rm(archive, { force: true });
try {
  execFileSync('zip', ['-q','-X','-D',archive,...stagedFiles], { cwd: stage, stdio: 'pipe' });
} catch (error) {
  throw new Error(`ZIP packaging failed. Ensure the zip utility is installed. ${error instanceof Error ? error.message : ''}`);
} finally {
  await rm(stage, { recursive: true, force: true });
}
const bytes = await readFile(archive);
const digest = createHash('sha256').update(bytes).digest('hex');
await writeFile(join(artifactDir, 'SHA256SUMS.txt'), `${digest}  ai-designer-no-figma-0.1.0.zip\n`);
const bundleFiles = await readdir('dist');
await writeFile(join(artifactDir, 'BUILD-REPORT.json'), JSON.stringify({ status: 'BUILT', artifact: 'artifacts/ai-designer-no-figma-0.1.0.zip', sha256: digest, bundleFiles, sourceFiles: stagedFiles.length, generatedAt: new Date().toISOString(), gitCliUsed: false, normalizedArchiveTimestamps: true }, null, 2));
console.log(`Package: ${archive}\nSHA-256: ${digest}`);
