import { access, readFile } from 'node:fs/promises';

const checks = [];
const rootManifest = JSON.parse(await readFile('manifest.json','utf8'));
checks.push(['Figma manifest declares official API version', rootManifest.api === '1.0.0']);
checks.push(['Plugin ID is omitted rather than invented', !Object.hasOwn(rootManifest,'id')]);
checks.push(['Plugin network permission uses Figma-compatible localhost loopback', rootManifest.networkAccess.allowedDomains.length > 0 && rootManifest.networkAccess.allowedDomains.every((url) => /^http:\/\/localhost(:\d+)?$/.test(url))]);
checks.push(['Optional local UI endpoint matches the manifest allowlist', (await readFile('src/ui/main.tsx','utf8')).includes("const defaultUrl = 'http://localhost:8787'")]);
checks.push(['No paid inference SDK is a runtime dependency', !Object.keys(JSON.parse(await readFile('package.json','utf8')).dependencies).some((name)=>/openai|anthropic|google-generative|gemini/i.test(name))]);
checks.push(['UI source does not reference remote assets', !(await readFile('src/ui/main.tsx','utf8')).match(/https?:\/\/(?!(127\.0\.0\.1|localhost))/g)]);
checks.push(['Local runtime enforces loopback bind', (await readFile('src/runtime/server.ts','utf8')).includes("['127.0.0.1', '::1']")]);
checks.push(['Build and package scripts do not call Git CLI', !(await readFile('scripts/build.mjs','utf8')).match(/\bgit\s+(init|clone|status|add|commit|push|pull|fetch|checkout|branch|merge|diff)\b/) && !(await readFile('scripts/package.mjs','utf8')).match(/\bgit\s+(init|clone|status|add|commit|push|pull|fetch|checkout|branch|merge|diff)\b/)]);
try {
  const manifest = JSON.parse(await readFile('dist/manifest.json','utf8'));
  await access(`dist/${manifest.main}`); await access(`dist/${manifest.ui}`); await access('dist/runtime.mjs');
  checks.push(['Build manifest points to existing plugin bundles',true]);
} catch { checks.push(['Build manifest points to existing plugin bundles',false]); }
for (const [name,pass] of checks) console.log(`${pass?'PASS':'FAIL'} ${name}`);
if (checks.some(([,pass])=>!pass)) process.exitCode=1;
