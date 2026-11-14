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

export async function loadImage(source: ImageSource, fetchFn: typeof fetch = fetch): Promise<LoadedImage> {
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
    let url: URL; try { url = new URL(source.url); } catch { throw new Error('IMAGE_SOURCE: url is not a valid URL.'); }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('IMAGE_SOURCE: Only http(s) URLs can be downloaded.');
    const response = await fetchFn(url, { redirect: 'follow', signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`IMAGE_SOURCE: Download failed with HTTP ${response.status}.`);
    const length = Number(response.headers.get('content-length') ?? 0);
    if (length > MAX_RASTER_BYTES) throw new Error(`IMAGE_TOO_LARGE: The image is ${length} bytes; the limit is ${MAX_RASTER_BYTES}.`);
    bytes = new Uint8Array(await response.arrayBuffer());
  } else {
    bytes = decodeBase64(source.base64!.replace(/^data:[^;]+;base64,/, ''), MAX_RASTER_BYTES);
  }
  const mimeType = sniffMimeType(bytes);
  const info = validateRasterAsset(bytes, mimeType);
  return { bytes, mimeType, width: info.width, height: info.height, sha256: createHash('sha256').update(bytes).digest('hex') };
}

/** Bridge jobs that move one image to the plugin and keep it there as an assetRef. */
export function storeImageOperations(image: LoadedImage, name: string): BridgeOperation[] {
  const transferId = randomUUID(); const chunkCount = Math.ceil(image.bytes.byteLength / MCP_ASSET_CHUNK_BYTES);
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
export async function extractImageSources(spec: unknown, fetchFn: typeof fetch = fetch): Promise<{ operations: BridgeOperation[]; uploaded: Array<{ path: string; assetRef: string; bytes: number }> }> {
  const operations: BridgeOperation[] = []; const uploaded: Array<{ path: string; assetRef: string; bytes: number }> = []; const seen = new Set<string>();
  const fix = async (item: Record<string, unknown>, path: string) => {
    const src = [item.src, item.url, item.filePath].find((value) => typeof value === 'string') as string | undefined;
    const bigData = typeof item.data === 'string' && item.data.length * 0.75 > INLINE_LIMIT;
    if (src === undefined && !bigData) return;
    const source: ImageSource = src === undefined ? { base64: item.data as string } : /^https?:\/\//i.test(src) ? { url: src } : { filePath: src };
    let image: LoadedImage;
    try { image = await loadImage(source, fetchFn); } catch (error) { throw new Error(`${path}: ${error instanceof Error ? error.message : String(error)}`); }
    if (!seen.has(image.sha256)) { seen.add(image.sha256); operations.push(...storeImageOperations(image, typeof item.name === 'string' ? item.name : 'Image')); }
    delete item.src; delete item.url; delete item.filePath; delete item.data; delete item.mimeType;
    item.assetRef = image.sha256; uploaded.push({ path, assetRef: image.sha256, bytes: image.bytes.byteLength });
  };
  const visit = async (node: unknown, path: string) => {
    if (!node || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    if (record.type === 'image') await fix(record, path);
    if (Array.isArray(record.paints)) for (const [index, paint] of record.paints.entries()) if (paint && typeof paint === 'object' && (paint as Record<string, unknown>).type === 'image') await fix(paint as Record<string, unknown>, `${path}.paints[${index}]`);
    if (Array.isArray(record.children)) for (const [index, child] of record.children.entries()) await visit(child, `${path}.children[${index}]`);
  };
  const pages = (spec as { pages?: unknown })?.pages;
  if (Array.isArray(pages)) for (const [p, page] of pages.entries()) if (page && Array.isArray((page as { children?: unknown }).children)) for (const [n, node] of (page as { children: unknown[] }).children.entries()) await visit(node, `pages[${p}].children[${n}]`);
  return { operations, uploaded };
}
