import { describe, expect, it } from 'vitest';
import { visualPreviewToolResult } from './visual-preview';

describe('Figma visual-preview MCP result', () => {
  it('returns the bounded preview as an MCP image block without base64 duplication in metadata', () => {
    const result = visualPreviewToolResult({kind:'visual-preview',mimeType:'image/jpeg',base64:'QUJDREVGR0hJSktMTU5PUA==',width:1024,height:640,nodeName:'Revenue Overview'});
    expect(result?.content[1]).toMatchObject({type:'image',mimeType:'image/jpeg'});
    expect(result?.structuredContent).toEqual({kind:'visual-preview',mimeType:'image/jpeg',width:1024,height:640,nodeName:'Revenue Overview'});
    expect(JSON.stringify(result?.structuredContent)).not.toContain('QUJD');
  });
  it('rejects malformed, oversized, or unsupported preview payloads', () => {
    expect(visualPreviewToolResult({kind:'visual-preview',mimeType:'image/jpeg',base64:'not image',width:1,height:1,nodeName:'x'})).toBeUndefined();
    expect(visualPreviewToolResult({kind:'visual-preview',mimeType:'image/jpeg',base64:'A'.repeat(1_000_001),width:1,height:1,nodeName:'x'})).toBeUndefined();
    expect(visualPreviewToolResult({kind:'visual-preview',mimeType:'image/png',base64:'QUJDREVGR0hJSktMTU5PUA==',width:1,height:1,nodeName:'x'})).toBeUndefined();
  });
});
