import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const hostSource = readFileSync('src/plugin/code.ts', 'utf8');
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8')) as { permissions?: string[] };

describe('Figma plugin host compatibility', () => {
  it('keeps browser networking and timer globals out of the Figma JSVM host', () => {
    expect(hostSource).not.toMatch(/\bfetch\s*\(/);
    expect(hostSource).not.toMatch(/\bnew\s+URL\s*\(/);
    expect(hostSource).not.toMatch(/\bAbortController\b|\bAbortSignal\b/);
    expect(hostSource).not.toMatch(/\bsetTimeout\s*\(|\bsetInterval\s*\(/);
  });

  it('asks Figma only for the signed-in operator identity permission', () => {
    expect(manifest.permissions).toContain('currentuser');
    expect(hostSource).toContain("type:'current-user'");
    expect(hostSource).toContain('figma.currentUser');
  });

  it('supports hiding the panel while keeping the plugin UI alive', () => {
    expect(hostSource).toContain("message.type==='hide-ui'");
    expect(hostSource).toContain('figma.ui.hide()');
    expect(hostSource).toContain("message.type==='bridge-job'");
  });
});
