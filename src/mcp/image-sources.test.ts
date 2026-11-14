import { describe, it, expect } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractImageSources, loadImage, sniffMimeType } from './image-sources';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==', 'base64');

describe('image sources for MCP', () => {
  it('detects PNG, JPEG and GIF and rejects other bytes', () => {
    expect(sniffMimeType(PNG)).toBe('image/png');
    expect(sniffMimeType(new Uint8Array([0xff, 0xd8, 0xff]))).toBe('image/jpeg');
    expect(() => sniffMimeType(new Uint8Array([1, 2, 3]))).toThrow(/PNG, JPEG and GIF/);
  });
  it('loads from a file path, a URL and base64', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'adnf-img-')); const file = join(dir, 'a.png'); await writeFile(file, PNG);
    expect((await loadImage({ filePath: file })).mimeType).toBe('image/png');
    const fakeFetch = (async () => new Response(PNG, { status: 200 })) as unknown as typeof fetch;
    expect((await loadImage({ url: 'https://example.com/a.png' }, fakeFetch)).width).toBe(1);
    expect((await loadImage({ base64: `data:image/png;base64,${PNG.toString('base64')}` })).sha256).toMatch(/^[a-f0-9]{64}$/);
    await expect(loadImage({ filePath: 'relative.png' })).rejects.toThrow(/absolute/);
  });
  it('replaces src in image nodes and paints with assetRef and queues one upload per image', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'adnf-img-')); const file = join(dir, 'b.png'); await writeFile(file, PNG);
    const spec = { pages: [{ children: [{ type: 'frame', children: [{ type: 'image', name: 'Photo', src: file }, { type: 'rectangle', paints: [{ type: 'image', src: file, scaleMode: 'FILL' }] }] }] }] };
    const { operations, uploaded } = await extractImageSources(spec);
    expect(uploaded).toHaveLength(2);
    expect(operations.filter((op) => op.type === 'begin-image-transfer')).toHaveLength(1);
    expect(operations.at(-1)).toMatchObject({ type: 'finish-image-transfer', store: true });
    const image = spec.pages[0]!.children[0]!.children[0] as Record<string, unknown>;
    expect(image.assetRef).toBe(uploaded[0]!.assetRef); expect(image.src).toBeUndefined();
  });
});
