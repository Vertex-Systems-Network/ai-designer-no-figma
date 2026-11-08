import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('repository knowledge audit', () => {
  it('validates required docs, registry paths and local Markdown links', () => {
    const output = execFileSync(process.execPath, ['scripts/repository-audit.mjs','--strict'], { encoding:'utf8' });
    expect(output).toContain('Findings: 0');
  });
});
