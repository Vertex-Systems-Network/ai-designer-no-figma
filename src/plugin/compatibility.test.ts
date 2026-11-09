import { describe, expect, it } from 'vitest';
import { fromFigmaLayoutMode, fromFigmaPrimaryAxisAlignment, toFigmaLayoutMode, toFigmaPrimaryAxisAlignment } from './compatibility';

describe('Figma Plugin API compatibility mappings', () => {
  it('round-trips all schema layout modes through official Figma typings', () => {
    for (const mode of ['none', 'horizontal', 'vertical'] as const) {
      expect(fromFigmaLayoutMode(toFigmaLayoutMode(mode))).toBe(mode);
    }
  });

  it('round-trips supported alignment values and defaults omitted alignment to MIN', () => {
    for (const alignment of ['MIN', 'CENTER', 'MAX', 'SPACE_BETWEEN'] as const) {
      expect(fromFigmaPrimaryAxisAlignment(toFigmaPrimaryAxisAlignment(alignment))).toBe(alignment);
    }
    expect(toFigmaPrimaryAxisAlignment(undefined)).toBe('MIN');
  });
});
