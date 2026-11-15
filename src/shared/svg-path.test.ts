import { describe, it, expect } from 'vitest';
import { toFigmaPath } from './svg-path';

describe('SVG path → Figma vectorPaths', () => {
  it('turns H/V and relative commands into absolute L', () => {
    expect(toFigmaPath('M0 0H24V12h-4v-2z')).toBe('M 0 0 L 24 0 L 24 12 L 20 12 L 20 10 Z');
  });
  it('expands S, T and arcs and keeps M/L/C/Q', () => {
    expect(toFigmaPath('M0 0 C1 1 2 2 3 3 S5 5 6 6')).toBe('M 0 0 C 1 1 2 2 3 3 C 4 4 5 5 6 6');
    expect(toFigmaPath('M0 0 Q5 5 10 0 T20 0')).toBe('M 0 0 Q 5 5 10 0 Q 15 -5 20 0');
    expect(toFigmaPath('M0 10 A10 10 0 0 1 20 10')).toMatch(/^M 0 10 (C [-\d. ]+ ?)+$/);
    expect(toFigmaPath('M1 2 3 4')).toBe('M 1 2 L 3 4');
  });
  it('rejects malformed paths', () => { expect(() => toFigmaPath('M0')).toThrow(/Invalid SVG path/); });
});
