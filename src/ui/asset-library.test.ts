import { describe,expect,it } from 'vitest';
import { sha256 } from './asset-library';

describe('local asset identity',()=>{
  it('computes standard SHA-256 fingerprints for known UTF-8 payloads',()=>{
    expect(sha256(new TextEncoder().encode(''))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256(new TextEncoder().encode('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('handles a payload spanning several SHA-256 blocks',()=>{
    expect(sha256(new Uint8Array(1000))).toBe('541b3e9daa09b20bf85fa273e5cbd3e80185aa4ec298e765db87742b70138a53');
  });
});
