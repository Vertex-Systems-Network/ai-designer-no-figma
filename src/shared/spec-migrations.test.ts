import { describe, expect, it } from 'vitest';
import { detectVersion, migrateDesignSpec, parseWithMigration } from './spec-migrations';

const legacy = { name: 'Legacy', children: [{ type: 'FRAME', id: 'f', name: 'Hero', width: 400, height: 300, autoLayout: { direction: 'VERTICAL', gap: 8, padding: 16, alignment: 'MIN' }, children: [{ type: 'TEXT', id: 't', name: 'Title', width: 200, height: 30, characters: 'Hello', fontSize: 20, color: '#111111' }, { type: 'Rect', id: 'r', name: 'Divider', width: 200, height: 1, fill: '#DDDDDD' }, { type: 'frame', id: 'e', name: 'Empty slot', width: 10, height: 10 }] }] };

describe('design spec migrations', () => {
  it('detects versions', () => {
    expect(detectVersion({ schemaVersion: '1.0' })).toBe('1.0');
    expect(detectVersion({})).toBe('0');
    expect(detectVersion({ schemaVersion: 1 })).toBe('0');
    expect(detectVersion({ schemaVersion: '9.9' })).toBe('9.9');
  });
  it('upgrades loose legacy model output to a valid 1.0 spec and reports each change', async () => {
    const { result, report } = await parseWithMigration(JSON.stringify(legacy));
    expect(result.issues).toEqual([]);
    expect(result.valid).toBe(true);
    expect(report?.from).toBe('0');
    expect(report?.applied.join('\n')).toMatch(/wrapped top-level children[\s\S]*FRAME[\s\S]*autoLayout → layout[\s\S]*characters → text[\s\S]*"Rect" → "rectangle"[\s\S]*added empty children/);
  });
  it('leaves valid specs untouched and never reports a migration', async () => {
    const valid = { schemaVersion: '1.0', name: 'Ok', pages: [{ id: 'p', name: 'P', children: [] }] };
    expect((await parseWithMigration(JSON.stringify(valid))).report).toBeUndefined();
  });
  it('fails safely for unknown versions and unrecoverable input', async () => {
    expect(() => migrateDesignSpec({ schemaVersion: '9.9' })).toThrow(/No migration from schemaVersion "9.9"/);
    expect(() => migrateDesignSpec([])).toThrow(/JSON object/);
    const { result, report } = await parseWithMigration('{"schemaVersion":"9.9","pages":[]}');
    expect(result.valid).toBe(false); expect(report).toBeUndefined();
  });
});
