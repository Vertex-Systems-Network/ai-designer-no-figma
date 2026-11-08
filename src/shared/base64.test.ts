import { describe, expect, it } from 'vitest';
import { decodeBase64, encodeBase64 } from './base64';

describe('bounded visual preview byte encoding', () => {
  it('encodes empty, padded and full byte groups as canonical base64', () => {
    expect(encodeBase64(new Uint8Array())).toBe('');
    expect(encodeBase64(new Uint8Array([77]))).toBe('TQ==');
    expect(encodeBase64(new Uint8Array([77, 97]))).toBe('TWE=');
    expect(encodeBase64(new Uint8Array([77, 97, 110]))).toBe('TWFu');
  });
  it('keeps output exact across chunk boundaries', () => {
    const bytes = new Uint8Array(12_300).map((_, index) => index % 256);
    expect(encodeBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'));
  });

  it('decodes canonical payloads within byte bounds and rejects malformed encodings',()=>{
    for(const bytes of [new Uint8Array([0]),new Uint8Array([1,2]),new Uint8Array([1,2,3,254])])expect(decodeBase64(encodeBase64(bytes),bytes.length)).toEqual(bytes);
    expect(()=>decodeBase64('@@==',10)).toThrow(/base64/i);
    expect(()=>decodeBase64('AQID',2)).toThrow(/oversized/i);
    expect(()=>decodeBase64('AR==',10)).toThrow(/canonical/i);
  });
});
