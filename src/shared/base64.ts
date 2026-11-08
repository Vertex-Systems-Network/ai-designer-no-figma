const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const reverseAlphabet = new Map(Array.from(alphabet, (character, index) => [character, index]));

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

/** Decode canonical base64 without relying on Buffer, atob, or TextDecoder. */
export function decodeBase64(value: string, maxBytes: number): Uint8Array {
  if (!value || value.length % 4 !== 0 || value.length > Math.ceil(maxBytes / 3) * 4) throw new Error('Invalid or oversized base64 payload.');
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  const outputLength = value.length / 4 * 3 - padding;
  if (outputLength <= 0 || outputLength > maxBytes) throw new Error('Invalid or oversized base64 payload.');
  const output = new Uint8Array(outputLength);
  let offset = 0;
  for (let i = 0; i < value.length; i += 4) {
    const last = i + 4 === value.length;
    const c0 = reverseAlphabet.get(value[i]!); const c1 = reverseAlphabet.get(value[i + 1]!);
    const c2 = value[i + 2] === '=' ? 0 : reverseAlphabet.get(value[i + 2]!);
    const c3 = value[i + 3] === '=' ? 0 : reverseAlphabet.get(value[i + 3]!);
    if (c0 === undefined || c1 === undefined || c2 === undefined || c3 === undefined || (!last && value.slice(i, i + 4).includes('=')) || (value[i + 2] === '=' && value[i + 3] !== '=')) throw new Error('Invalid base64 payload.');
    const bits = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;
    if (offset < output.length) output[offset++] = bits >>> 16;
    if (offset < output.length) output[offset++] = (bits >>> 8) & 255;
    if (offset < output.length) output[offset++] = bits & 255;
  }
  if (encodeBase64(output) !== value) throw new Error('Non-canonical base64 payload.');
  return output;
}
