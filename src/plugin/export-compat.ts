/** Guard native blend modes that schema 1.0 cannot represent without loss. */
export function assertPortableBlendMode(layerName: string, surface: string, blendMode: string, allowPassThrough = false): void {
  if (blendMode === 'NORMAL' || (allowPassThrough && blendMode === 'PASS_THROUGH')) return;
  throw new Error(`Layer "${layerName}" uses ${surface} blend mode ${blendMode}, which schema 1.0 cannot preserve. Change it to Normal before exporting.`);
}

export function assertSinglePortableStroke(layerName: string, visibleStrokeCount: number): void {
  if (visibleStrokeCount > 1) throw new Error(`Layer "${layerName}" has ${visibleStrokeCount} visible strokes; schema 1.0 can preserve only one. Reduce it to a single stroke before exporting.`);
}
