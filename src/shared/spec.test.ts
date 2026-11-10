import { describe, expect, it } from 'vitest';
import { auditDesignQuality, parseDesignSpec, validateDesignSpec, type DesignSpec } from './spec';
import { utf8ByteLength } from './utf8';

const valid: DesignSpec = {
  schemaVersion: '1.0', name: 'Sample', pages: [{ id: 'page-1', name: 'Home', children: [
    { type: 'frame', id: 'frame-1', name: 'Hero', width: 1200, height: 700, children: [
      { type: 'text', id: 'title-1', name: 'Heading', width: 500, height: 60, text: 'Hello', fontSize: 32, color: '#111111' },
    ] },
  ] }],
};

describe('design specification validation', () => {
  it('audits readable contrast, semantic names, typography and repeated layout without blocking import', () => {
    const audited = structuredClone(valid);
    const frame = audited.pages[0]!.children[0]!;
    if (frame.type !== 'frame') throw new Error('fixture frame expected');
    frame.fill = '#FFFFFF';
    frame.children = [
      { type: 'text', id: 't1', name: 'Text 1', width: 200, height: 24, text: 'Low contrast', color: '#AAAAAA', fontSize: 14 },
      { type: 'text', id: 't2', name: 'Text', width: 200, height: 24, text: 'Also low contrast', fill: '#AAAAAA', fontSize: 14 },
      { type: 'rectangle', id: 'r1', name: 'Rectangle 1', width: 40, height: 20 },
      { type: 'rectangle', id: 'r2', name: 'Rectangle 2', width: 40, height: 20 },
    ];
    const findings = auditDesignQuality(audited);
    expect(findings.some((finding) => finding.message.includes('contrast'))).toBe(true);
    expect(findings.some((finding) => finding.message.includes('Auto Layout'))).toBe(true);
    expect(findings.some((finding) => finding.message.includes('semantic layer name'))).toBe(true);
    expect(validateDesignSpec(audited).valid).toBe(true);
  });
  it('counts UTF-8 bytes without TextEncoder, including multibyte and surrogate-pair characters', () => {
    expect(utf8ByteLength('ASCII')).toBe(5);
    expect(utf8ByteLength('é漢😀')).toBe(9);
    expect(utf8ByteLength('\ud800')).toBe(3);
  });
  it('accepts a well-formed editable design tree', () => expect(validateDesignSpec(valid).valid).toBe(true));
  it('validates clipping on frames and components while rejecting it on groups',()=>{
    const clipped=structuredClone(valid);const frame=clipped.pages[0]!.children[0]!;if(frame.type!=='frame')throw new Error('fixture frame expected');frame.clipsContent=true;
    expect(validateDesignSpec(clipped).valid).toBe(true);
    const componentSpec:DesignSpec={schemaVersion:'1.0',name:'Clipping component',pages:[{id:'clip-page',name:'Page',children:[{type:'component',id:'clip-component',name:'Clip component',width:100,height:100,clipsContent:true,children:[]}]}]};
    expect(validateDesignSpec(componentSpec).valid).toBe(true);
    const invalid=structuredClone(clipped);const invalidFrame=invalid.pages[0]!.children[0]!;if(invalidFrame.type!=='frame')throw new Error('fixture frame expected');invalidFrame.children=[{type:'group',id:'group-clip',name:'Group',width:50,height:50,children:[]}];(invalidFrame.children[0] as unknown as Record<string,unknown>).clipsContent=true;
    expect(validateDesignSpec(invalid).issues.some(issue=>issue.path.endsWith('.clipsContent')&&issue.message==='Unsupported property.')).toBe(true);
  });
  it('accepts bounded line stroke opacity only when a stroke color is supplied',()=>{
    const lineSpec:DesignSpec={schemaVersion:'1.0',name:'Line opacity',pages:[{id:'line-page',name:'Page',children:[{type:'line',id:'rule',name:'Rule',width:100,height:1,stroke:'#112233',strokeOpacity:.35,strokeWidth:2}]}]};
    expect(validateDesignSpec(lineSpec).valid).toBe(true);
    const missingColor=structuredClone(lineSpec);const line=missingColor.pages[0]!.children[0]!;if(line.type!=='line')throw new Error('fixture line expected');delete line.stroke;
    expect(validateDesignSpec(missingColor).issues.some(issue=>issue.path.endsWith('.strokeOpacity'))).toBe(true);
  });
  it('rejects schema fields that the renderer cannot apply to text and line nodes',()=>{
    const textRadius=structuredClone(valid);const textFrame=textRadius.pages[0]!.children[0]!;if(textFrame.type!=='frame')throw new Error('fixture frame expected');const text=textFrame.children[0]!;if(text.type!=='text')throw new Error('fixture text expected');text.radius=6;
    expect(validateDesignSpec(textRadius).valid).toBe(false);
    const lineRadius:DesignSpec={schemaVersion:'1.0',name:'Line radius',pages:[{id:'line-radius-page',name:'Page',children:[{type:'line',id:'line-radius',name:'Rule',width:100,height:1,radius:4}]}]};
    expect(validateDesignSpec(lineRadius).valid).toBe(false);
  });
  it('rejects ambiguous legacy and explicit text color fields',()=>{
    const ambiguous=structuredClone(valid);const frame=ambiguous.pages[0]!.children[0]!;if(frame.type!=='frame')throw new Error('fixture frame expected');const text=frame.children[0]!;if(text.type!=='text')throw new Error('fixture text expected');text.fill='#222222';
    expect(validateDesignSpec(ambiguous).issues.some(issue=>issue.path.endsWith('.color')&&issue.message.includes('either color or fill'))).toBe(true);
  });
  it('validates per-corner radii and smoothing only on supported native shapes',()=>{
    const custom:DesignSpec={schemaVersion:'1.0',name:'Corner fidelity',pages:[{id:'corner-page',name:'Page',children:[{type:'frame',id:'clip-frame',name:'Clipped frame',width:100,height:100,cornerRadii:{topLeft:8,topRight:12,bottomRight:20,bottomLeft:4},cornerSmoothing:.6,children:[{type:'rectangle',id:'shape',name:'Shape',width:40,height:20,cornerRadii:{topLeft:2,topRight:8,bottomRight:4,bottomLeft:10}}]}]}]};
    expect(validateDesignSpec(custom).valid).toBe(true);
    const ambiguous=structuredClone(custom);const frame=ambiguous.pages[0]!.children[0]!;if(frame.type!=='frame')throw new Error('fixture frame expected');frame.radius=4;
    expect(validateDesignSpec(ambiguous).issues.some(issue=>issue.path.endsWith('.cornerRadii')&&issue.message.includes('radius or cornerRadii'))).toBe(true);
    const outOfRange=structuredClone(custom);const bad=outOfRange.pages[0]!.children[0]!;if(bad.type!=='frame')throw new Error('fixture frame expected');bad.cornerSmoothing=1.5;
    expect(validateDesignSpec(outOfRange).issues.some(issue=>issue.path.endsWith('cornerSmoothing'))).toBe(true);
  });
  it('accepts bounded native layer rotations and rejects out-of-range degrees',()=>{
    const rotated=structuredClone(valid);const frame=rotated.pages[0]!.children[0]!;if(frame.type!=='frame')throw new Error('fixture frame expected');frame.rotation=-37.5;
    expect(validateDesignSpec(rotated).valid).toBe(true);
    frame.rotation=181;
    expect(validateDesignSpec(rotated).issues.some(issue=>issue.path.endsWith('/rotation')||issue.path.endsWith('.rotation'))).toBe(true);
  });
  it('accepts gradients, shadows, editable vectors, and instances of earlier components', () => {
    const advanced: DesignSpec = { schemaVersion: '1.0', name: 'Advanced', pages: [{ id: 'p-advanced', name: 'Components', children: [
      { type: 'component', id: 'button-component', name: 'Primary button', width: 120, height: 40, fill: '#087A55', children: [
        { type: 'text', id: 'button-label', name: 'Button label', width: 100, height: 24, text: 'Continue', fontSize: 14, color: '#FFFFFF' },
      ] },
      { type: 'instance', id: 'button-instance', name: 'Continue button', width: 120, height: 40, componentRef: 'button-component' },
      { type: 'rectangle', id: 'gradient-card', name: 'Gradient card', width: 240, height: 120, gradient: { direction: 'horizontal', stops: [{ position: 0, color: '#087A55' }, { position: 1, color: '#54B99A' }] }, shadows: [{ color: '#000000', opacity: 0.16, offsetX: 0, offsetY: 4, blur: 12 }, {color:'#000000',opacity:.08,offsetX:0,offsetY:1,blur:3}] },
      { type: 'vector', id: 'check-icon', name: 'Check icon', width: 24, height: 24, path: 'M2 12 L9 19 L22 4 Z', fill: '#FFFFFF' },
    ] }] };
    expect(validateDesignSpec(advanced).valid).toBe(true);
  });
  it('validates bounded solid, linear-gradient and embedded image paint stacks without mixing legacy paint fields', () => {
    const spec=structuredClone(valid);
    const frame=spec.pages[0]!.children[0]!;
    if(frame.type!=='frame')throw new Error('fixture frame expected');
    frame.children=[{type:'rectangle',id:'paint-stack',name:'Layered accent',width:80,height:40,paints:[
      {type:'solid',color:'#0D8A60',opacity:.8},
      {type:'linear-gradient',gradient:{direction:'horizontal',stops:[{position:0,color:'#FFFFFF'},{position:1,color:'#000000'}]},opacity:.45},
      {type:'image',mimeType:'image/png',data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==',scaleMode:'CROP',imageTransform:[[.8,0,.1],[0,.8,-.1]],opacity:.9},
    ]}];
    expect(validateDesignSpec(spec).valid).toBe(true);
    const tiledPaint=structuredClone(spec);const tiledRect=tiledPaint.pages[0]!.children[0]!.type==='frame'?tiledPaint.pages[0]!.children[0]!.children[0]:undefined;if(tiledRect?.type!=='rectangle'||tiledRect.paints?.[2]?.type!=='image')throw new Error('image paint fixture expected');const tilePaint={...tiledRect.paints[2]};delete tilePaint.imageTransform;tiledRect.paints[2]={...tilePaint,scaleMode:'TILE',scalingFactor:1.25};
    expect(validateDesignSpec(tiledPaint).valid).toBe(true);
    const badTile=structuredClone(tiledPaint);const badRect=badTile.pages[0]!.children[0]!.type==='frame'?badTile.pages[0]!.children[0]!.children[0]:undefined;if(badRect?.type!=='rectangle'||badRect.paints?.[2]?.type!=='image')throw new Error('image paint fixture expected');badRect.paints[2]={...badRect.paints[2],scalingFactor:20};
    expect(validateDesignSpec(badTile).issues.some(issue=>issue.path.endsWith('scalingFactor'))).toBe(true);
    const singularPaint=structuredClone(spec);const painted=singularPaint.pages[0]!.children[0]!.type==='frame'?singularPaint.pages[0]!.children[0]!.children[0]:undefined;if(painted?.type!=='rectangle'||painted.paints?.[2]?.type!=='image')throw new Error('image paint fixture expected');painted.paints[2].imageTransform=[[1,0,0],[2,0,0]];
    expect(validateDesignSpec(singularPaint).issues.some(issue=>issue.path.endsWith('imageTransform')&&issue.message.includes('invertible'))).toBe(true);
    const invalidImage=structuredClone(spec);const imageRect=invalidImage.pages[0]!.children[0]!.type==='frame'?invalidImage.pages[0]!.children[0]!.children[0]:undefined;if(imageRect?.type!=='rectangle')throw new Error('fixture rectangle expected');imageRect.paints![2]={type:'image',mimeType:'image/jpeg',data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg=='};
    expect(validateDesignSpec(invalidImage).valid).toBe(false);
    const mixed=structuredClone(spec);const rect=mixed.pages[0]!.children[0]!.type==='frame'?mixed.pages[0]!.children[0]!.children[0]:undefined;if(rect?.type!=='rectangle')throw new Error('fixture rectangle expected');rect.fill='#FFFFFF';
    expect(validateDesignSpec(mixed).issues.some(issue=>issue.message.includes('either paints'))).toBe(true);
    const oversized=structuredClone(spec);const oversizedRect=oversized.pages[0]!.children[0]!.type==='frame'?oversized.pages[0]!.children[0]!.children[0]:undefined;if(oversizedRect?.type!=='rectangle')throw new Error('fixture rectangle expected');oversizedRect.paints=Array.from({length:9},()=>({type:'solid' as const,color:'#FFFFFF'}));
    expect(validateDesignSpec(oversized).valid).toBe(false);
  });
  it('accepts bounded native inner-shadow and blur effect stacks',()=>{
    const spec=structuredClone(valid);const frame=spec.pages[0]!.children[0]!;if(frame.type!=='frame')throw new Error('fixture frame expected');
    frame.children=[{type:'rectangle',id:'native-effects',name:'Blurred card',width:120,height:80,effects:[{type:'inner-shadow',color:'#000000',opacity:.2,offsetX:0,offsetY:2,blur:6},{type:'layer-blur',blur:4},{type:'background-blur',blur:12}]}];
    expect(validateDesignSpec(spec).valid).toBe(true);
    const conflicted=structuredClone(spec);const target=conflicted.pages[0]!.children[0]!.type==='frame'?conflicted.pages[0]!.children[0]!.children[0]:undefined;if(target?.type!=='rectangle')throw new Error('fixture rectangle expected');target.shadow={color:'#000000',opacity:.2,offsetX:0,offsetY:2,blur:6};
    expect(validateDesignSpec(conflicted).issues.some(issue=>issue.path.endsWith('.effects'))).toBe(true);
  });
  it('validates text case, decoration and bounded letter spacing',()=>{
    const spec=structuredClone(valid);const frame=spec.pages[0]!.children[0]!;if(frame.type!=='frame')throw new Error('fixture frame expected');
    frame.children=[{type:'text',id:'tracked-heading',name:'Tracked heading',width:300,height:48,text:'FINANCE',fontSize:30,letterSpacing:{unit:'PIXELS',value:1.5},paragraphSpacing:8,textAlignVertical:'CENTER',textAutoResize:'HEIGHT',textDecoration:'UNDERLINE',textCase:'UPPER'}];
    expect(validateDesignSpec(spec).valid).toBe(true);
    const invalid=structuredClone(spec);const text=invalid.pages[0]!.children[0]!.type==='frame'?invalid.pages[0]!.children[0]!.children[0]:undefined;if(text?.type!=='text'||!text.letterSpacing)throw new Error('text fixture expected');text.letterSpacing.value=1001;
    expect(validateDesignSpec(invalid).valid).toBe(false);
  });
  it('validates bounded rectangle and ellipse stroke settings',()=>{
    const spec=structuredClone(valid);const frame=spec.pages[0]!.children[0]!;if(frame.type!=='frame')throw new Error('fixture frame expected');
    frame.children=[{type:'rectangle',id:'outlined-card',name:'Outlined card',width:120,height:80,stroke:'#087A55',strokeOpacity:.65,strokeWidth:2,strokeAlign:'INSIDE'},{type:'ellipse',id:'outlined-dot',name:'Outlined marker',width:24,height:24,stroke:'#111111',strokeAlign:'OUTSIDE'}];
    expect(validateDesignSpec(spec).valid).toBe(true);
    const invalid=structuredClone(spec);const rect=invalid.pages[0]!.children[0]!.type==='frame'?invalid.pages[0]!.children[0]!.children[0]:undefined;if(rect?.type!=='rectangle')throw new Error('shape fixture expected');rect.strokeOpacity=1.2;
    expect(validateDesignSpec(invalid).valid).toBe(false);
    const orphan=structuredClone(spec);const orphanRect=orphan.pages[0]!.children[0]!.type==='frame'?orphan.pages[0]!.children[0]!.children[0]:undefined;if(orphanRect?.type!=='rectangle')throw new Error('shape fixture expected');delete orphanRect.stroke;orphanRect.strokeOpacity=.4;
    expect(validateDesignSpec(orphan).issues.some(issue=>issue.path.endsWith('.strokeOpacity'))).toBe(true);
  });
  it('validates progressive blur radius and normalized endpoint bounds',()=>{
    const spec=structuredClone(valid);const frame=spec.pages[0]!.children[0]!;if(frame.type!=='frame')throw new Error('fixture frame expected');frame.children=[{type:'rectangle',id:'progressive-blur',name:'Progressive blur',width:120,height:80,effects:[{type:'progressive-layer-blur',startRadius:2,endRadius:18,startOffset:{x:.1,y:.2},endOffset:{x:.9,y:.8}}]}];
    expect(validateDesignSpec(spec).valid).toBe(true);
    const invalid=structuredClone(spec);const rect=invalid.pages[0]!.children[0]!.type==='frame'?invalid.pages[0]!.children[0]!.children[0]:undefined;if(rect?.type!=='rectangle'||!rect.effects?.[0]||rect.effects[0].type!=='progressive-layer-blur')throw new Error('progressive blur fixture expected');rect.effects[0].endOffset.x=1.1;
    expect(validateDesignSpec(invalid).valid).toBe(false);
  });
  it('rejects unknown component references and unsafe vector path content', () => {
    const bad = structuredClone(valid);
    bad.pages[0]!.children = [
      { type: 'instance', id: 'orphan-instance', name: 'Orphan', width: 20, height: 20, componentRef: 'missing-component' },
      { type: 'vector', id: 'unsafe-vector', name: 'Unsafe vector', width: 20, height: 20, path: 'M0 0; alert(1)' },
    ];
    const result = validateDesignSpec(bad);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.path.endsWith('componentRef'))).toBe(true);
    expect(result.issues.some((issue) => issue.path.endsWith('.path'))).toBe(true);
  });
  it('rejects gradients with unordered stops', () => {
    const bad = structuredClone(valid);
    const frame = bad.pages[0]!.children[0]!;
    if (frame.type !== 'frame') throw new Error('fixture frame expected');
    frame.gradient = { direction: 'vertical', stops: [{ position: 0.8, color: '#FFFFFF' }, { position: 0.2, color: '#000000' }] };
    expect(validateDesignSpec(bad).issues.some((issue) => issue.path.endsWith('gradient.stops'))).toBe(true);
  });
  it('accepts bounded affine transforms and rejects out-of-range gradient matrices',()=>{
    const spec=structuredClone(valid);const frame=spec.pages[0]!.children[0]!;if(frame.type!=='frame')throw new Error('fixture frame expected');frame.gradient={direction:'horizontal',transform:[[.7,-.4,.2],[.3,.8,-.1]],stops:[{position:0,color:'#000000'},{position:1,color:'#FFFFFF'}]};
    expect(validateDesignSpec(spec).valid).toBe(true);
    const unsafe=structuredClone(spec);const target=unsafe.pages[0]!.children[0]!;if(target.type!=='frame'||!target.gradient)throw new Error('gradient fixture expected');target.gradient.transform=[[101,0,0],[0,1,0]];
    expect(validateDesignSpec(unsafe).valid).toBe(false);
  });
  it('accepts radial gradient paint stacks and rejects singular transforms',()=>{
    const spec=structuredClone(valid);const frame=spec.pages[0]!.children[0]!;if(frame.type!=='frame')throw new Error('fixture frame expected');frame.children=[{type:'rectangle',id:'radial',name:'Radial highlight',width:120,height:80,paints:[{type:'radial-gradient',opacity:.8,gradient:{transform:[[.8,0,.1],[0,.9,.05]],stops:[{position:0,color:'#FFFFFF',opacity:.8},{position:1,color:'#087A55'}]}}]}];
    expect(validateDesignSpec(spec).valid).toBe(true);
    const singular=structuredClone(spec);const rect=singular.pages[0]!.children[0]!.type==='frame'?singular.pages[0]!.children[0]!.children[0]:undefined;if(rect?.type!=='rectangle'||rect.paints?.[0]?.type!=='radial-gradient')throw new Error('radial fixture expected');rect.paints[0].gradient.transform=[[1,0,0],[2,0,0]];
    expect(validateDesignSpec(singular).valid).toBe(false);
  });
  it('validates angular and diamond gradient items in the native paint stack',()=>{
    const spec=structuredClone(valid);const frame=spec.pages[0]!.children[0]!;if(frame.type!=='frame')throw new Error('fixture frame expected');frame.children=[{type:'rectangle',id:'multi-gradient',name:'Angular and diamond',width:140,height:100,paints:[{type:'angular-gradient',gradient:{transform:[[.8,0,.1],[0,.8,.1]],stops:[{position:0,color:'#FFFFFF'},{position:1,color:'#111111'}]}},{type:'diamond-gradient',gradient:{transform:[[.9,0,.05],[0,.9,.05]],stops:[{position:0,color:'#111111'},{position:1,color:'#087A55'}]}}]}];
    expect(validateDesignSpec(spec).valid).toBe(true);
  });
  it('validates embedded raster assets, design tokens, grid layouts, constraints and token references',()=>{
    const extended:DesignSpec={schemaVersion:'1.0',name:'Extended',designSystem:{name:'Acme',colors:[{name:'Brand/Primary',color:'#087A55'}],typography:[{name:'Heading',fontFamily:'Inter',fontSize:28,fontWeight:700,lineHeight:34,paragraphSpacing:6,letterSpacing:{unit:'PERCENT',value:2},textDecoration:'NONE',textCase:'TITLE'}]},pages:[{id:'p-ext',name:'Desktop',children:[
      {type:'frame',id:'frame-ext',name:'Responsive frame',width:1440,height:900,fillToken:'Brand/Primary',constraints:{horizontal:'STRETCH',vertical:'MIN'},layoutGrids:[{pattern:'COLUMNS',count:12,gutterSize:24,alignment:'STRETCH'},{pattern:'GRID',sectionSize:8}],children:[
        {type:'text',id:'heading-ext',name:'Page heading',width:500,height:40,text:'Overview',textStyleToken:'Heading',fontSize:28,fillToken:'Brand/Primary'},
        {type:'image',id:'image-ext',name:'Product image',width:1,height:1,mimeType:'image/png',data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==',scaleMode:'CROP',imageTransform:[[1,0,.1],[0,1,-.2]]},
      ]},
    ]}]};
    expect(validateDesignSpec(extended).valid).toBe(true);
    const invalid=structuredClone(extended);const frame=invalid.pages[0]!.children[0]!;if(frame.type!=='frame')throw new Error('expected fixture frame');
    frame.children[0]={type:'text',id:'wrong-token',name:'Unknown token',width:10,height:10,text:'x',textStyleToken:'Missing'};
    expect(validateDesignSpec(invalid).issues.some(issue=>issue.message.includes('Unknown text style token'))).toBe(true);
    const mismatch=structuredClone(extended);const image=mismatch.pages[0]!.children[0]!.type==='frame'?mismatch.pages[0]!.children[0]!.children[1]:undefined;if(image?.type==='image')image.mimeType='image/jpeg';
    expect(validateDesignSpec(mismatch).issues.some(issue=>issue.message.includes('MIME type mismatch'))).toBe(true);
    const singular=structuredClone(extended);const imageNode=singular.pages[0]!.children[0]!.type==='frame'?singular.pages[0]!.children[0]!.children[1]:undefined;if(imageNode?.type==='image')imageNode.imageTransform=[[1,0,0],[2,0,0]];
    expect(validateDesignSpec(singular).issues.some(issue=>issue.path.endsWith('imageTransform')&&issue.message.includes('invertible'))).toBe(true);
    const wrongMode=structuredClone(extended);const wrongImage=wrongMode.pages[0]!.children[0]!.type==='frame'?wrongMode.pages[0]!.children[0]!.children[1]:undefined;if(wrongImage?.type==='image')wrongImage.scaleMode='FIT';
    expect(validateDesignSpec(wrongMode).issues.some(issue=>issue.path.endsWith('imageTransform')&&issue.message.includes('only for CROP'))).toBe(true);
  });
  it('reports invalid JSON syntax', () => expect(parseDesignSpec('{broken').issues[0]?.message).toMatch(/syntax/i));
  it('accepts a JSON code block pasted from an external AI chat', () => {
    expect(parseDesignSpec(`\`\`\`json\n${JSON.stringify(valid)}\n\`\`\``).valid).toBe(true);
  });
  it('rejects unsupported node types', () => {
    const result = validateDesignSpec({ ...valid, pages: [{ ...valid.pages[0]!, children: [{ ...valid.pages[0]!.children[0]!, type: 'script' }] }] });
    expect(result.valid).toBe(false);
  });
  it('rejects duplicate IDs across pages and nodes', () => {
    const duplicate = structuredClone(valid); duplicate.pages[0]!.children[0]!.id = 'page-1';
    expect(validateDesignSpec(duplicate).issues.some((issue) => issue.message.includes('Duplicate'))).toBe(true);
  });
  it('rejects oversized documents before parsing', () => expect(parseDesignSpec(' '.repeat(512001)).valid).toBe(false));
  it('rejects deeply nested documents safely', () => {
    let child: DesignSpec['pages'][number]['children'][number] = { type: 'rectangle', id: 'leaf', name: 'Leaf', width: 1, height: 1 };
    for (let i = 0; i < 18; i++) child = { type: 'group', id: `g${i}`, name: 'Group', width: 10, height: 10, children: [child] };
    const result = validateDesignSpec({ ...valid, pages: [{ id: 'p', name: 'P', children: [child] }] });
    expect(result.issues.some((issue) => issue.message.includes('depth'))).toBe(true);
  });
  it('rejects circular and non-JSON input safely', () => {
    const circular: Record<string, unknown> = {}; circular.self = circular;
    expect(validateDesignSpec(circular).issues[0]?.message).toMatch(/circular/i);
    expect(validateDesignSpec(undefined).valid).toBe(false);
  });
});
