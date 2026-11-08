import type { EditPatch } from './protocol';

export type DesignSystemPromptTokens = {
  colors:Array<{name:string;color:string}>;
  typography:Array<{name:string;fontFamily:string;fontSize:number;fontWeight:number;lineHeight:number}>;
  spacing:Array<{name:string;value:number}>;
};

export function buildDesignSystemPrompt(tokens:DesignSystemPromptTokens):string {
  return `\n\nApply these user-managed design-system tokens consistently. Keep layer text editable and use supported properties only.\n${JSON.stringify(tokens,null,2)}`;
}

export type DesignPromptSettings = {
  category: string;
  platform: string;
  canvasSize: string;
  style: string;
  brandColor: string;
  density: string;
  typography: string;
  complexity: string;
};

export function buildDesignPrompt(brief: string, settings: DesignPromptSettings): string {
  return `Act as a senior product designer and design-systems engineer. Create a polished, production-ready interface design specification for the user's brief below.

Return one valid JSON object only. Do not add markdown fences, commentary, or code.
Use schemaVersion "1.0" and this shape: {"schemaVersion":"1.0","name":"Design name","pages":[{"id":"page-1","name":"Page name","children":[{"type":"frame","id":"frame-1","name":"Main frame","width":1440,"height":900,"fill":"#FFFFFF","children":[{"type":"text","id":"title-1","name":"Title","width":600,"height":60,"text":"A clear heading","fontSize":36,"fontWeight":700,"color":"#171A1E"}]}]}]}.
Supported node types are frame, group, component, instance, vector, text, rectangle, ellipse, and line. Frame/group/component nodes have children. Declare a component before using its ID in an instance componentRef. Vector nodes use a bounded SVG path string in path and should use simple path geometry only. Every page and node needs a unique stable id and a meaningful name. Every node needs positive width and height. Optional node positions are x and y. Optional frame layout is {"mode":"horizontal"|"vertical"|"none","gap":number,"padding":number,"alignment":"MIN"|"CENTER"|"MAX"|"SPACE_BETWEEN","primaryAxisSizing":"AUTO"|"FIXED","counterAxisSizing":"AUTO"|"FIXED"}. Text supports fontFamily, fontSize, fontWeight, lineHeight, color, and align. Shapes support fill, radius, and opacity. Gradients use gradient:{"direction":"horizontal"|"vertical","stops":[{"position":0,"color":"#RRGGBB"},{"position":1,"color":"#RRGGBB"}]}; stops must be ordered from 0 to 1. Shadows use shadow:{"color":"#RRGGBB","opacity":0.16,"offsetX":0,"offsetY":4,"blur":12,"spread":0}. Lines support stroke and strokeWidth. Colors must be #RRGGBB. Do not invent unsupported properties. Build the design from native editable layers, not screenshots.

Design preferences:
${JSON.stringify(settings, null, 2)}

Design quality requirements:
- Translate the brief into a clear information hierarchy and a complete, coherent screen; do not return a wireframe or a few isolated cards.
- Use a deliberate grid, aligned edges, consistent spacing, restrained color palette, and a clear type scale. Prefer reusable vertical or horizontal Auto Layout for repeated content.
- Give every layer a descriptive semantic name. Use realistic, specific interface copy and data; avoid lorem ipsum, repeated filler, and unexplained placeholder labels.
- Make contrast readable (aim for WCAG AA normal text, 4.5:1), keep text within its intended frame, and use consistent radii and component dimensions.
- Match conventions to the requested product category and platform. Keep the requested content and brand direction; do not add unrelated sections.
- Before returning JSON, mentally check hierarchy, alignment, spacing rhythm, text legibility, unique IDs, valid colors, and that every nested container has children.
- Optimize the hierarchy for scanning and usability. Prefer a few purposeful visual accents over decoration.
- Return the complete design in one response. Never describe hidden analysis or claim rendered/screenshot verification.

User brief:
${brief.trim()}`;
}

export type PatchPromptSelection = {
  name: string;
  type: string;
  width: number;
  height: number;
  layerCount: number;
  nodes: Array<{id:string;name:string;type:string;x:number;y:number;width:number;height:number;text?:string;fill?:string}>;
};

export function buildPatchPrompt(selection: PatchPromptSelection, request: string): string {
  const patchShape: EditPatch = { operations: [
    { op: 'set-text', targetId: 'existing-logical-id', value: 'Updated text' },
    { op: 'set-fill', targetId: 'existing-logical-id', value: '#RRGGBB' },
    { op: 'rename', targetId: 'existing-logical-id', value: 'Clear layer name' },
    { op: 'set-bounds', targetId: 'existing-logical-id', value: { x: 0, y: 0, width: 320, height: 180 } },
    { op: 'set-auto-layout', targetId: 'existing-frame-id', value: { mode: 'VERTICAL', gap: 16, padding: 16, alignment: 'MIN' } },
  ] };
  return `Propose a safe, targeted edit to the selected Figma frame.

Return one JSON object only, with an operations array matching this shape. Use only the operation types shown and only IDs present in the selection summary. For set-bounds, use positive width/height and bounded x/y. For set-auto-layout, target a frame and set mode, gap, padding, and alignment explicitly. Do not invent IDs. Do not return markdown or commentary. Return an empty operations array if the requested change cannot be expressed safely with these operations. Never return executable code.
${JSON.stringify(patchShape, null, 2)}

Requested change:
${request.trim()}

Current selection summary:
${JSON.stringify(selection, null, 2)}`;
}
