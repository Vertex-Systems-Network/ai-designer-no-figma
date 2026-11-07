import { build as viteBuild } from 'vite';
import { build as esbuild } from 'esbuild';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

await viteBuild();
const indexPath = resolve('dist/src/ui/index.html');
let html = await readFile(indexPath, 'utf8');
for (const match of [...html.matchAll(/<script[^>]+src="([^"]+)"[^>]*><\/script>/g)]) {
  const jsPath = resolve(dirname(indexPath), match[1]);
  const js = await readFile(jsPath, 'utf8');
  html = html.replace(match[0], `<script>${js.replace(/<\/script/gi, '<\\/script')}</script>`);
}
for (const match of [...html.matchAll(/<link[^>]+href="([^"]+\.css)"[^>]*>/g)]) {
  const cssPath = resolve(dirname(indexPath), match[1]);
  const css = await readFile(cssPath, 'utf8');
  html = html.replace(match[0], `<style>${css}</style>`);
}
await writeFile(resolve('dist/ui.html'), html);
await mkdir(resolve('dist/schema'), { recursive: true });
await copyFile('schema/design-spec-1.0.schema.json', 'dist/schema/design-spec-1.0.schema.json');
await esbuild({
  entryPoints: ['src/plugin/code.ts'], bundle: true, outfile: 'dist/plugin.js', platform: 'browser', target: 'es2020',
  define: { __html__: JSON.stringify(html) },
});
await esbuild({ entryPoints: ['src/runtime/server.ts'], bundle: true, outfile: 'dist/runtime.mjs', platform: 'node', target: 'node20', format: 'esm', packages: 'external' });
const manifest = JSON.parse(await readFile('manifest.json', 'utf8'));
manifest.main = 'plugin.js';
manifest.ui = 'ui.html';
await writeFile(resolve('dist/manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log('Built inline plugin UI, Figma host bundle, local runtime, and development manifest.');
