/** Imported pages never silently reuse an existing page name (e.g. re-importing an exported selection). */
export function uniquePageName(name: string, existing: readonly string[]): string {
  const taken = new Set(existing);
  if (!taken.has(name)) return name;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${name} (${n})`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${name} (${Date.now()})`;
}
