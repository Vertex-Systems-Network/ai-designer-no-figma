/**
 * Human- and AI-readable reference for design-spec 1.0, returned by the figma_get_schema tool
 * (together with the formal JSON Schema). Keep in sync with docs/DESIGN-SCHEMA.md.
 */
export const DESIGN_SCHEMA_GUIDE = {
  summary: 'A design is {schemaVersion:"1.0", name, pages:[{id, name, children:[nodes]}], designSystem?}. Every node needs id (unique), name, type, width, height; x/y are relative to the parent. Colours are "#RRGGBB" (also accepted: "#RGB", "#RRGGBBAA", "rgba(r,g,b,a)", which become colour + opacity).',
  nodeTypes: {
    frame: 'Container with fill/paints, layout (Auto Layout), layoutGrids, clipsContent, radius or cornerRadii, children.',
    group: 'Real Figma group. Children x/y are relative to the group\'s x/y; Figma sizes the group from its children. Groups cannot have fills (use a frame).',
    component: 'Like frame; becomes a Figma component. Instances reference it with {type:"instance", componentRef:"<component id>"} later in the document.',
    text: 'text, fontFamily, fontSize, fontWeight (100–900 or "Bold"), fontStyle (exact style name, e.g. "Bold Italic"), lineHeight (px), letterSpacing {unit:"PIXELS"|"PERCENT", value} or a number (px), align LEFT|CENTER|RIGHT|JUSTIFIED (aliases: textAlign, textAlignHorizontal, lowercase), textAlignVertical TOP|CENTER|BOTTOM, textAutoResize NONE|HEIGHT|WIDTH_AND_HEIGHT|TRUNCATE, color, textDecoration, textCase.',
    rectangle: 'fill/paints, radius or cornerRadii, stroke, strokeWidth, strokeAlign INSIDE|CENTER|OUTSIDE.',
    ellipse: 'fill/paints, stroke.', line: 'stroke, strokeWidth.', vector: 'path (SVG path data), fill.',
    image: 'Image layer. Source: "src" (absolute file path or http(s) URL — MCP uploads it), "assetRef" (from figma_upload_image), or data (base64) + mimeType for small images (≤256 KB). scaleMode FILL (default) | FIT | CROP | TILE.',
    instance: 'componentRef: id of a component declared earlier.',
  },
  paints: {
    note: 'Use paints:[...] (up to 8, bottom first) or the legacy fill:"#hex". "fills" is accepted as an alias of paints.',
    solid: { type: 'solid', color: '#0B8A60', opacity: 1 },
    linearGradient: [
      { type: 'linear-gradient', gradient: { direction: 'horizontal', stops: [{ position: 0, color: '#6366F1' }, { position: 1, color: '#EC4899' }] } },
      { type: 'linear-gradient', gradient: { angle: 135, stops: [{ position: 0, color: '#6366F1' }, { position: 1, color: '#EC4899', opacity: 0.8 }] }, note: 'angle in degrees like CSS: 0 = bottom→top, 90 = left→right, 180 = top→bottom' },
      { type: 'linear-gradient', gradient: { start: { x: 0, y: 0 }, end: { x: 1, y: 1 }, stops: [{ offset: 0, color: '#000000' }, { offset: 1, color: '#FFFFFF' }] }, note: 'start/end (or handles:[start,end]) in 0–1 node coordinates, Penpot style; offset is accepted for position' },
    ],
    radialGradient: { type: 'radial-gradient', gradient: { transform: [[1, 0, 0], [0, 1, 0]], stops: [{ position: 0, color: '#FFFFFF' }, { position: 1, color: '#000000' }] } },
    image: { type: 'image', src: '/absolute/path/photo.jpg', scaleMode: 'FILL', note: 'or assetRef / data+mimeType' },
  },
  effects: [{ type: 'drop-shadow', color: '#000000', opacity: 0.15, offsetX: 0, offsetY: 8, blur: 24, spread: 0 }, { type: 'inner-shadow', color: '#000000', opacity: 0.1, offsetX: 0, offsetY: 1, blur: 2 }, { type: 'layer-blur', blur: 8 }, { type: 'background-blur', blur: 20 }],
  cornerRadius: 'radius: 12 for all corners. Per corner: cornerRadii {topLeft, topRight, bottomRight, bottomLeft}; also accepted: radius as [tl,tr,br,bl] or {topLeft,…}, and topLeftRadius/topRightRadius/bottomRightRadius/bottomLeftRadius.',
  layout: { mode: 'none|horizontal|vertical', gap: 'number', padding: 'number', alignment: 'MIN|CENTER|MAX|SPACE_BETWEEN', primaryAxisSizing: 'AUTO|FIXED', counterAxisSizing: 'AUTO|FIXED' },
  fonts: 'The plugin picks the installed style closest to fontWeight (e.g. 800 → "ExtraBold" or "Extra Bold") or uses fontStyle exactly. Missing fonts fall back to Inter and are listed in the job result warnings.',
  pages: 'Each import creates new pages by default. figma_import_design_schema accepts targetPageId (draw into an existing page) or replacePage:true (swap the page with the same name). figma_list_pages and figma_delete_page manage pages.',
  result: 'figma_get_job_result for an import returns {created, nodes, pages:[{id,name}], warnings:[…]}.',
  limits: { maxSpecBytes: 512000, maxNodes: 2000, maxDepth: 16, inlineImageBytes: 262144, uploadedImageBytes: 5242880 },
  example: {
    schemaVersion: '1.0', name: 'Pricing card',
    pages: [{ id: 'p1', name: 'Pricing', children: [{
      type: 'frame', id: 'card', name: 'Card', x: 0, y: 0, width: 360, height: 420, radius: 16, clipsContent: true,
      paints: [{ type: 'linear-gradient', gradient: { angle: 180, stops: [{ position: 0, color: '#FFFFFF' }, { position: 1, color: '#F4F6FB' }] } }],
      effects: [{ type: 'drop-shadow', color: '#101828', opacity: 0.12, offsetX: 0, offsetY: 12, blur: 32 }],
      layout: { mode: 'vertical', gap: 16, padding: 32, alignment: 'MIN', primaryAxisSizing: 'FIXED', counterAxisSizing: 'FIXED' },
      children: [
        { type: 'image', id: 'hero', name: 'Hero', width: 296, height: 120, src: 'https://example.com/hero.png', scaleMode: 'FILL' },
        { type: 'text', id: 'title', name: 'Title', width: 296, height: 32, text: 'Pro plan', fontFamily: 'Inter', fontWeight: 700, fontSize: 24, color: '#101828', align: 'CENTER' },
        { type: 'text', id: 'price', name: 'Price', width: 296, height: 48, text: '$29/mo', fontFamily: 'Inter', fontWeight: 800, fontSize: 40, color: '#0B8A60', align: 'CENTER', textAutoResize: 'HEIGHT' },
        { type: 'rectangle', id: 'cta', name: 'Button', width: 296, height: 48, fill: '#0B8A60', cornerRadii: { topLeft: 12, topRight: 12, bottomRight: 4, bottomLeft: 4 } },
      ],
    }] }],
  },
} as const;
