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
  const inlineScript = `<script>${js.replace(/<\/script/gi, '<\\/script')}</script>`;
  // Use a callback: replacement strings interpret $&, $`, and $'. Bundled JS
  // can contain $' and would otherwise inject the rest of the HTML into the script.
  html = html.replace(match[0], () => inlineScript);
}
for (const match of [...html.matchAll(/<link[^>]+href="([^"]+\.css)"[^>]*>/g)]) {
  const cssPath = resolve(dirname(indexPath), match[1]);
  const css = await readFile(cssPath, 'utf8');
  const inlineStyle = `<style>${css}</style>`;
  html = html.replace(match[0], () => inlineStyle);
}
if (/<script\b[^>]*\bsrc=/i.test(html) || /<link\b[^>]*\bhref="[^"]+\.css"/i.test(html)) {
  throw new Error('Plugin UI build left an external JavaScript or CSS asset reference.');
}
if (!html.includes('<div id="root"></div>') || !html.includes('createRoot')) {
  throw new Error('Plugin UI build is missing its React root or bundled application entry point.');
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
