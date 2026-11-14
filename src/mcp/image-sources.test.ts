import { describe, it, expect } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractImageSources, isBlockedAddress, loadImage, sniffMimeType } from './image-sources';
import { migrateDesignSpec } from '../shared/spec-migrations';
const publicDns = async () => ['93.184.216.34'];

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
    expect((await loadImage({ url: 'https://example.com/a.png' }, fakeFetch, publicDns)).width).toBe(1);
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
  it('blocks private, loopback and metadata destinations, including via redirect', async () => {
    for (const ip of ['127.0.0.1', '10.0.0.5', '192.168.1.1', '169.254.169.254', '172.20.0.1', '::1', 'fd00::1', '::ffff:127.0.0.1']) expect(isBlockedAddress(ip)).toBe(true);
    expect(isBlockedAddress('93.184.216.34')).toBe(false);
    const never = (async () => { throw new Error('must not fetch'); }) as unknown as typeof fetch;
    await expect(loadImage({ url: 'http://169.254.169.254/latest' }, never, publicDns)).rejects.toThrow(/public internet address/);
    await expect(loadImage({ url: 'https://intranet.local/a.png' }, never, async () => ['10.1.2.3'])).rejects.toThrow(/public internet address/);
    const redirect = (async () => new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/secret' } })) as unknown as typeof fetch;
    await expect(loadImage({ url: 'https://example.com/a.png' }, redirect, publicDns)).rejects.toThrow(/public internet address/);
  });
  it('stops reading a body without content-length once it passes the size limit', async () => {
    let sent = 0;
    const body = new ReadableStream<Uint8Array>({ pull(c) { sent += 1 << 20; c.enqueue(new Uint8Array(1 << 20)); } });
    const huge = (async () => new Response(body, { status: 200 })) as unknown as typeof fetch;
    await expect(loadImage({ url: 'https://example.com/big' }, huge, publicDns)).rejects.toThrow(/IMAGE_TOO_LARGE/);
    expect(sent).toBeLessThan(12 << 20);
  });
  it('finds image sources written with aliases after migration, and retries produce identical jobs', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'adnf-img-')); const file = join(dir, 'c.png'); await writeFile(file, PNG);
    const raw = () => ({ children: [{ type: 'rectangle', name: 'R', width: 10, height: 10, fills: [{ type: 'IMAGE', src: file }] }] });
    const a = migrateDesignSpec(raw()).value; const b = migrateDesignSpec(raw()).value;
    const first = await extractImageSources(a, undefined, undefined, 'op'); const second = await extractImageSources(b, undefined, undefined, 'op');
    expect(first.uploaded).toHaveLength(1);
    expect(JSON.stringify(first.operations)).toBe(JSON.stringify(second.operations));
  });
  it('turns alpha in fill and text colour into paint opacity', () => {
    const value = migrateDesignSpec({ pages: [{ name: 'P', children: [{ type: 'rectangle', name: 'R', width: 1, height: 1, fill: '#FF000080' }, { type: 'text', name: 'T', text: 'x', color: 'rgba(0,0,255,0.5)' }] }] }).value as { pages: { children: { paints?: { opacity: number }[] }[] }[] };
    expect(value.pages[0]!.children[0]!.paints?.[0]?.opacity).toBeCloseTo(0.5, 1);
    expect(value.pages[0]!.children[1]!.paints?.[0]?.opacity).toBeCloseTo(0.5, 1);
  });
});
