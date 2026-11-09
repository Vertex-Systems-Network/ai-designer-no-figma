import type { LayoutSpec } from '../shared/spec';

/** Map the provider-neutral schema vocabulary to the official Figma Plugin API. */
export function toFigmaLayoutMode(mode: LayoutSpec['mode']): FrameNode['layoutMode'] {
  switch (mode) {
    case 'horizontal': return 'HORIZONTAL';
    case 'vertical': return 'VERTICAL';
    case 'none': return 'NONE';
  }
}

/** Return undefined if a future Figma version adds an unmapped API value. */
export function fromFigmaLayoutMode(mode: FrameNode['layoutMode']): LayoutSpec['mode'] | undefined {
  switch (mode) {
    case 'HORIZONTAL': return 'horizontal';
    case 'VERTICAL': return 'vertical';
    case 'NONE': return 'none';
    default: return undefined;
  }
}

export function toFigmaPrimaryAxisAlignment(alignment: LayoutSpec['alignment']): FrameNode['primaryAxisAlignItems'] {
  switch (alignment ?? 'MIN') {
    case 'MIN': return 'MIN';
    case 'CENTER': return 'CENTER';
    case 'MAX': return 'MAX';
    case 'SPACE_BETWEEN': return 'SPACE_BETWEEN';
  }
}

export function fromFigmaPrimaryAxisAlignment(alignment: FrameNode['primaryAxisAlignItems']): LayoutSpec['alignment'] | undefined {
  switch (alignment) {
    case 'MIN': return 'MIN';
    case 'CENTER': return 'CENTER';
    case 'MAX': return 'MAX';
    case 'SPACE_BETWEEN': return 'SPACE_BETWEEN';
    default: return undefined;
  }
}
