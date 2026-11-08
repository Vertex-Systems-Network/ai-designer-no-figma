/** UTF-8 byte count for plugin runtimes that do not expose TextEncoder. */
export function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && i + 1 < value.length) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        i += 1;
      } else bytes += 3;
    } else bytes += 3;
  }
  return bytes;
}

/** UTF-8 encoding for plugin runtimes that do not expose TextEncoder. */
export function utf8Bytes(value: string): Uint8Array {
  const bytes = new Uint8Array(utf8ByteLength(value));
  let offset = 0;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x7f) bytes[offset++] = code;
    else if (code <= 0x7ff) {
      bytes[offset++] = 0xc0 | (code >> 6);
      bytes[offset++] = 0x80 | (code & 0x3f);
    } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < value.length) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        const point = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        bytes[offset++] = 0xf0 | (point >> 18);
        bytes[offset++] = 0x80 | ((point >> 12) & 0x3f);
        bytes[offset++] = 0x80 | ((point >> 6) & 0x3f);
        bytes[offset++] = 0x80 | (point & 0x3f);
        i += 1;
      } else {
        bytes[offset++] = 0xef; bytes[offset++] = 0xbf; bytes[offset++] = 0xbd;
      }
    } else {
      bytes[offset++] = 0xe0 | (code >> 12);
      bytes[offset++] = 0x80 | ((code >> 6) & 0x3f);
      bytes[offset++] = 0x80 | (code & 0x3f);
    }
  }
  return bytes;
}
