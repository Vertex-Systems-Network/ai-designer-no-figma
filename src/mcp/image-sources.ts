/**
 * Image sources for MCP clients.
 *
 * Tool calls are a poor way to move large images (an AI has to paste megabytes of base64), so the MCP server
 * accepts three sources and does the heavy lifting itself:
 *   - `filePath`: a file on the computer running the MCP server (absolute, or starting with ~),
 *   - `url`: an http(s) URL the server downloads,
 *   - `base64`: inline bytes (any size up to the raster limit).
 * Bytes are validated, then sent to the plugin in checksum-verified chunks and kept there under their sha256
 * (`assetRef`), which design specs reference instead of embedding data.
 */
import { createHash, randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { MAX_RASTER_BYTES, MCP_ASSET_CHUNK_BYTES, validateRasterAsset } from '../shared/assets';
import { decodeBase64 } from '../shared/base64';
import type { BridgeOperation } from '../shared/bridge-contract';

export type ImageSource = { filePath?: string; url?: string; base64?: string };
export type LoadedImage = { bytes: Uint8Array; mimeType: 'image/png' | 'image/jpeg' | 'image/gif'; width: number; height: number; sha256: string };

/** Detect PNG / JPEG / GIF from the first bytes so callers never have to state a MIME type. */
export function sniffMimeType(bytes: Uint8Array): 'image/png' | 'image/jpeg' | 'image/gif' {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif';
  throw new Error('UNSUPPORTED_IMAGE: Only PNG, JPEG and GIF images can be imported.');
}

/** True for addresses an image download must never reach: loopback, private, link-local, CGNAT, multicast, metadata. */
export function isBlockedAddress(address: string): boolean {
  const v4 = isIP(address) === 4 ? address : /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1];
  if (v4) {
    const [a, b] = v4.split('.').map(Number) as [number, number];
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  const v6 = address.toLowerCase();
  return v6 === '::' || v6 === '::1' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe8') || v6.startsWith('fe9') || v6.startsWith('fea') || v6.startsWith('feb') || v6.startsWith('ff');
}
export type HostResolver = (hostname: string) => Promise<string[]>;
const resolveHost: HostResolver = async (hostname) => (await lookup(hostname, { all: true })).map((entry) => entry.address);

/**
 * Download an image from a public http(s) URL. Every hop (including redirects, followed manually, at most 3) must
 * resolve only to public addresses, and the body is read in a stream that stops at the raster size limit.
 * Errors are generic so a caller cannot use this to probe the user's network.
 */
async function download(input: string, fetchFn: typeof fetch, resolver: HostResolver): Promise<Uint8Array> {
  let url: URL; try { url = new URL(input); } catch { throw new Error('IMAGE_SOURCE: url is not a valid URL.'); }
  for (let hop = 0; hop < 4; hop++) {
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('IMAGE_SOURCE: Only http(s) URLs can be downloaded.');
    const host = url.hostname.replace(/^\[|\]$/g, '');
    const addresses = isIP(host) ? [host] : await resolver(host).catch(() => [] as string[]);
    if (!addresses.length || addresses.some(isBlockedAddress)) throw new Error('IMAGE_SOURCE: The image URL must point to a public internet address. For files on this computer use filePath.');
    const response = await fetchFn(url, { redirect: 'manual', signal: AbortSignal.timeout(30_000) }).catch(() => undefined);
    if (!response) throw new Error('IMAGE_SOURCE: The image could not be downloaded.');
    if (response.status >= 300 && response.status < 400 && response.headers.get('location')) { url = new URL(response.headers.get('location')!, url); continue; }
    if (!response.ok || !response.body) throw new Error('IMAGE_SOURCE: The image could not be downloaded.');
    if (Number(response.headers.get('content-length') ?? 0) > MAX_RASTER_BYTES) throw new Error(`IMAGE_TOO_LARGE: The image is larger than ${MAX_RASTER_BYTES} bytes.`);
    const reader = response.body.getReader(); const parts: Uint8Array[] = []; let total = 0;
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      total += value.byteLength;
      if (total > MAX_RASTER_BYTES) { await reader.cancel(); throw new Error(`IMAGE_TOO_LARGE: The image is larger than ${MAX_RASTER_BYTES} bytes.`); }
      parts.push(value);
    }
    const bytes = new Uint8Array(total); let offset = 0; for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
    return bytes;
  }
  throw new Error('IMAGE_SOURCE: Too many redirects.');
}

export async function loadImage(source: ImageSource, fetchFn: typeof fetch = fetch, resolver: HostResolver = resolveHost): Promise<LoadedImage> {
  const given = [source.filePath, source.url, source.base64].filter((value) => value !== undefined).length;
  if (given !== 1) throw new Error('IMAGE_SOURCE: Give exactly one of filePath, url or base64.');
  let bytes: Uint8Array;
  if (source.filePath !== undefined) {
    const raw = source.filePath.replace(/^file:\/\//, '');
    const path = raw.startsWith('~') ? join(homedir(), raw.slice(1)) : raw;
    if (!isAbsolute(path)) throw new Error('IMAGE_SOURCE: filePath must be absolute (or start with ~).');
    const info = await stat(path).catch(() => undefined);
    if (!info?.isFile()) throw new Error(`IMAGE_SOURCE: File not found: ${path}`);
    if (info.size > MAX_RASTER_BYTES) throw new Error(`IMAGE_TOO_LARGE: ${path} is ${info.size} bytes; the limit is ${MAX_RASTER_BYTES}.`);
    bytes = new Uint8Array(await readFile(path));
  } else if (source.url !== undefined) {
    bytes = await download(source.url, fetchFn, resolver);
  } else {
    bytes = decodeBase64(source.base64!.replace(/^data:[^;]+;base64,/, ''), MAX_RASTER_BYTES);
  }
  const mimeType = sniffMimeType(bytes);
  const info = validateRasterAsset(bytes, mimeType);
  return { bytes, mimeType, width: info.width, height: info.height, sha256: createHash('sha256').update(bytes).digest('hex') };
}

/** Bridge jobs that move one image to the plugin and keep it there as an assetRef. */
/** A stable transfer id (UUID-shaped) from a seed, so a retried upload produces identical jobs. */
const stableUuid = (seed: string) => { const h = createHash('sha256').update(seed).digest('hex'); return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`; };
export function storeImageOperations(image: LoadedImage, name: string, seed?: string): BridgeOperation[] {
  const transferId = seed ? stableUuid(`${seed}:${image.sha256}`) : randomUUID(); const chunkCount = Math.ceil(image.bytes.byteLength / MCP_ASSET_CHUNK_BYTES);
  const operations: BridgeOperation[] = [{ type: 'begin-image-transfer', transferId, name, mimeType: image.mimeType, totalBytes: image.bytes.byteLength, sha256: image.sha256, chunkCount }];
  for (let index = 0; index < chunkCount; index++) { const start = index * MCP_ASSET_CHUNK_BYTES; operations.push({ type: 'image-transfer-chunk', transferId, index, bytes: Array.from(image.bytes.subarray(start, Math.min(start + MCP_ASSET_CHUNK_BYTES, image.bytes.byteLength))) }); }
  operations.push({ type: 'finish-image-transfer', transferId, store: true });
  return operations;
}

const INLINE_LIMIT = 256 * 1024;
/**
 * Walk a raw design spec and replace image sources the plugin cannot take inline: `src` / `url` / `filePath`,
 * and base64 `data` above 256 KB. Each becomes `assetRef`; the returned operations upload the bytes first.
 */
export async function extractImageSources(spec: unknown, fetchFn: typeof fetch = fetch, resolver: HostResolver = resolveHost, seed?: string): Promise<{ operations: BridgeOperation[]; batches: BridgeOperation[][]; uploaded: Array<{ path: string; assetRef: string; bytes: number }> }> {
  const batches: BridgeOperation[][] = []; const uploaded: Array<{ path: string; assetRef: string; bytes: number }> = []; const seen = new Set<string>();
  const fix = async (item: Record<string, unknown>, path: string) => {
    const src = [item.src, item.url, item.filePath].find((value) => typeof value === 'string') as string | undefined;
    const bigData = typeof item.data === 'string' && item.data.length * 0.75 > INLINE_LIMIT;
    if (src === undefined && !bigData) return;
    const source: ImageSource = src === undefined ? { base64: item.data as string } : /^https?:\/\//i.test(src) ? { url: src } : { filePath: src };
    let image: LoadedImage;
    try { image = await loadImage(source, fetchFn, resolver); } catch (error) { throw new Error(`${path}: ${error instanceof Error ? error.message : String(error)}`); }
    if (!seen.has(image.sha256)) { seen.add(image.sha256); batches.push(storeImageOperations(image, typeof item.name === 'string' ? item.name : 'Image', seed)); }
    delete item.src; delete item.url; delete item.filePath; delete item.data; delete item.mimeType;
    item.assetRef = image.sha256; uploaded.push({ path, assetRef: image.sha256, bytes: image.bytes.byteLength });
  };
  const visit = async (node: unknown, path: string) => {
    if (!node || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    const isImage = (value: unknown) => typeof value === 'string' && value.toLowerCase() === 'image';
    if (isImage(record.type)) await fix(record, path);
    for (const key of ['paints', 'fills'] as const) if (Array.isArray(record[key])) for (const [index, paint] of (record[key] as unknown[]).entries()) if (paint && typeof paint === 'object' && isImage((paint as Record<string, unknown>).type)) await fix(paint as Record<string, unknown>, `${path}.${key}[${index}]`);
    if (Array.isArray(record.children)) for (const [index, child] of record.children.entries()) await visit(child, `${path}.children[${index}]`);
  };
  const pages = (spec as { pages?: unknown })?.pages;
  const top = (spec as { children?: unknown })?.children; if (Array.isArray(top)) for (const [n, node] of top.entries()) await visit(node, `children[${n}]`);
  if (Array.isArray(pages)) for (const [p, page] of pages.entries()) if (page && Array.isArray((page as { children?: unknown }).children)) for (const [n, node] of (page as { children: unknown[] }).children.entries()) await visit(node, `pages[${p}].children[${n}]`);
  return { operations: batches.flat(), batches, uploaded };
}
