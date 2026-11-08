export type VisualPreview = { kind:'visual-preview'; mimeType:'image/jpeg'; base64:string; width:number; height:number; nodeName:string };
export type VisualPreviewToolResult = {
  content: Array<{type:'text';text:string}|{type:'image';data:string;mimeType:'image/jpeg'}>;
  structuredContent: {kind:'visual-preview';mimeType:'image/jpeg';width:number;height:number;nodeName:string};
};

export function visualPreviewToolResult(value: unknown): VisualPreviewToolResult | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const preview = value as Partial<VisualPreview>;
  if (preview.kind !== 'visual-preview' || preview.mimeType !== 'image/jpeg' || typeof preview.base64 !== 'string' ||
      preview.base64.length < 16 || preview.base64.length > 1_000_000 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(preview.base64) ||
      !Number.isSafeInteger(preview.width) || !Number.isSafeInteger(preview.height) ||
      (preview.width as number) < 1 || (preview.width as number) > 1024 || (preview.height as number) < 1 || (preview.height as number) > 8192 ||
      typeof preview.nodeName !== 'string' || preview.nodeName.length > 160) return undefined;
  const structuredContent = {kind:'visual-preview' as const,mimeType:'image/jpeg' as const,width:preview.width as number,height:preview.height as number,nodeName:preview.nodeName};
  const text = `Visual preview captured from Figma frame "${preview.nodeName}" at ${preview.width} × ${preview.height}. Inspect the attached image before proposing a targeted patch.`;
  return {content:[{type:'text',text},{type:'image',data:preview.base64,mimeType:'image/jpeg'}],structuredContent};
}
