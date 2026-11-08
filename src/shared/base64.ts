const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Encode bytes without relying on TextEncoder, Buffer or browser btoa globals. */
export function encodeBase64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  let chunk = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index]!;
    const hasSecond = index + 1 < bytes.length;
    const hasThird = index + 2 < bytes.length;
    const second = hasSecond ? bytes[index + 1]! : 0;
    const third = hasThird ? bytes[index + 2]! : 0;
    chunk += alphabet[first >> 2]!;
    chunk += alphabet[((first & 3) << 4) | (second >> 4)]!;
    chunk += hasSecond ? alphabet[((second & 15) << 2) | (third >> 6)]! : '=';
    chunk += hasThird ? alphabet[third & 63]! : '=';
    if (chunk.length >= 16_384) { chunks.push(chunk); chunk = ''; }
  }
  if (chunk) chunks.push(chunk);
  return chunks.join('');
}
